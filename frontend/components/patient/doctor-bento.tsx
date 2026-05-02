"use client";

import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { useSessionContext } from "@/lib/api/session-context";
import type { Patient } from "@/lib/api/patients";

interface Props {
  patientId: string;
  patientName: string;
  patient: Patient;
}

export function DoctorBento({ patientId, patientName }: Props) {
  const { data: ctx } = useSessionContext(patientId);

  if (!ctx?.active) return null;

  const isSeance = ctx.mode === "seance";
  const title = isSeance
    ? `Séance ${ctx.session_number}/${ctx.total_sessions}`
    : "Consultation";
  const subtitle = isSeance ? ctx.plan_title : ctx.treatment;

  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Session active</p>
          <p className="text-base font-bold text-[var(--text-primary)]">{title} — {subtitle}</p>
        </div>
      </div>
      <TerminerVisiteButton patientId={patientId} patientName={patientName} />
    </div>
  );
}
