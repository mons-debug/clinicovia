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
import { usePatientPlans, usePatientProgrammes, useCreateProgramme } from "@/lib/api/plans";
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
                  {prog.plans.map((p) => (
                    <Link
                      key={p.id}
                      href={`/plans/${p.id}`}
                      className="flex items-center justify-between rounded-md bg-[var(--background)] p-2 text-xs hover:bg-gray-100"
                    >
                      <div>
                        <span className="font-medium">{p.title}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{p.completed_sessions}/{p.total_sessions} séances</span>
                      </div>
                      {p.estimated_total && (
                        <span className="font-mono text-[var(--text-muted)]">{p.estimated_total.toLocaleString("fr-FR")} MAD</span>
                      )}
                    </Link>
                  ))}
                  <NewPlanDialog patientId={patientId} triggerLabel="+ Ajouter un plan" />
                </div>
              </div>
            ))}

            {/* Standalone plans (no programme) */}
            {plans.filter((p) => !p.programme_id).map((plan) => (
              <Link
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]"
              >
                <span className="font-medium text-[var(--text-primary)]">{plan.title}</span>
                <Badge variant={plan.status === "active" ? "default" : "outline"}>
                  {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status}
                </Badge>
              </Link>
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
