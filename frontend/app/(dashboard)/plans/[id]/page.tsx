"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileText,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  Receipt,
  RotateCcw,
  Save,
  SkipForward,
  Camera,
  Pill,
  Stethoscope,
  ChevronDown,
  ChevronUp,
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
  type TimelineInvoice,
} from "@/lib/api/plans";
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

const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const STEP_ICONS = [Camera, Stethoscope, Camera, Pill, Receipt];
const STEP_LABELS = ["Photos avant", "Traitement", "Photos après", "Ordonnance", "Facture"];

function SessionCard({
  entry, planId, patientId, planInvoices, planTitle,
}: {
  entry: SessionTimelineEntry; planId: string; patientId: string; planInvoices: TimelineInvoice[]; planTitle?: string;
}) {
  const { session, appointment, photos, prescriptions } = entry;
  const advance = useAdvanceSession(planId);
  const updateSession = useUpdateSession(planId);
  const [expanded, setExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [noteVal, setNoteVal] = useState(session.outcome_note ?? "");
  const [scoreVal, setScoreVal] = useState(session.outcome_score?.toString() ?? "");
  const [productsVal, setProductsVal] = useState(session.products_used ? JSON.stringify(session.products_used) : "");

  const photosBefore = photos.filter((p) => p.stage === "before");
  const photosAfter = photos.filter((p) => p.stage === "after" || p.stage === "follow_up");
  const sessionInvoices = planInvoices.filter((inv) => inv.session_id === session.id);

  const steps = [
    { done: photosBefore.length > 0, count: photosBefore.length },
    { done: !!session.outcome_score || !!session.outcome_note, count: 0 },
    { done: photosAfter.length > 0, count: photosAfter.length },
    { done: prescriptions.length > 0, count: prescriptions.length },
    { done: sessionInvoices.length > 0, count: sessionInvoices.length },
  ];

  const completedSteps = steps.filter((s) => s.done).length;
  const isCompleted = session.status === "completed";
  const isInProgress = session.status === "in_progress";
  const isActive = isInProgress || isCompleted;

  const fire = (to: SessionStatus, label: string) =>
    advance.mutate({ sessionId: session.id, to }, {
      onSuccess: () => toast.success(`Séance ${session.session_number} → ${label}`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });

  const completeWithScore = () => {
    const raw = window.prompt("Score d'évolution (1-10) ?", "8");
    if (raw === null) return;
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 1 || score > 10) { toast.error("Score invalide (1-10)"); return; }
    advance.mutate({ sessionId: session.id, to: "completed", outcomeScore: score }, {
      onSuccess: () => toast.success(`Séance ${session.session_number} terminée`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  const saveDetails = () => {
    let products: unknown[] | null = null;
    if (productsVal.trim()) {
      try { products = JSON.parse(productsVal); }
      catch { products = productsVal.split(",").map((s) => ({ product_name: s.trim() })); }
    }
    updateSession.mutate({
      sessionId: session.id, outcomeNote: noteVal.trim() || null,
      outcomeScore: scoreVal ? Number(scoreVal) : null, productsUsed: products,
    }, {
      onSuccess: () => toast.success("Séance mise à jour"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          isCompleted ? "bg-emerald-100 text-emerald-700" :
          isInProgress ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-2" :
          session.status === "skipped" ? "bg-red-50 text-red-400" :
          "bg-gray-100 text-gray-400"
        )}>
          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : session.session_number}
        </div>
        <div className="w-px flex-1 bg-gray-200 mt-2" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <div className={cn(
          "rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm",
          isInProgress ? "border-blue-200 shadow-sm" : "border-gray-100"
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  Séance {session.session_number}
                </span>
                <Badge variant={STATUS_VARIANT[session.status]} className="text-[10px]">
                  {STATUS_LABEL[session.status]}
                </Badge>
                {session.outcome_score != null && (
                  <span className="text-[11px] font-medium text-emerald-600">Score {session.outcome_score}/10</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <CalendarClock className="h-3 w-3" />
                {appointment ? (
                  <Link href={`/calendar?date=${appointment.appointment_date}`} className="hover:underline">
                    {fmtDate(appointment.appointment_date)} · {appointment.start_time?.slice(0, 5)}
                  </Link>
                ) : session.planned_for ? (
                  <span>Prévue le {fmtDate(session.planned_for)}</span>
                ) : (
                  <span>Non programmée</span>
                )}
              </div>
              {session.outcome_note && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>{session.outcome_note}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 shrink-0">
              {session.status === "planned" && (
                <>
                  <Button size="sm" variant="secondary" className="text-xs h-7" disabled={advance.isPending} onClick={() => fire("scheduled", "Programmée")}>Programmer</Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={advance.isPending} onClick={() => fire("skipped", "Sautée")}><SkipForward className="h-3 w-3" /></Button>
                </>
              )}
              {session.status === "scheduled" && (
                <>
                  <Button size="sm" className="text-xs h-7 gap-1" disabled={advance.isPending} onClick={() => fire("in_progress", "En cours")}><PlayCircle className="h-3 w-3" />Commencer</Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={advance.isPending} onClick={() => fire("planned", "Planifiée")}><RotateCcw className="h-3 w-3" /></Button>
                </>
              )}
              {session.status === "in_progress" && (
                <Button size="sm" className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={advance.isPending} onClick={completeWithScore}><CheckCircle2 className="h-3 w-3" />Terminer</Button>
              )}
              {session.status === "skipped" && (
                <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" disabled={advance.isPending} onClick={() => fire("planned", "Planifiée")}><RotateCcw className="h-3 w-3" />Réactiver</Button>
              )}
            </div>
          </div>

          {/* Step checklist (compact) */}
          {isActive && (
            <div className="mt-3 flex gap-1">
              {steps.map((s, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setExpanded(true); setActiveStep(i); }}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
                      s.done ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"
                    )}
                  >
                    {s.done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    {STEP_LABELS[i]}
                    {s.count > 0 && <span>({s.count})</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Expand toggle */}
          {isActive && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Masquer" : `Détails (${completedSteps}/${steps.length})`}
            </button>
          )}

          {/* Expanded step content */}
          {expanded && (
            <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-1 flex-wrap">
                {steps.map((s, i) => (
                  <button key={i} type="button" onClick={() => setActiveStep(i)} className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    i === activeStep ? "bg-gray-900 text-white" : s.done ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"
                  )}>
                    {s.done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    {STEP_LABELS[i]}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
                {activeStep === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Photos avant traitement</p>
                    {photosBefore.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {photosBefore.map((p) => (
                          <span key={p.id} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 border border-emerald-200">
                            {p.zone_slug} · avant
                          </span>
                        ))}
                      </div>
                    )}
                    <PhotosCard patientId={patientId} />
                  </div>
                )}
                {activeStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Traitement — produits & notes</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Score (1-10)</Label>
                        <Input type="number" min={1} max={10} value={scoreVal} onChange={(e) => setScoreVal(e.target.value)} placeholder="ex. 8" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Produits utilisés</Label>
                        <Input value={productsVal} onChange={(e) => setProductsVal(e.target.value)} placeholder="ex. Botox 20u" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes cliniques</Label>
                      <textarea rows={3} value={noteVal} onChange={(e) => setNoteVal(e.target.value)} placeholder="Observations, réactions…" className="block w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2" style={{ borderColor: "var(--border)" }} />
                    </div>
                    <Button size="sm" onClick={saveDetails} disabled={updateSession.isPending} className="gap-1">
                      {updateSession.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Enregistrer
                    </Button>
                  </div>
                )}
                {activeStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Photos après traitement</p>
                    {photosAfter.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {photosAfter.map((p) => (
                          <span key={p.id} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 border border-emerald-200">
                            {p.zone_slug} · après
                          </span>
                        ))}
                      </div>
                    )}
                    <PhotosCard patientId={patientId} />
                  </div>
                )}
                {activeStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ordonnances</p>
                    {prescriptions.map((rx) => (
                      <Link key={rx.id} href={`/prescriptions/${rx.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:border-blue-300" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="font-mono font-bold">{rx.number}</span>
                        </div>
                        <Badge variant={rx.status === "signed" ? "success" : "outline"}>{rx.status === "signed" ? "Signée" : "Brouillon"}</Badge>
                      </Link>
                    ))}
                    <NewPrescriptionDialog patientId={patientId} appointmentId={appointment?.id} />
                  </div>
                )}
                {activeStep === 4 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Factures</p>
                    {sessionInvoices.map((inv) => (
                      <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:border-blue-300" style={{ borderColor: "var(--border)" }}>
                        <span className="font-mono font-bold">{inv.number || "BROUILLON"}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{inv.total.toLocaleString("fr-FR")} MAD</span>
                          <Badge variant={inv.status === "paid" ? "success" : inv.status === "issued" ? "default" : "outline"}>
                            {inv.status === "paid" ? "Payée" : inv.status === "issued" ? "Émise" : "Brouillon"}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    {sessionInvoices.length === 0 && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>La facture est créée automatiquement au démarrage de la séance.</p>
                    )}
                    <NewInvoiceDialog patientId={patientId} planId={planId} sessionId={session.id} sessionPrice={session.session_price} treatmentName={planTitle} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}>← Précédent</Button>
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <button key={i} type="button" onClick={() => setActiveStep(i)} className={cn("h-1.5 rounded-full transition-all", i === activeStep ? "w-4 bg-gray-900" : "w-1.5 bg-gray-300")} />
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))} disabled={activeStep === steps.length - 1}>Suivant →</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: timeline, isLoading, isError } = usePlanTimeline(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du plan…
      </div>
    );
  }
  if (isError || !timeline) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Plan introuvable.</p>
      </div>
    );
  }

  const { plan, sessions, invoices } = timeline;
  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const skipped = plan.sessions.filter((s) => s.status === "skipped").length;
  const pct = plan.total_sessions > 0 ? Math.round((completed / plan.total_sessions) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href={`/patients/${plan.patient_id}`} className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline" style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft className="h-4 w-4" /> Retour au dossier
      </Link>

      {/* Header */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.title}</h1>
              <Badge variant={plan.status === "completed" ? "success" : plan.status === "cancelled" ? "destructive" : "default"}>
                {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {plan.primary_service ?? "Plan personnalisé"} · {plan.total_sessions} séance{plan.total_sessions > 1 ? "s" : ""} · tous les {plan.interval_value} {plan.interval_unit === "weeks" ? "semaines" : plan.interval_unit === "days" ? "jours" : "mois"}
            </p>
          </div>
          {plan.estimated_total != null && (
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Coût estimé</p>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.estimated_total.toLocaleString("fr-FR")} {plan.currency}</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>Progression</span>
            <span className="font-mono">{completed}/{plan.total_sessions} · {pct}%{skipped > 0 ? ` · ${skipped} sautée${skipped > 1 ? "s" : ""}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--primary)" }} />
          </div>
        </div>

        {plan.notes && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{plan.notes}</p>
        )}
      </div>

      {/* Séance timeline */}
      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          Séances
        </h2>
        <div>
          {sessions.map((entry) => (
            <SessionCard key={entry.session.id} entry={entry} planId={plan.id} patientId={plan.patient_id} planInvoices={invoices} planTitle={plan.primary_service ?? plan.title} />
          ))}
        </div>
      </div>

      {/* Plan invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            <Receipt className="h-3.5 w-3.5" /> Factures
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm transition-shadow hover:shadow-sm" style={{ borderColor: "var(--border)" }}>
                <span className="flex items-center gap-2">
                  <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{inv.number || "BROUILLON"}</span>
                  <Badge variant="outline">{inv.status === "paid" ? "Payée" : inv.status === "issued" ? "Émise" : "Brouillon"}</Badge>
                </span>
                <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{inv.total.toLocaleString("fr-FR")} {inv.currency}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
