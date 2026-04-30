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
// RDV" duo. Click "Ajouter" → small popover with two grouped actions.
// The popover panel hosts the existing dialog triggers, so each tile
// itself opens its proper dialog on click.
export function QuickAddMenu({ isoDate }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <Button size="sm" onClick={() => setOpen((s) => !s)}>
        <Plus className="h-3 w-3" />
        Ajouter
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-lg"
          onClick={() => setOpen(false)}
        >
          {/* Patient maintenant — opens WalkInDialog */}
          <div className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--background)]">
            <UserPlus className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Patient arrive maintenant
              </p>
              <p className="mb-1.5 text-[11px] text-[var(--text-muted)]">
                Walk-in · ajout direct en salle d&apos;attente
              </p>
              <WalkInDialog triggerLabel="Ouvrir" />
            </div>
          </div>
          <div className="h-px bg-[var(--line-soft,_#E2E8F0)]" />
          {/* Programmer un RDV — opens NewAppointmentDialog */}
          <div className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--background)]">
            <CalendarPlus className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Programmer un RDV
              </p>
              <p className="mb-1.5 text-[11px] text-[var(--text-muted)]">
                Date + heure futures
              </p>
              <NewAppointmentDialog isoDate={isoDate} triggerLabel="Ouvrir" triggerVariant="outline" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
