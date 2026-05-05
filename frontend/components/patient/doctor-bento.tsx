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
import { Badge } from "@/components/ui/badge";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { ScreeningCard } from "@/components/patient/screening-card";
import { ClinicalEditCard } from "@/components/patient/clinical-edit-card";
import { IdentityEditCard } from "@/components/patient/identity-edit-card";
import { ProgrammePlansSection } from "@/components/plans/programme-plans-section";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import { useSessionContext } from "@/lib/api/session-context";
import { usePatientPlans } from "@/lib/api/plans";
import { usePatientConsultations } from "@/lib/api/consultations";
import { useInvoices } from "@/lib/api/invoices";
import type { Patient } from "@/lib/api/patients";
import { cn } from "@/lib/utils";
import { Clock, X } from "lucide-react";

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
  const { data: consultsData } = usePatientConsultations(patientId);
  const consults = consultsData?.consultations ?? [];
  const { data: invoicesData } = useInvoices({ patientId });
  const invoices = invoicesData?.invoices ?? [];
  const [currentStep, setCurrentStep] = useState(0);
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
    <div className="space-y-4">
      {/* Session Header — compact bar with accent line */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary)]" />

        <div className="flex items-center justify-between px-5 py-3.5 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-lighter)]">
              <Stethoscope className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {title} — {subtitle}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              intervalValue={ctx.interval_value}
              soapExists={ctx.soap_exists}
              ordonnanceExists={ctx.ordonnance_exists}
              ordonnanceCount={ctx.ordonnance_count}
              photosBefore={ctx.photos_before}
              photosAfter={ctx.photos_after}
              screeningOk={ctx.screening_ok}
              consentSigned={ctx.consent_signed}
              consentPending={ctx.consent_pending}
              factureStatus={ctx.facture_status}
              factureAmount={ctx.facture_amount}
            />
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]"
                title="Réduire le wizard"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Prep status — compact inline when séance active */}
      {isSeance && prepSent && !prepReady && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs">
          <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
          <span className="font-medium text-blue-800">En attente réception :</span>
          <span className={consentDone ? "text-emerald-700 font-medium" : "text-blue-600"}>
            {consentDone ? "Consentement ✓" : "Consentement..."}
          </span>
          <span className={factureDone ? "text-emerald-700 font-medium" : "text-blue-600"}>
            {factureDone ? "Facture ✓" : `Facture (${ctx.facture_amount?.toLocaleString("fr-FR") || "0"} MAD)...`}
          </span>
        </div>
      )}
      {isSeance && prepSent && prepReady && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-emerald-800">Prêt pour le traitement — Consentement signé · Facture payée</span>
        </div>
      )}

      {/* Step Progress Indicator */}
      <div className="rounded-xl border border-[var(--border)] bg-white px-5 py-3">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => {
            const isActive = i === currentStep;
            const isCompleted = s.done;
            const isWarning = s.warn && !s.done;

            return (
              <div key={s.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : isCompleted
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : isWarning
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {isActive ? (
                    <s.Icon className="h-3.5 w-3.5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isWarning ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "mx-1 h-px w-4 lg:w-6",
                    steps[i].done ? "bg-emerald-300" : "bg-[var(--border)]"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Content */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        {/* Step header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", step.accent)}>
              <step.Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{step.label}</h3>
              <p className="text-xs text-[var(--text-muted)]">{step.status}</p>
            </div>
          </div>
          <Badge variant={step.done ? "success" : step.warn ? "warning" : "outline"} className="text-[11px]">
            {step.done ? "Complété" : step.warn ? "Attention" : "À faire"}
          </Badge>
        </div>

        {/* Step content area — spacious */}
        <div className="min-h-[180px]">
          {step.key === "identity" && <IdentityEditCard patient={patient} />}
          {step.key === "screening" && <ScreeningCard patientId={patientId} />}
          {step.key === "clinical" && <ClinicalEditCard patient={patient} />}
          {step.key === "plans" && (
            <ProgrammePlansSection patientId={patientId} inline />
          )}
          {step.key === "consultation" && (
            isSeance ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-amber-50 p-8 text-center">
                <Stethoscope className="mb-3 h-8 w-8 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Séance en cours</p>
                <p className="mt-1 max-w-sm text-xs text-amber-700">
                  Les consultations autonomes sont désactivées pendant une séance active. La facturation passe par le plan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {consults.map((c) => (
                  <Link
                    key={c.id}
                    href={`/consultations/${c.id}`}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4 text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--background)]"
                  >
                    <div>
                      <span className="font-mono font-bold">{c.number}</span>
                      <span className="ml-3 text-xs text-[var(--text-muted)]">
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
            <div className="space-y-3">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4 text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--background)]"
                >
                  <span className="font-mono font-bold">{inv.number}</span>
                  <span className="font-mono text-[var(--text-secondary)]">{inv.total} MAD</span>
                </Link>
              ))}
              <NewInvoiceDialog patientId={patientId} planId={ctx.plan_id ?? undefined} />
            </div>
          )}
        </div>

        {/* Navigation: Previous / Step counter / Next */}
        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <Button variant="ghost" size="sm" onClick={prev} disabled={currentStep === 0} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  i === currentStep
                    ? "w-5 bg-[var(--primary)]"
                    : steps[i].done
                    ? "bg-emerald-400"
                    : "bg-[var(--border)]"
                )}
              />
            ))}
          </div>
          {currentStep < steps.length - 1 ? (
            <Button variant="default" size="sm" onClick={next} className="gap-1.5">
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
              intervalValue={ctx.interval_value}
              soapExists={ctx.soap_exists}
              ordonnanceExists={ctx.ordonnance_exists}
              ordonnanceCount={ctx.ordonnance_count}
              photosBefore={ctx.photos_before}
              photosAfter={ctx.photos_after}
              screeningOk={ctx.screening_ok}
              consentSigned={ctx.consent_signed}
              consentPending={ctx.consent_pending}
              factureStatus={ctx.facture_status}
              factureAmount={ctx.facture_amount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
