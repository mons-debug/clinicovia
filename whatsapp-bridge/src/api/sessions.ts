import { Router, Request, Response } from "express";
import { sessionManager } from "../baileys/session-manager.js";

const router = Router();

// POST /sessions — Start a new WhatsApp session
router.post("/", async (req: Request, res: Response) => {
  try {
    const { sessionId, clinicId } = req.body;
    if (!sessionId || !clinicId) {
      res.status(400).json({ error: "sessionId and clinicId are required" });
      return;
    }

    const info = await sessionManager.startSession(sessionId, clinicId);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions — List sessions, optionally filtered by clinicId
router.get("/", (req: Request, res: Response) => {
  const clinicId = req.query.clinicId as string | undefined;
  const sessions = clinicId
    ? sessionManager.getSessionsByClinic(clinicId)
    : sessionManager.getAllSessions();
  res.json({ sessions });
});

// GET /sessions/:sessionId — Get a single session
router.get("/:sessionId", (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const info = sessionManager.getSession(sessionId);
  if (!info) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(info);
});

// DELETE /sessions/:sessionId — Disconnect and stop a session
router.delete("/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    await sessionManager.stopSession(sessionId);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions/:sessionId/send — Send a message
router.post("/:sessionId/send", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { jid, text, quotedMessageId } = req.body;
    if (!jid || !text) {
      res.status(400).json({ error: "jid and text are required" });
      return;
    }

    const result = await sessionManager.sendMessage(sessionId, jid, text, quotedMessageId);
    res.json({ success: true, messageId: result?.key?.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions/:sessionId/check-whatsapp — Verify a phone number exists on WhatsApp
router.post("/:sessionId/check-whatsapp", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }
    const result = await sessionManager.checkWhatsApp(sessionId, phone);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions/:sessionId/presence — Subscribe to presence for a JID
router.post("/:sessionId/presence", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { jid } = req.body;
    if (!jid) {
      res.status(400).json({ error: "jid is required" });
      return;
    }
    await sessionManager.subscribePresence(sessionId, jid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
