"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Loader2, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { BRIDGE_URL } from "@/lib/api/whatsapp";

interface QrScannerProps {
  sessionId: string;
  onConnected?: (phoneNumber?: string) => void;
}

export function QrScanner({ sessionId, onConnected }: QrScannerProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "qr" | "connected" | "error">("waiting");
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BRIDGE_URL, {
      auth: { sessionId },
      transports: ["polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("qr", (data: { sessionId: string; qrDataUrl: string }) => {
      if (data.sessionId === sessionId) {
        setQrDataUrl(data.qrDataUrl);
        setStatus("qr");
      }
    });

    socket.on("session:status", (data: { status: string; qrDataUrl?: string; phoneNumber?: string }) => {
      if (data.status === "qr" && data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setStatus("qr");
      } else if (data.status === "connected") {
        setStatus("connected");
        onConnected?.(data.phoneNumber);
      }
    });

    socket.on("session:connected", (data: { sessionId: string; phoneNumber?: string }) => {
      if (data.sessionId === sessionId) {
        setStatus("connected");
        onConnected?.(data.phoneNumber);
      }
    });

    socket.on("connect_error", () => {
      setStatus("error");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, onConnected]);

  if (status === "connected") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle className="h-12 w-12 text-emerald-500" />
        <p className="text-sm font-medium text-text-primary">Connected successfully</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <WifiOff className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-600">Failed to connect to WhatsApp bridge</p>
        <p className="text-xs text-text-muted">Make sure the bridge service is running</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Connection status indicator */}
      <div className="flex items-center gap-2">
        {socketConnected ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
        )}
        <span className="text-xs text-text-muted">
          {socketConnected ? "Bridge connected" : "Connecting to bridge..."}
        </span>
      </div>

      {/* QR Code display */}
      {qrDataUrl ? (
        <div className="rounded-xl border-2 border-border bg-white p-6">
          <img
            src={qrDataUrl}
            alt="WhatsApp QR Code"
            width={320}
            height={320}
            className="rounded-lg"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      ) : (
        <div className="flex h-[352px] w-[352px] flex-col items-center justify-center rounded-xl border border-border bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
          <p className="mt-3 text-xs text-text-muted">Generating QR code...</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">Scan with WhatsApp</p>
        <p className="mt-1 text-xs text-text-secondary">
          Open WhatsApp on your phone, go to Linked Devices, and scan this QR code
        </p>
      </div>
    </div>
  );
}
