"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, UserPlus, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NewAppointmentDialog } from "@/components/calendar/new-appointment-dialog";
import { WalkInDialog } from "@/components/queue/walk-in-dialog";
import { cn } from "@/lib/utils";

interface Props {
  isoDate: string;
}

// Single calendar CTA replacing the noisy "Arrivée sans RDV" + "Nouveau
// RDV" duo. Click "Ajouter ▾" → small popover with two grouped tiles.
//
// The dialogs live OUTSIDE the popover (rendered with hidden triggers)
// so closing the popover doesn't unmount them. Clicking a tile fires
// the hidden trigger via ref and closes the popover.
export function QuickAddMenu({ isoDate }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const walkInTriggerRef = useRef<HTMLButtonElement | null>(null);
  const newApptTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fireWalkIn = () => {
    setOpen(false);
    // Click the hidden trigger after the popover state flips so React
    // can finish its render before Radix opens the dialog.
    setTimeout(() => walkInTriggerRef.current?.click(), 0);
  };

  const fireNewAppt = () => {
    setOpen(false);
    setTimeout(() => newApptTriggerRef.current?.click(), 0);
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <Button size="sm" onClick={() => setOpen((s) => !s)}>
        <Plus className="h-3 w-3" />
        Ajouter
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-lg">
          <button
            type="button"
            onClick={fireWalkIn}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--background)]"
          >
            <UserPlus className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-[var(--text-primary)]">
                Patient arrive maintenant
              </span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                Walk-in · ajout direct en salle d&apos;attente
              </span>
            </span>
          </button>
          <div className="h-px bg-[var(--line-soft,_#E2E8F0)]" />
          <button
            type="button"
            onClick={fireNewAppt}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--background)]"
          >
            <CalendarPlus className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-[var(--text-primary)]">
                Programmer un RDV
              </span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                Date + heure futures
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Always-mounted dialogs with hidden triggers — opening one of
          these from a popover tile is then just a synthetic click.
          The dialogs persist regardless of popover state. */}
      <span className="hidden">
        <span ref={(el) => { walkInTriggerRef.current = el?.querySelector("button") as HTMLButtonElement | null; }}>
          <WalkInDialog triggerLabel="" />
        </span>
        <span ref={(el) => { newApptTriggerRef.current = el?.querySelector("button") as HTMLButtonElement | null; }}>
          <NewAppointmentDialog isoDate={isoDate} triggerLabel="" />
        </span>
      </span>
    </div>
  );
}
