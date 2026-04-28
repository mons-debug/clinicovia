"use client";

import { Phone, ChevronDown } from "lucide-react";
import type { WhatsAppSession } from "@/lib/api/whatsapp";

interface NumberSelectorProps {
  sessions: WhatsAppSession[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function NumberSelector({
  sessions,
  selectedId,
  onChange,
}: NumberSelectorProps) {
  const connectedSessions = sessions.filter((s) => s.status === "connected");

  if (connectedSessions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Phone className="h-3.5 w-3.5 text-text-muted" />
      <div className="relative flex-1">
        <select
          value={selectedId || "all"}
          onChange={(e) =>
            onChange(e.target.value === "all" ? null : e.target.value)
          }
          className="w-full appearance-none rounded-md border border-border bg-white py-1.5 pl-2 pr-7 text-xs font-medium text-text-primary focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        >
          <option value="all">All Numbers</option>
          {connectedSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.phone_number ? ` (+${s.phone_number})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
      </div>
    </div>
  );
}
