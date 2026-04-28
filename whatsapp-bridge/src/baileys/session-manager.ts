import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
  type WAMessageKey,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import * as QRCode from "qrcode";
import * as fs from "fs";
import axios from "axios";
import type { Server as SocketIO } from "socket.io";
import type { SessionInfo, SessionStatus, InboundMessage } from "../types/index.js";

const logger = pino({ level: "warn" });

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "change-me-whatsapp-secret";
const SESSIONS_DIR = process.env.SESSIONS_DIR || "/app/sessions";

function cleanJidNumber(jidOrNumber?: string | null): string {
  if (!jidOrNumber) return "";
  const number = jidOrNumber.split("@")[0].split(":")[0];
  return number.replace(/[^\d]/g, "");
}

function isPhoneJid(jid?: string | null): boolean {
  return Boolean(jid?.endsWith("@s.whatsapp.net"));
}

function isLidJid(jid?: string | null): boolean {
  return Boolean(jid?.endsWith("@lid"));
}

function extractPhoneFromVcard(vcard?: string | null): string {
  if (!vcard) return "";
  const waidMatch = vcard.match(/waid=(\d{8,16})/i);
  if (waidMatch?.[1]) return waidMatch[1];

  const telMatch = vcard.match(/TEL[^:\n]*:([+\d][\d\s().-]{7,}\d)/i);
  return cleanJidNumber(telMatch?.[1]);
}

async function resolvePhoneJid(sock: WASocket, key: WAMessageKey): Promise<string | null> {
  const candidates = [
    (key as any).senderPn as string | undefined,
    key.remoteJidAlt,
    key.participantAlt,
    key.participant,
    key.remoteJid,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (isPhoneJid(candidate)) return `${cleanJidNumber(candidate)}@s.whatsapp.net`;
  }

  const lid = candidates.find((candidate) => isLidJid(candidate));
  if (!lid) return null;

  try {
    const mapped = await sock.signalRepository.lidMapping.getPNForLID(lid);
    if (isPhoneJid(mapped)) return `${cleanJidNumber(mapped)}@s.whatsapp.net`;
  } catch (err: any) {
    logger.warn({ lid, err: err.message }, "Failed to resolve LID to phone JID");
  }
  return null;
}

class SessionManager {
  private sockets: Map<string, WASocket> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();
  private io: SocketIO | null = null;
  // Cache of recently-sent outbound messages per session, keyed by WA message id.
  // WhatsApp may ask for retries (e.g. recipient re-keys, especially @lid devices);
  // Baileys calls getMessage(key) and we must return the original content, otherwise
  // the recipient receives an empty message.
  private outboundCache: Map<string, Map<string, proto.IMessage>> = new Map();
  private static OUTBOUND_CACHE_MAX = 500; // per session

  setIO(io: SocketIO): void {
    this.io = io;
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  getSessionsByClinic(clinicId: string): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.clinicId === clinicId,
    );
  }

  async startSession(sessionId: string, clinicId: string): Promise<SessionInfo> {
    // If already running, return current info
    const existing = this.sessions.get(sessionId);
    if (existing && existing.status !== "disconnected") {
      return existing;
    }

    const sessionInfo: SessionInfo = {
      sessionId,
      clinicId,
      status: "connecting",
    };
    this.sessions.set(sessionId, sessionInfo);

    const authDir = `${SESSIONS_DIR}/${clinicId}/${sessionId}`;
    fs.mkdirSync(authDir, { recursive: true });

    await this.createSocket(sessionId, clinicId, authDir);

    return this.sessions.get(sessionId)!;
  }

  async restoreSessionsFromDisk(): Promise<void> {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const clinicDirs = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    for (const clinicDir of clinicDirs) {
      const clinicPath = `${SESSIONS_DIR}/${clinicDir.name}`;
      const sessionDirs = fs.readdirSync(clinicPath, { withFileTypes: true })
        .filter((d) => d.isDirectory());
      for (const sessionDir of sessionDirs) {
        const credsFile = `${clinicPath}/${sessionDir.name}/creds.json`;
        if (!fs.existsSync(credsFile)) continue;
        try {
          console.log(`[restore] reconnecting session ${sessionDir.name} (clinic ${clinicDir.name})`);
          await this.startSession(sessionDir.name, clinicDir.name);
        } catch (err: any) {
          console.error(`[restore] failed for ${sessionDir.name}: ${err.message}`);
        }
      }
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (sock) {
      sock.end(undefined);
      this.sockets.delete(sessionId);
    }
    const info = this.sessions.get(sessionId);
    if (info) {
      info.status = "disconnected";
      info.qrDataUrl = undefined;
    }
    this.emitStatus(sessionId);
  }

  async checkWhatsApp(sessionId: string, phone: string): Promise<{ exists: boolean; jid: string | null }> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`Session ${sessionId} not found or not connected`);
    }
    const results = await sock.onWhatsApp(phone);
    if (results && results.length > 0 && results[0].exists) {
      return { exists: true, jid: results[0].jid };
    }
    return { exists: false, jid: null };
  }

  async subscribePresence(sessionId: string, jid: string): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (sock) {
      await sock.presenceSubscribe(jid);
    }
  }

  async sendMessage(
    sessionId: string,
    jid: string,
    text: string,
    quotedMessageId?: string,
  ): Promise<WAMessage | undefined> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`Session ${sessionId} not found or not connected`);
    }

    let result: WAMessage | undefined;
    if (quotedMessageId) {
      result = await sock.sendMessage(jid, { text }, {
        quoted: {
          key: {
            remoteJid: jid,
            id: quotedMessageId,
            fromMe: false,
          },
          message: { conversation: "" },
        } as WAMessage,
      });
    } else {
      result = await sock.sendMessage(jid, { text });
    }

    // Cache the outbound message body so we can answer Baileys' getMessage()
    // retry callbacks with the real content.
    if (result?.key?.id) {
      this.cacheOutbound(sessionId, result.key.id, { conversation: text });
    }
    return result;
  }

  private cacheOutbound(sessionId: string, msgId: string, msg: proto.IMessage): void {
    let cache = this.outboundCache.get(sessionId);
    if (!cache) {
      cache = new Map();
      this.outboundCache.set(sessionId, cache);
    }
    cache.set(msgId, msg);
    // Trim oldest entries if cache exceeds max
    if (cache.size > SessionManager.OUTBOUND_CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  private getCachedOutbound(sessionId: string, msgId: string): proto.IMessage | undefined {
    return this.outboundCache.get(sessionId)?.get(msgId);
  }

  private async createSocket(
    sessionId: string,
    clinicId: string,
    authDir: string,
  ): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[${sessionId}] Using WA version: ${version.join(".")}`);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      version,
      browser: Browsers.macOS("Desktop"),
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      // Stay "online" so WhatsApp routes messages to this device and we
      // acknowledge them instead of the sender's phone showing "Waiting for
      // this message…".
      markOnlineOnConnect: true,
      // Baileys calls this when WhatsApp asks to retry a specific message id
      // (recipient lost it / re-keyed). For OUTBOUND messages we sent, return
      // the cached body so the recipient gets the real content (not empty).
      // For unknown ids return undefined so Baileys falls back to its default.
      getMessage: async (key) => {
        const cached = key.id ? this.getCachedOutbound(sessionId, key.id) : undefined;
        return cached;
      },
      // Don't try to sync the entire chat history — slows startup and spams us.
      shouldSyncHistoryMessage: () => false,
    });

    this.sockets.set(sessionId, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[${sessionId}] connection.update:`, JSON.stringify({
        connection,
        qr: qr ? qr.substring(0, 30) + "..." : false,
        lastDisconnect: lastDisconnect?.error?.message,
        statusCode: (lastDisconnect?.error as Boom)?.output?.statusCode,
      }));
      const info = this.sessions.get(sessionId);
      if (!info) return;

      if (qr) {
        try {
          info.qrDataUrl = await QRCode.toDataURL(qr, {
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
          });
          info.status = "qr";
          this.emitStatus(sessionId);
          this.io?.to(sessionId).emit("qr", {
            sessionId,
            qrDataUrl: info.qrDataUrl,
          });
        } catch (err) {
          logger.error({ err }, "Failed to generate QR data URL");
        }
      }

      if (connection === "open") {
        info.status = "connected";
        info.qrDataUrl = undefined;
        info.connectedAt = new Date();

        // Extract phone number from socket
        const phoneNumber = sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
        if (phoneNumber) {
          info.phoneNumber = phoneNumber;
        }

        this.emitStatus(sessionId);
        this.io?.to(sessionId).emit("session:connected", {
          sessionId,
          phoneNumber: info.phoneNumber,
        });

        // Notify backend of status change
        this.notifyBackendStatus(sessionId, clinicId, "connected", info.phoneNumber);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        info.status = "disconnected";
        info.qrDataUrl = undefined;
        this.sockets.delete(sessionId);
        this.emitStatus(sessionId);

        this.io?.to(sessionId).emit("session:disconnected", { sessionId });

        this.notifyBackendStatus(sessionId, clinicId, "disconnected");

        if (shouldReconnect) {
          logger.info({ sessionId }, "Reconnecting...");
          setTimeout(() => this.createSocket(sessionId, clinicId, authDir), 3000);
        } else {
          logger.info({ sessionId }, "Logged out, not reconnecting");
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (err: any) {
            logger.warn({ sessionId, err: err.message }, "Failed to clear logged-out auth state");
          }
          this.sessions.delete(sessionId);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      console.log(`[inbound] messages.upsert type=${type} count=${messages.length}`);
      if (type !== "notify") return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid) { console.log("[inbound] skip: no jid"); continue; }
        console.log(`[inbound] msg from jid=${jid} id=${msg.key.id}`);
        // Accept personal chats: classic phone-based (@s.whatsapp.net) and new LIDs (@lid).
        // Skip groups (@g.us), newsletters (@newsletter), status broadcasts, etc.
        const isPersonal = isPhoneJid(jid) || isLidJid(jid);
        if (!isPersonal) { console.log(`[inbound] skip: non-personal jid ${jid}`); continue; }

        const textContent =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text;

        // Baileys v7 may expose privacy LIDs as the primary remoteJid and the real
        // phone JID as remoteJidAlt. Always prefer the phone JID when available so
        // one person stays in one Clinicovia conversation.
        const phoneJid = await resolvePhoneJid(sock, msg.key);
        const reportedJid = phoneJid || jid;
        const contactPhone = cleanJidNumber(phoneJid || jid);
        const contactName = msg.pushName || contactPhone;

        if (phoneJid && phoneJid !== jid) {
          console.log(`[inbound] normalized LID ${jid} -> ${reportedJid}`);
        } else if (isLidJid(jid)) {
          console.log(`[inbound] unresolved LID ${jid}; forwarding as opaque identifier`);
        }

        let msgType: InboundMessage["type"] = "text";
        let content = textContent || "";

        if (msg.message?.imageMessage) {
          msgType = "image";
          content = msg.message.imageMessage.caption || "[Image]";
        } else if (msg.message?.documentMessage) {
          msgType = "document";
          content = msg.message.documentMessage.fileName || "[Document]";
        } else if (msg.message?.audioMessage) {
          msgType = "audio";
          content = "[Audio]";
        } else if (msg.message?.videoMessage) {
          msgType = "video";
          content = msg.message.videoMessage.caption || "[Video]";
        } else if (msg.message?.contactMessage) {
          const phone = extractPhoneFromVcard(msg.message.contactMessage.vcard);
          content = [
            msg.message.contactMessage.displayName,
            phone,
          ].filter(Boolean).join("\n") || "[Contact]";
        } else if (msg.message?.contactsArrayMessage) {
          content = msg.message.contactsArrayMessage.contacts
            ?.map((contact) => [
              contact.displayName,
              extractPhoneFromVcard(contact.vcard),
            ].filter(Boolean).join("\n"))
            .filter(Boolean)
            .join("\n\n") || "[Contacts]";
        }

        if (!content) { console.log(`[inbound] skip: empty content, keys=${Object.keys(msg.message || {}).join(',')}`); continue; }
        console.log(`[inbound] forwarding msg type=${msgType} from=${contactPhone}`);

        const payload: InboundMessage = {
          clinicId,
          sessionId,
          jid: reportedJid,
          messageId: msg.key.id || `${Date.now()}`,
          contactName,
          contactPhone,
          content,
          type: msgType,
          timestamp: msg.messageTimestamp
            ? typeof msg.messageTimestamp === "number"
              ? msg.messageTimestamp
              : msg.messageTimestamp.toNumber?.() ?? Date.now() / 1000
            : Date.now() / 1000,
        };

        this.forwardToBackend(payload);

        // Send a read receipt so the sender's WhatsApp shows blue ticks instead
        // of hanging on "Waiting for this message…". This ALSO tells WA we
        // successfully decrypted, which prevents retry storms.
        try {
          await sock.readMessages([msg.key]);
        } catch (err: any) {
          console.error(`[inbound] readMessages failed for ${msg.key.id}: ${err.message}`);
        }

        // Also emit via Socket.IO for real-time frontend updates
        this.io?.to(sessionId).emit("message:new", payload);
      }
    });

    // Presence tracking — emit online/offline/typing status
    sock.ev.on("presence.update", ({ id: jid, presences }) => {
      const presence = Object.values(presences)[0];
      if (presence) {
        this.io?.to(sessionId).emit("presence:update", {
          sessionId,
          jid,
          status: presence.lastKnownPresence, // "available" | "unavailable" | "composing" | "recording"
          lastSeen: presence.lastSeen,
        });
      }
    });
  }

  private emitStatus(sessionId: string): void {
    const info = this.sessions.get(sessionId);
    if (info) {
      this.io?.to(sessionId).emit("session:status", {
        sessionId,
        status: info.status,
        phoneNumber: info.phoneNumber,
        qrDataUrl: info.qrDataUrl,
      });
    }
  }

  private async forwardToBackend(payload: InboundMessage): Promise<void> {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/whatsapp/webhook/message`, payload, {
        headers: { "X-Bridge-Secret": BRIDGE_SECRET },
        timeout: 10000,
      });
      console.log(`[inbound] backend ack status=${res.status} for msg=${payload.messageId}`);
    } catch (err: any) {
      console.error(`[inbound] forward FAILED msg=${payload.messageId} err=${err.message} resp=${err.response?.status} body=${JSON.stringify(err.response?.data)}`);
    }
  }

  private async notifyBackendStatus(
    sessionId: string,
    clinicId: string,
    status: SessionStatus,
    phoneNumber?: string,
  ): Promise<void> {
    try {
      await axios.post(
        `${BACKEND_URL}/api/v1/whatsapp/webhook/status`,
        { sessionId, clinicId, status, phoneNumber },
        {
          headers: { "X-Bridge-Secret": BRIDGE_SECRET },
          timeout: 5000,
        },
      );
    } catch (err: any) {
      logger.error(
        { err: err.message, sessionId },
        "Failed to notify backend of status change",
      );
    }
  }
}

export const sessionManager = new SessionManager();
