export type SessionStatus = "connecting" | "qr" | "connected" | "disconnected";

export interface SessionInfo {
  sessionId: string;
  clinicId: string;
  phoneNumber?: string;
  status: SessionStatus;
  qrDataUrl?: string;
  connectedAt?: Date;
}

export interface InboundMessage {
  clinicId: string;
  sessionId: string;
  jid: string;
  messageId: string;
  contactName: string;
  contactPhone: string;
  content: string;
  type: "text" | "image" | "document" | "audio" | "video";
  mediaUrl?: string;
  timestamp: number;
}
