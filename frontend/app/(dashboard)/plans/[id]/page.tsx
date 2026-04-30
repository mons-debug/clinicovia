"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  CalendarClock,
  Loader2,
  PlayCircle,
  SkipForward,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  usePlan,
  useAdvanceSession,
  type SessionStatus,
  type TreatmentSession,
} from "@/lib/api/plans";

const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: "Planifiée",
  scheduled: "Programmée",
  in_progress: "En cours",
  completed: "Terminée",
  skipped: "Sautée",
};

const STATUS_VARIANT: Record<SessionStatus, "outline" | "secondary" | "warning" | "default" | "success" | "destructive"> = {
  planned: "outline",
  scheduled: "secondary",
  in_progress: "warning",
  completed: "success",
  skipped: "destructive",
};

const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SessionRow({
  session,
  planId,
}: {
  session: TreatmentSession;
  planId: string;
}) {
  const advance = useAdvanceSession(planId);

  const fire = (to: SessionStatus, label: string) =>
    advance.mutate(
      { sessionId: session.id, to },
      {
        onSuccess: () => toast.success(`Séance ${session.session_number} → ${label}`),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Erreur"),
      }
    );

  const completeWithScore = () => {
    const raw = window.prompt("Score d'évolution (1-10) ?", "8");
    if (raw === null) return;
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 1 || score > 10) {
      toast.error("Score invalide (1-10)");
      return;
    }
    advance.mutate(
      { sessionId: session.id, to: "completed", outcomeScore: score },
      {
        onSuccess: () => toast.success(`Séance ${session.session_number} terminée`),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Erreur"),
      }
    );
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] font-mono text-sm font-bold text-[var(--primary)]">
        {session.session_number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[var(--text-primary)]">
            Séance {session.session_number}
          </p>
          <Badge variant={STATUS_VARIANT[session.status]}>
            {STATUS_LABEL[session.status]}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {fmt(session.planned_for)}
          </span>
          {session.outcome_score != null && (
            <span>Score {session.outcome_score}/10</span>
          )}
          {session.outcome_note && (
            <span className="truncate max-w-[40ch]">{session.outcome_note}</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {session.status === "planned" && (
          <>
            <Button size="sm" variant="secondary" disabled={advance.isPending} onClick={() => fire("scheduled", "Programmée")}>
              Programmer
            </Button>
            <Button size="sm" variant="ghost" disabled={advance.isPending} onClick={() => fire("skipped", "Sautée")}>
              <SkipForward className="h-3 w-3" />
            </Button>
          </>
        )}
        {session.status === "scheduled" && (
          <>
            <Button size="sm" variant="default" disabled={advance.isPending} onClick={() => fire("in_progress", "En cours")}>
              <PlayCircle className="h-3 w-3" />
              Commencer
            </Button>
            <Button size="sm" variant="ghost" disabled={advance.isPending} onClick={() => fire("planned", "Planifiée")}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}
        {session.status === "in_progress" && (
          <Button size="sm" variant="default" disabled={advance.isPending} onClick={completeWithScore}>
            <CheckCircle2 className="h-3 w-3" />
            Terminer
          </Button>
        )}
        {session.status === "skipped" && (
          <Button size="sm" variant="ghost" disabled={advance.isPending} onClick={() => fire("planned", "Planifiée")}>
            <RotateCcw className="h-3 w-3" />
            Réactiver
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: plan, isLoading, isError } = usePlan(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du plan…
      </div>
    );
  }
  if (isError || !plan) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <p className="text-sm text-[var(--text-muted)]">Plan introuvable.</p>
      </div>
    );
  }

  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const skipped = plan.sessions.filter((s) => s.status === "skipped").length;
  const pct = plan.total_sessions > 0
    ? Math.round((completed / plan.total_sessions) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Back nav */}
      <Link
        href={`/patients/${plan.patient_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au dossier
      </Link>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{plan.title}</h1>
              <Badge variant="outline">{plan.version}</Badge>
              <Badge
                variant={
                  plan.status === "completed"
                    ? "success"
                    : plan.status === "cancelled"
                    ? "destructive"
                    : "default"
                }
              >
                {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {plan.primary_service ?? "Plan personnalisé"} · {plan.total_sessions} séance
              {plan.total_sessions > 1 ? "s" : ""} · tous les {plan.interval_value} {plan.interval_unit === "weeks" ? "semaines" : plan.interval_unit === "days" ? "jours" : "mois"}
            </p>
          </div>
          {plan.estimated_total != null && (
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Coût estimé</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {plan.estimated_total.toLocaleString("fr-FR")} {plan.currency}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Progression</span>
            <span className="font-mono">
              {completed} / {plan.total_sessions} terminées · {pct}%
              {skipped > 0 && ` · ${skipped} sautée${skipped > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {plan.notes && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {plan.notes}
          </p>
        )}
      </Card>

      {/* Sessions */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Séances
        </h2>
        {plan.sessions.map((s) => (
          <SessionRow key={s.id} session={s} planId={plan.id} />
        ))}
      </div>
    </div>
  );
}
