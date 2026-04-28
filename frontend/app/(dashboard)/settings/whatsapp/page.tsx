"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  QrCode,
  Phone,
  MessageSquare,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useWhatsAppSessions,
  useCreateWhatsAppSession,
  useDeleteWhatsAppSession,
  useReconnectWhatsAppSession,
  type WhatsAppSession,
} from "@/lib/api/whatsapp";
import { QrScanner } from "@/components/whatsapp/qr-scanner";


export default function WhatsAppSettingsPage() {
  const { data, isLoading } = useWhatsAppSessions();
  const createMutation = useCreateWhatsAppSession();
  const deleteMutation = useDeleteWhatsAppSession();
  const reconnectMutation = useReconnectWhatsAppSession();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sessions = data?.sessions || [];

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    try {
      const session = await createMutation.mutateAsync(newLabel.trim());
      setNewLabel("");
      setShowAddModal(false);
      setShowQrModal(session.id);
      toast.success("WhatsApp number added — scan QR code to connect");
    } catch (err: any) {
      toast.error(err.message || "Failed to create session");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
      toast.success("WhatsApp number disconnected");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    }
  };

  const handleReconnect = async (id: string) => {
    try {
      await reconnectMutation.mutateAsync(id);
      setShowQrModal(id);
      toast.success("Reconnecting — scan QR code");
    } catch (err: any) {
      toast.error(err.message || "Failed to reconnect");
    }
  };

  const getStatusDot = (status: WhatsAppSession["status"]) => {
    switch (status) {
      case "connected":
        return "bg-emerald-500";
      case "connecting":
      case "qr":
        return "bg-amber-400";
      case "disconnected":
        return "bg-red-400";
    }
  };

  const getStatusText = (session: WhatsAppSession) => {
    switch (session.status) {
      case "connected":
        return session.connected_at
          ? `Connected since ${new Date(session.connected_at).toLocaleDateString()}`
          : "Connected";
      case "connecting":
        return "Connecting...";
      case "qr":
        return "Waiting for QR scan";
      case "disconnected":
        return "Disconnected";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">WhatsApp Numbers</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Connect and manage your clinic&apos;s WhatsApp numbers
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" />
          Add Number
        </button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-20">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "#F0FDF4" }}
          >
            <MessageSquare className="h-7 w-7" style={{ color: "#22C55E" }} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-text-primary">
            No WhatsApp numbers connected
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Add your first WhatsApp number to start receiving conversations
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            <Plus className="h-4 w-4" />
            Connect WhatsApp
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-xl border border-border bg-white p-5"
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#F0FDF4" }}
                >
                  <Phone className="h-5 w-5" style={{ color: "#22C55E" }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {session.label}
                    </h3>
                    <span
                      className={`h-2 w-2 rounded-full ${getStatusDot(session.status)}`}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {session.phone_number
                      ? `+${session.phone_number}`
                      : getStatusText(session)}
                  </p>
                  {session.phone_number && (
                    <p className="text-[10px] text-text-muted">
                      {getStatusText(session)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(session.status === "connecting" || session.status === "qr") && (
                  <button
                    onClick={() => setShowQrModal(session.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-gray-50"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Scan QR
                  </button>
                )}
                {session.status === "disconnected" && (
                  <button
                    onClick={() => handleReconnect(session.id)}
                    disabled={reconnectMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-gray-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${reconnectMutation.isPending ? "animate-spin" : ""}`} />
                    Reconnect
                  </button>
                )}

                {deleteConfirm === session.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(session.id)}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Number Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Add WhatsApp Number
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewLabel("");
                }}
                className="rounded-lg p-1 text-text-muted hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Give this number a label (e.g. &quot;Main Reception&quot;, &quot;Sales&quot;)
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-text-primary">
                Label
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Main Reception"
                className="w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                autoFocus
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewLabel("");
                }}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newLabel.trim() || createMutation.isPending}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span>Adding...</span></>
                ) : (
                  <span>Add & Connect</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Scan QR Code
              </h2>
              <button
                onClick={() => setShowQrModal(null)}
                className="rounded-lg p-1 text-text-muted hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <QrScanner
              sessionId={showQrModal}
              onConnected={() => {
                setTimeout(() => setShowQrModal(null), 1500);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
