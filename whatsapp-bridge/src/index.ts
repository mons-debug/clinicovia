import express from "express";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import { requireBridgeSecret } from "./api/middleware.js";
import sessionsRouter from "./api/sessions.js";
import { setupSocketHandler } from "./events/socket-handler.js";
import { sessionManager } from "./baileys/session-manager.js";

const app = express();
const server = createServer(app);
const io = new SocketIO(server, {
  cors: { origin: "*" },
});

app.use(express.json());

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "clinicovia-whatsapp-bridge" });
});

// Session management routes (protected)
app.use("/sessions", requireBridgeSecret, sessionsRouter);

// Wire Socket.IO to session manager
sessionManager.setIO(io);
setupSocketHandler(io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`WhatsApp Bridge running on port ${PORT}`);
  sessionManager.restoreSessionsFromDisk().catch((err) =>
    console.error("Session restore failed:", err),
  );
});

export { app, io };
