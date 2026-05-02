"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  IdCard,
  Receipt,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { ScreeningCard } from "@/components/patient/screening-card";
import { ClinicalEditCard } from "@/components/patient/clinical-edit-card";
import { IdentityEditCard } from "@/components/patient/identity-edit-card";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import { useSessionContext } from "@/lib/api/session-context";
import { usePatientPlans, usePatientProgrammes, useCreateProgramme, usePlanTimeline, useAdvanceSession, useUpdateSession, type SessionStatus } from "@/lib/api/plans";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { usePatientConsultations } from "@/lib/api/consultations";
import { useInvoices } from "@/lib/api/invoices";
import { usePrepareSession } from "@/lib/api/queue";
import type { Patient } from "@/lib/api/patients";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Send, Clock, FileText as FileIcon, X } from "lucide-react";

interface Props {
  patientId: string;
  patientName: string;
  patient: Patient;
  onCollapse?: () => void;
}

interface Step {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  status: string;
  done: boolean;
  warn?: boolean;
}

function InlinePlanDetail({ planId, patientId }: { planId: string; patientId: string }) {
  const { data: timeline, isLoading } = usePlanTimeline(planId);
  const advance = useAdvanceSession(planId);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [seanceStep, setSeanceStep] = useState(0);

  if (isLoading) return <p className="p-3 text-xs text-[var(--text-muted)]">Chargement...</p>;
  if (!timeline) return null;

  const { plan, sessions, invoices: planInvoices } = timeline;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Séances — {plan.primary_service || plan.title}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">
          {sessions.filter((e) => e.session.status === "completed").length}/{plan.total_sessions} terminées
        </span>
      </div>
      {sessions.map((entry) => {
        const s = entry.session;
        const isExpanded = expandedSession === s.id;
        const sessionInvs = planInvoices.filter((inv) => inv.session_id === s.id);
        return (
          <div key={s.id} className="rounded-md border border-[var(--border)] bg-[var(--background)]">
            <button
              type="button"
              onClick={() => {
                setExpandedSession(isExpanded ? null : s.id);
                setSeanceStep(0);
              }}
              className="flex w-full items-center justify-between p-2.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                  {s.session_number}
                </span>
                <span className="font-medium">Séance {s.session_number}</span>
                <Badge variant={s.status === "completed" ? "success" : s.status === "in_progress" ? "default" : "outline"} className="text-[9px]">
                  {s.status === "completed" ? "Terminée" : s.status === "in_progress" ? "En cours" : s.status === "scheduled" ? "Programmée" : s.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {s.session_price != null && s.session_price > 0 && (
                  <span className="font-mono text-[var(--text-muted)]">{s.session_price.toLocaleString("fr-FR")} MAD</span>
                )}
                <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-[var(--border)] p-3 space-y-3">
                {/* Séance step pills */}
                <div className="flex gap-1">
                  {["Photos av.", "Traitement", "Photos ap.", "Ordonnance", "Facture"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSeanceStep(i)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        i === seanceStep ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-[var(--text-muted)] hover:bg-gray-200"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Step content */}
                {seanceStep === 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      Photos avant traitement — {entry.photos.filter((ph) => ph.stage === "before").length} photo(s)
                    </p>
                  </div>
                )}
                {seanceStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">Score, produits, notes — rempli pendant le traitement</p>
                    {s.outcome_score && <p className="text-xs">Score: <span className="font-bold">{s.outcome_score}/10</span></p>}
                    {s.outcome_note && <p className="text-xs text-[var(--text-secondary)]">{s.outcome_note}</p>}
                  </div>
                )}
                {seanceStep === 2 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      Photos après traitement — {entry.photos.filter((ph) => ph.stage === "after" || ph.stage === "follow_up").length} photo(s)
                    </p>
                  </div>
                )}
                {seanceStep === 3 && (
                  <div className="space-y-2">
                    {entry.prescriptions.length > 0 ? (
                      entry.prescriptions.map((rx) => (
                        <div key={rx.id} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs">
                          <span className="font-mono font-bold">{rx.number}</span>
                          <Badge variant={rx.status === "signed" ? "success" : "outline"}>
                            {rx.status === "signed" ? "Signée" : "Brouillon"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">Aucune ordonnance</p>
                    )}
                    <NewPrescriptionDialog patientId={patientId} appointmentId={entry.appointment?.id} />
                  </div>
                )}
                {seanceStep === 4 && (
                  <div className="space-y-2">
                    {sessionInvs.length > 0 ? (
                      sessionInvs.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs">
                          <span className="font-mono font-bold">{inv.number}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{inv.total.toLocaleString("fr-FR")} MAD</span>
                            <Badge variant={inv.status === "paid" ? "success" : inv.status === "issued" ? "default" : "outline"}>
                              {inv.status === "paid" ? "Payée" : inv.status === "issued" ? "Émise" : "Brouillon"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">Facture auto-créée via Préparer ou Terminer</p>
                    )}
                    <NewInvoiceDialog
                      patientId={patientId}
                      planId={planId}
                      sessionId={s.id}
                      sessionPrice={s.session_price}
                      treatmentName={plan.primary_service}
                    />
                  </div>
                )}
                {/* Commencer button for scheduled séances */}
                {(s.status === "scheduled" || s.status === "planned") && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => advance.mutate(
                      { sessionId: s.id, to: "in_progress" as SessionStatus },
                      { onSuccess: () => toast.success(`Séance ${s.session_number} commencée`) }
                    )}
                  >
                    Commencer la séance
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DoctorBento({ patientId, patientName, patient, onCollapse }: Props) {
  const { data: ctx } = useSessionContext(patientId);
  const { data: plansData } = usePatientPlans(patientId);
  const plans = plansData?.plans ?? [];
  const { data: programmesData } = usePatientProgrammes(patientId);
  const programmes = programmesData?.programmes ?? [];
  const createProgramme = useCreateProgramme();
  const { data: consultsData } = usePatientConsultations(patientId);
  const consults = consultsData?.consultations ?? [];
  const { data: invoicesData } = useInvoices({ patientId });
  const invoices = invoicesData?.invoices ?? [];
  const [currentStep, setCurrentStep] = useState(0);
  const [newProgTitle, setNewProgTitle] = useState("");
  const [showNewProg, setShowNewProg] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const prepareMut = usePrepareSession();

  if (!ctx?.active) return null;

  const isSeance = ctx.mode === "seance";
  const prepSent = ctx.prep_sent;
  const consentDone = ctx.consent_status === "signed";
  const factureDone = ctx.facture_status === "paid";
  const prepReady = consentDone && factureDone;
  const title = isSeance
    ? `Séance ${ctx.session_number}/${ctx.total_sessions}`
    : "Consultation";
  const subtitle = isSeance ? ctx.plan_title : ctx.treatment;

  const steps: Step[] = [
    {
      key: "identity",
      label: "Identité",
      Icon: IdCard,
      accent: "bg-slate-100 text-slate-700",
      status: `${patient.first_name} ${patient.last_name}`,
      done: true,
    },
    {
      key: "screening",
      label: "Screening",
      Icon: ShieldCheck,
      accent: "bg-emerald-100 text-emerald-700",
      status: ctx.screening_ok ? (ctx.screening_flags > 0 ? `${ctx.screening_flags} drapeaux` : "OK") : "Non évalué",
      done: ctx.screening_ok,
      warn: ctx.screening_flags > 0,
    },
    {
      key: "clinical",
      label: "Dossier clinique",
      Icon: Stethoscope,
      accent: "bg-[var(--primary-lighter)] text-[var(--primary)]",
      status: "Éditable",
      done: true,
    },
    {
      key: "plans",
      label: "Plan général",
      Icon: FileText,
      accent: "bg-teal-100 text-teal-700",
      status: plans.length > 0 ? `${plans.length} plan${plans.length > 1 ? "s" : ""}` : "Aucun",
      done: plans.length > 0,
    },
    {
      key: "consultation",
      label: "Consultation",
      Icon: Stethoscope,
      accent: "bg-violet-100 text-violet-700",
      status: isSeance ? "Séance active" : (consults.length > 0 ? `${consults.length}` : "Aucune"),
      done: consults.length > 0,
      warn: isSeance,
    },
    {
      key: "invoices",
      label: "Factures",
      Icon: Receipt,
      accent: "bg-orange-100 text-orange-700",
      status: invoices.length > 0 ? `${invoices.length}` : "Aucune",
      done: invoices.length > 0,
    },
  ];

  const step = steps[currentStep];
  const prev = () => setCurrentStep(Math.max(0, currentStep - 1));
  const next = () => setCurrentStep(Math.min(steps.length - 1, currentStep + 1));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Session active</p>
            <p className="text-base font-bold text-[var(--text-primary)]">{title} — {subtitle}</p>
          </div>
        </div>
        <TerminerVisiteButton
          patientId={patientId}
          patientName={patientName}
          canTerminate={ctx.can_terminate}
          sessionPrice={ctx.session_price}
          treatment={ctx.treatment}
          mode={ctx.mode}
          planTitle={ctx.plan_title}
          sessionNumber={ctx.session_number}
          totalSessions={ctx.total_sessions}
          soapExists={ctx.soap_exists}
          ordonnanceExists={ctx.ordonnance_exists}
          ordonnanceCount={ctx.ordonnance_count}
          photosBefore={ctx.photos_before}
          photosAfter={ctx.photos_after}
          factureStatus={ctx.facture_status}
          factureAmount={ctx.facture_amount}
        />
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="ml-2 rounded-md p-1 text-emerald-600 hover:bg-emerald-100"
            title="Réduire le wizard"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Préparer la séance — mid-visit handoff to reception */}
      {isSeance && !prepSent && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-amber-800">Préparer la séance</p>
              <p className="text-xs text-amber-700">
                Envoyer le consentement et la facture à la réception pour signature et paiement.
              </p>
              {ctx.session_price != null && ctx.session_price > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Facture : {ctx.treatment} · <span className="font-mono font-bold">{ctx.session_price.toLocaleString("fr-FR")} MAD</span>
                </p>
              )}
            </div>
            <Button
              onClick={() => {
                prepareMut.mutate(patientId, {
                  onSuccess: () => toast.success("Consentement et facture envoyés à la réception"),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
                });
              }}
              disabled={prepareMut.isPending}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {prepareMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Préparer & envoyer
            </Button>
          </div>
        </Card>
      )}

      {/* Prep status — waiting for reception */}
      {isSeance && prepSent && !prepReady && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <p className="text-sm font-bold text-blue-800">En attente de la réception</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700">Consentement</span>
              {consentDone ? (
                <span className="flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Signé</span>
              ) : (
                <span className="text-blue-600">En attente de signature…</span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700">Facture</span>
              {factureDone ? (
                <span className="flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Payé</span>
              ) : (
                <span className="text-blue-600">
                  En attente de paiement{ctx.facture_amount ? ` (${ctx.facture_amount.toLocaleString("fr-FR")} MAD)` : ""}…
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Prep ready — all good */}
      {isSeance && prepSent && prepReady && (
        <Card className="border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Prêt pour le traitement</p>
              <p className="text-xs text-emerald-700">Consentement signé · Facture payée</p>
            </div>
          </div>
        </Card>
      )}

      {/* Step pills */}
      <div className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setCurrentStep(i)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
              i === currentStep
                ? "bg-[var(--primary)] text-white shadow-sm"
                : s.done
                ? "bg-emerald-100 text-emerald-700"
                : s.warn
                ? "bg-amber-100 text-amber-700"
                : "bg-[var(--background)] text-[var(--text-muted)] hover:bg-gray-200"
            )}
          >
            {s.done ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : s.warn ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[10px] font-bold">{i + 1}</span>
            )}
            {s.label}
          </button>
        ))}
      </div>

      {/* Active step content */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", step.accent)}>
              <step.Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Étape {currentStep + 1}/{steps.length} — {step.label}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">{step.status}</p>
            </div>
          </div>
          <Badge variant={step.done ? "success" : step.warn ? "warning" : "outline"}>
            {step.done ? "Fait" : step.warn ? "Attention" : "À faire"}
          </Badge>
        </div>

        {/* Step content */}
        {step.key === "identity" && <IdentityEditCard patient={patient} />}
        {step.key === "screening" && <ScreeningCard patientId={patientId} />}
        {step.key === "clinical" && <ClinicalEditCard patient={patient} />}
        {step.key === "plans" && (
          <div className="space-y-3">
            {/* Programmes */}
            {programmes.map((prog) => (
              <div key={prog.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{prog.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {prog.completed_sessions}/{prog.total_sessions} séances · {prog.total_cost.toLocaleString("fr-FR")} MAD
                    </p>
                  </div>
                  <Badge variant={prog.status === "active" ? "default" : "outline"}>
                    {prog.status === "active" ? "Actif" : "Terminé"}
                  </Badge>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-[var(--primary-lighter)]">
                  {prog.plans.length === 0 && (
                    <p className="text-[11px] text-[var(--text-muted)] py-1">Aucun plan dans ce programme. Ajoutez-en un.</p>
                  )}
                  {prog.plans.map((p) => (
                    <div key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanId(selectedPlanId === p.id ? null : p.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md p-2 text-xs transition-colors",
                          selectedPlanId === p.id ? "bg-[var(--primary-lighter)] border border-[var(--primary)]" : "bg-[var(--background)] hover:bg-gray-100"
                        )}
                      >
                        <div>
                          <span className="font-medium">{p.title}</span>
                          <span className="ml-2 text-[var(--text-muted)]">{p.completed_sessions}/{p.total_sessions} séances</span>
                        </div>
                        {p.estimated_total != null && (
                          <span className="font-mono text-[var(--text-muted)]">{p.estimated_total.toLocaleString("fr-FR")} MAD</span>
                        )}
                      </button>
                      {selectedPlanId === p.id && (
                        <InlinePlanDetail planId={p.id} patientId={patientId} />
                      )}
                    </div>
                  ))}
                  <NewPlanDialog patientId={patientId} programmeId={prog.id} triggerLabel="+ Ajouter un plan" />
                </div>
              </div>
            ))}

            {/* Standalone plans (no programme) */}
            {plans.filter((p) => !p.programme_id).map((plan) => (
              <div key={plan.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-colors",
                    selectedPlanId === plan.id ? "border-[var(--primary)] bg-[var(--primary-lighter)]" : "border-[var(--border)] hover:border-[var(--primary)]"
                  )}
                >
                  <span className="font-medium text-[var(--text-primary)]">{plan.title}</span>
                  <Badge variant={plan.status === "active" ? "default" : "outline"}>
                    {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status}
                  </Badge>
                </button>
                {selectedPlanId === plan.id && (
                  <InlinePlanDetail planId={plan.id} patientId={patientId} />
                )}
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-2">
              {showNewProg ? (
                <div className="flex flex-1 gap-2">
                  <Input
                    placeholder="ex. Rajeunissement visage"
                    value={newProgTitle}
                    onChange={(e) => setNewProgTitle(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newProgTitle.trim()) return;
                      createProgramme.mutate(
                        { patient_id: patientId, title: newProgTitle.trim() },
                        {
                          onSuccess: () => {
                            toast.success("Programme créé");
                            setNewProgTitle("");
                            setShowNewProg(false);
                          },
                        }
                      );
                    }}
                    disabled={createProgramme.isPending}
                  >
                    Créer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewProg(false)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowNewProg(true)}>
                    Nouveau programme
                  </Button>
                  <NewPlanDialog patientId={patientId} />
                </>
              )}
            </div>
          </div>
        )}
        {step.key === "consultation" && (
          isSeance ? (
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-sm font-medium text-amber-800">Séance en cours</p>
              <p className="mt-1 text-xs text-amber-700">
                Les consultations autonomes sont désactivées pendant une séance active. La facturation passe par le plan.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {consults.map((c) => (
                <Link
                  key={c.id}
                  href={`/consultations/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]"
                >
                  <div>
                    <span className="font-mono font-bold">{c.number}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {new Date(c.visit_date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <Badge variant={c.status === "signed" ? "success" : "outline"}>
                    {c.status === "signed" ? "Signée" : "Brouillon"}
                  </Badge>
                </Link>
              ))}
              <NewConsultationDialog patientId={patientId} appointmentId={ctx.appointment_id ?? undefined} />
            </div>
          )
        )}
        {step.key === "invoices" && (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]"
              >
                <span className="font-mono font-bold">{inv.number}</span>
                <span className="font-mono">{inv.total} MAD</span>
              </Link>
            ))}
            <NewInvoiceDialog patientId={patientId} planId={ctx.plan_id ?? undefined} />
          </div>
        )}

        {/* Prev / Next */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--line-soft,_#E2E8F0)] pt-4">
          <Button variant="ghost" size="sm" onClick={prev} disabled={currentStep === 0}>
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <span className="text-xs text-[var(--text-muted)]">{currentStep + 1} / {steps.length}</span>
          {currentStep < steps.length - 1 ? (
            <Button variant="default" size="sm" onClick={next}>
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <TerminerVisiteButton
              patientId={patientId}
              patientName={patientName}
              canTerminate={ctx.can_terminate}
              sessionPrice={ctx.session_price}
              treatment={ctx.treatment}
              mode={ctx.mode}
              planTitle={ctx.plan_title}
              sessionNumber={ctx.session_number}
              totalSessions={ctx.total_sessions}
              soapExists={ctx.soap_exists}
              ordonnanceExists={ctx.ordonnance_exists}
              ordonnanceCount={ctx.ordonnance_count}
              photosBefore={ctx.photos_before}
              photosAfter={ctx.photos_after}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
