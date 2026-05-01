"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  Receipt,
  RotateCcw,
  Save,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useAdvanceSession,
  useUpdateSession,
  usePlanTimeline,
  type SessionStatus,
  type SessionTimelineEntry,
} from "@/lib/api/plans";
import { useUploadPhoto } from "@/lib/api/photos";
import { PhotosCard } from "@/components/photos/photos-card";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";

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

const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  checked_in: "Arrivé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  issued: "Émise",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  cancelled: "Annulée",
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

function SessionCard({
  entry,
  planId,
  patientId,
}: {
  entry: SessionTimelineEntry;
  planId: string;
  patientId: string;
}) {
  const { session, appointment, photos, prescriptions } = entry;
  const advance = useAdvanceSession(planId);
  const updateSession = useUpdateSession(planId);
  const [expanded, setExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [noteVal, setNoteVal] = useState(session.outcome_note ?? "");
  const [scoreVal, setScoreVal] = useState(session.outcome_score?.toString() ?? "");
  const [productsVal, setProductsVal] = useState(
    session.products_used ? JSON.stringify(session.products_used) : ""
  );

  const photosBefore = photos.filter((p) => p.stage === "before");
  const photosAfter = photos.filter((p) => p.stage === "after" || p.stage === "follow_up");

  const seanceSteps = [
    { label: "Photos avant", done: photosBefore.length > 0, count: photosBefore.length },
    { label: "Traitement", done: !!session.outcome_score || !!session.outcome_note, count: 0 },
    { label: "Photos après", done: photosAfter.length > 0, count: photosAfter.length },
    { label: "Ordonnance", done: prescriptions.length > 0, count: prescriptions.length },
    { label: "Facture", done: false, count: 0 },
  ];

  const fire = (to: SessionStatus, label: string) =>
    advance.mutate(
      { sessionId: session.id, to },
      {
        onSuccess: () => toast.success(`Séance ${session.session_number} → ${label}`),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Erreur"),
      }
    );

  const saveDetails = () => {
    let products: unknown[] | null = null;
    if (productsVal.trim()) {
      try {
        products = JSON.parse(productsVal);
      } catch {
        products = productsVal.split(",").map((s) => ({ product_name: s.trim() }));
      }
    }
    updateSession.mutate(
      {
        sessionId: session.id,
        outcomeNote: noteVal.trim() || null,
        outcomeScore: scoreVal ? Number(scoreVal) : null,
        productsUsed: products,
      },
      {
        onSuccess: () => toast.success("Séance mise à jour"),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
      }
    );
  };

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
    <Card className="p-4">
      {/* Top row — number + status + actions */}
      <div className="flex items-start gap-4">
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
            {appointment && (
              <Link
                href={`/calendar?date=${appointment.appointment_date}`}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <CalendarClock className="h-3 w-3" />
                {fmt(appointment.appointment_date)} · {appointment.start_time}
                <span className="text-[var(--text-muted)]">·</span>
                <span>{APPT_STATUS_LABEL[appointment.status] ?? appointment.status}</span>
              </Link>
            )}
            {!appointment && session.planned_for && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <CalendarClock className="h-3 w-3" />
                Prévue pour le {fmt(session.planned_for)}
              </span>
            )}
            {session.outcome_score != null && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Score {session.outcome_score}/10
              </span>
            )}
          </div>
          {session.outcome_note && (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{session.outcome_note}</p>
          )}
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

      {/* Inline photos + Rx — only when there's something to show */}
      {(photos.length > 0 || prescriptions.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--line-soft,_#E2E8F0)] pt-3 lg:grid-cols-2">
          {photos.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                <ImageIcon className="h-3 w-3" />
                Photos · {photos.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {photos.slice(0, 6).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--background)] px-2 py-1 text-[10px] text-[var(--text-secondary)]"
                  >
                    {p.zone_slug} · {p.stage}
                  </span>
                ))}
                {photos.length > 6 && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    +{photos.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}
          {prescriptions.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                <FileText className="h-3 w-3" />
                Ordonnances · {prescriptions.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {prescriptions.map((rx) => (
                  <Link
                    key={rx.id}
                    href={`/prescriptions/${rx.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    {rx.number}
                    {rx.status === "signed" && (
                      <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step-based séance detail */}
      <div className="mt-3 border-t border-[var(--line-soft,_#E2E8F0)] pt-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {expanded ? "Masquer ▲" : "Détails de la séance ▼"}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Step pills */}
            <div className="flex flex-wrap gap-1">
              {seanceSteps.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                    i === activeStep
                      ? "bg-[var(--primary)] text-white"
                      : s.done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[var(--background)] text-[var(--text-muted)]"
                  )}
                >
                  {s.done ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-bold">{i + 1}</span>}
                  {s.label}
                  {s.count > 0 && <span className="text-[9px]">({s.count})</span>}
                </button>
              ))}
            </div>

            {/* Step content */}
            <div className="rounded-lg border border-[var(--border)] bg-white p-4">
              {activeStep === 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Photos avant traitement</p>
                  {photosBefore.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {photosBefore.map((p) => (
                        <span key={p.id} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 border border-emerald-200">
                          ✓ {p.zone_slug} · avant
                        </span>
                      ))}
                    </div>
                  )}
                  <PhotosCard patientId={patientId} />
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Traitement — produits & notes</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`score-${session.id}`} className="text-xs">Score (1-10)</Label>
                      <Input id={`score-${session.id}`} type="number" min={1} max={10} value={scoreVal} onChange={(e) => setScoreVal(e.target.value)} placeholder="ex. 8" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`products-${session.id}`} className="text-xs">Produits utilisés</Label>
                      <Input id={`products-${session.id}`} value={productsVal} onChange={(e) => setProductsVal(e.target.value)} placeholder="ex. Botox 20u" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`note-${session.id}`} className="text-xs">Notes cliniques</Label>
                    <textarea id={`note-${session.id}`} rows={3} value={noteVal} onChange={(e) => setNoteVal(e.target.value)} placeholder="Observations, réactions…" className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" />
                  </div>
                  <Button size="sm" onClick={saveDetails} disabled={updateSession.isPending}>
                    {updateSession.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Enregistrer
                  </Button>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Photos après traitement</p>
                  {photosAfter.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {photosAfter.map((p) => (
                        <span key={p.id} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 border border-emerald-200">
                          ✓ {p.zone_slug} · après
                        </span>
                      ))}
                    </div>
                  )}
                  <PhotosCard patientId={patientId} />
                </div>
              )}

              {activeStep === 3 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Ordonnance liée à cette séance</p>
                  {prescriptions.length > 0 && (
                    <div className="space-y-1.5">
                      {prescriptions.map((rx) => (
                        <Link key={rx.id} href={`/prescriptions/${rx.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-mono font-bold">{rx.number}</span>
                          </div>
                          <Badge variant={rx.status === "signed" ? "success" : "outline"}>
                            {rx.status === "signed" ? "Signée" : "Brouillon"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                  <NewPrescriptionDialog
                    patientId={patientId}
                    appointmentId={appointment?.id}
                  />
                </div>
              )}

              {activeStep === 4 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Facture liée à cette séance</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    La facture est auto-créée quand le médecin clique « Terminer la visite » depuis le dossier patient. Vous pouvez aussi en créer une manuellement.
                  </p>
                  <NewInvoiceDialog patientId={patientId} planId={planId} />
                </div>
              )}
            </div>

            {/* Step navigation */}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}>
                ← Précédent
              </Button>
              <span className="text-[11px] text-[var(--text-muted)]">{activeStep + 1}/{seanceSteps.length}</span>
              <Button size="sm" variant="default" onClick={() => setActiveStep(Math.min(seanceSteps.length - 1, activeStep + 1))} disabled={activeStep === seanceSteps.length - 1}>
                Suivant →
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function PlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: timeline, isLoading, isError } = usePlanTimeline(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du plan…
      </div>
    );
  }
  if (isError || !timeline) {
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

  const { plan, sessions, invoices } = timeline;
  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const skipped = plan.sessions.filter((s) => s.status === "skipped").length;
  const pct = plan.total_sessions > 0
    ? Math.round((completed / plan.total_sessions) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
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

        {/* Progress */}
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

      {/* Séances — each card is plan-centric (appt + photos + Rx inline) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Séances
        </h2>
        {sessions.map((entry) => (
          <SessionCard key={entry.session.id} entry={entry} planId={plan.id} patientId={plan.patient_id} />
        ))}
      </div>

      {/* Plan-level invoices */}
      {invoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
            <Receipt className="h-3.5 w-3.5" />
            Factures
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white p-3 text-sm hover:border-[var(--primary)]"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[var(--text-primary)]">{inv.number}</span>
                  <Badge variant="outline">{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</Badge>
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {inv.total.toLocaleString("fr-FR")} {inv.currency}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
