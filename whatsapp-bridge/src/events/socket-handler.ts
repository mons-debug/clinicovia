import type { Server as SocketIO } from "socket.io";
import { sessionManager } from "../baileys/session-manager.js";

export function setupSocketHandler(io: SocketIO): void {
  io.on("connection", (socket) => {
    const { sessionId } = socket.handshake.auth;

    if (sessionId) {
      socket.join(sessionId);

      // Send current session status immediately
      const info = sessionManager.getSession(sessionId);
      if (info) {
        socket.emit("session:status", {
          sessionId: info.sessionId,
          status: info.status,
          phoneNumber: info.phoneNumber,
          qrDataUrl: info.qrDataUrl,
        });
      }
    }

    socket.on("subscribe", (data: { sessionId: string }) => {
      if (data.sessionId) {
        socket.join(data.sessionId);
        const info = sessionManager.getSession(data.sessionId);
        if (info) {
          socket.emit("session:status", {
            sessionId: info.sessionId,
            status: info.status,
            phoneNumber: info.phoneNumber,
            qrDataUrl: info.qrDataUrl,
          });
        }
      }
    });

    socket.on("unsubscribe", (data: { sessionId: string }) => {
      if (data.sessionId) {
        socket.leave(data.sessionId);
      }
    });
  });
}
