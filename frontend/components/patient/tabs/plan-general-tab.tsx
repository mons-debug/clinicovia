"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { usePatientPlans, usePlanTimeline, type TreatmentPlan } from "@/lib/api/plans";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
}

function PlanCard({ plan }: { plan: TreatmentPlan }) {
  const [expanded, setExpanded] = useState(false);
  const { data: timeline } = usePlanTimeline(expanded ? plan.id : undefined);
  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const pct = plan.total_sessions > 0 ? Math.round((completed / plan.total_sessions) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-[var(--background)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--primary)]" />
            <span className="font-semibold text-[var(--text-primary)]">{plan.title}</span>
            <Badge variant={plan.status === "active" ? "default" : plan.status === "completed" ? "success" : "outline"}>
              {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>{plan.primary_service ?? "Plan personnalisé"}</span>
            <span>{completed}/{plan.total_sessions} séances · {pct}%</span>
            {plan.estimated_total && <span className="font-mono">{plan.estimated_total} MAD</span>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ChevronDown className={cn("ml-3 h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-[var(--line-soft,_#E2E8F0)] p-4">
          <Link
            href={`/plans/${plan.id}`}
            className="mb-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Ouvrir le plan complet →
          </Link>
          {timeline ? (
            <div className="space-y-2">
              {timeline.sessions.map((entry) => (
                <Link
                  key={entry.session.id}
                  href={`/plans/${plan.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--background)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-xs font-bold text-[var(--primary)]">
                      {entry.session.session_number}
                    </span>
                    <span className="font-medium">Séance {entry.session.session_number}</span>
                    {entry.session.session_price != null && entry.session.session_price > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">{entry.session.session_price} MAD</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.photos.length > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)]">{entry.photos.length} photos</span>
                    )}
                    {entry.prescriptions.length > 0 && (
                      <span className="text-[10px] text-blue-600">{entry.prescriptions.length} Rx</span>
                    )}
                    {entry.appointment && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {entry.appointment.appointment_date}
                      </span>
                    )}
                    <Badge variant={
                      entry.session.status === "completed" ? "success" :
                      entry.session.status === "in_progress" ? "warning" :
                      entry.session.status === "scheduled" ? "secondary" : "outline"
                    }>
                      {entry.session.status === "completed" ? "Terminée" :
                       entry.session.status === "in_progress" ? "En cours" :
                       entry.session.status === "scheduled" ? "Programmée" :
                       entry.session.status === "skipped" ? "Sautée" : "Planifiée"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Chargement…</p>
          )}
        </div>
      )}
    </Card>
  );
}

export function PlanGeneralTab({ patientId }: Props) {
  const { data } = usePatientPlans(patientId);
  const plans = data?.plans ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Plans de traitement</h3>
        <NewPlanDialog patientId={patientId} />
      </div>

      {plans.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">Aucun plan de traitement</p>
          <p className="text-xs text-[var(--text-muted)]">Créez un plan pour organiser les séances du patient.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
