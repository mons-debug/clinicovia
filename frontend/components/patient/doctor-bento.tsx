"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Pill,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { ScreeningCard } from "@/components/patient/screening-card";
import { ClinicalEditCard } from "@/components/patient/clinical-edit-card";
import { PhotosCard } from "@/components/photos/photos-card";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { IdentityEditCard } from "@/components/patient/identity-edit-card";
import { useSessionContext } from "@/lib/api/session-context";
import { usePatientPlans } from "@/lib/api/plans";
import { usePatientConsultations } from "@/lib/api/consultations";
import { useInvoices } from "@/lib/api/invoices";
import type { Patient } from "@/lib/api/patients";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  patientName: string;
  patient: Patient;
}

function AccordionTile({
  title,
  status,
  statusColor,
  Icon,
  accent,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  status: string;
  statusColor: "green" | "amber" | "gray";
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const colors = {
    green: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    gray: "text-[var(--text-muted)] bg-[var(--background)]",
  };

  return (
    <Card className={cn("overflow-hidden transition-all", expanded && "ring-2 ring-[var(--primary)]")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--background)]"
      >
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex-1 text-sm font-bold text-[var(--text-primary)]">{title}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", colors[statusColor])}>
          {statusColor === "green" && <CheckCircle2 className="mr-0.5 inline h-3 w-3" />}
          {statusColor === "amber" && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
          {status}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t border-[var(--line-soft,_#E2E8F0)] p-4">
          {children}
        </div>
      )}
    </Card>
  );
}

export function DoctorBento({ patientId, patientName, patient }: Props) {
  const { data: ctx } = useSessionContext(patientId);
  const { data: plansData } = usePatientPlans(patientId);
  const plans = plansData?.plans ?? [];
  const { data: consultsData } = usePatientConsultations(patientId);
  const consults = consultsData?.consultations ?? [];
  const { data: invoicesData } = useInvoices({ patientId });
  const invoices = invoicesData?.invoices ?? [];
  const [openSection, setOpenSection] = useState<string | null>(null);

  if (!ctx?.active) return null;

  const toggle = (key: string) => setOpenSection(openSection === key ? null : key);

  const isSeance = ctx.mode === "seance";
  const title = isSeance
    ? `Séance ${ctx.session_number}/${ctx.total_sessions}`
    : "Consultation";
  const subtitle = isSeance ? ctx.plan_title : ctx.treatment;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Session active</p>
            <p className="text-base font-bold text-[var(--text-primary)]">
              {title} — {subtitle}
            </p>
          </div>
        </div>
        <TerminerVisiteButton patientId={patientId} patientName={patientName} />
      </div>

      {/* Accordion tiles — click to expand, click again to collapse */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <AccordionTile
          title="Identité patient"
          Icon={ClipboardCheck}
          accent="bg-slate-100 text-slate-700"
          status={patient.first_name + " " + patient.last_name}
          statusColor="gray"
          expanded={openSection === "identity"}
          onToggle={() => toggle("identity")}
        >
          <IdentityEditCard patient={patient} />
        </AccordionTile>

        <AccordionTile
          title="Screening"
          Icon={ShieldCheck}
          accent="bg-emerald-100 text-emerald-700"
          status={ctx.screening_ok ? (ctx.screening_flags > 0 ? `${ctx.screening_flags} drapeaux` : "OK") : "Non évalué"}
          statusColor={ctx.screening_ok ? (ctx.screening_flags > 0 ? "amber" : "green") : "gray"}
          expanded={openSection === "screening"}
          onToggle={() => toggle("screening")}
        >
          <ScreeningCard patientId={patientId} />
        </AccordionTile>

        <AccordionTile
          title="Dossier clinique"
          Icon={Stethoscope}
          accent="bg-[var(--primary-lighter)] text-[var(--primary)]"
          status="Éditable"
          statusColor="gray"
          expanded={openSection === "clinical"}
          onToggle={() => toggle("clinical")}
        >
          <ClinicalEditCard patient={patient} />
        </AccordionTile>

        <AccordionTile
          title="Consentement"
          Icon={ClipboardCheck}
          accent="bg-blue-100 text-blue-700"
          status={ctx.consent_signed ? "Signé" : ctx.consent_pending ? "En attente" : "Aucun"}
          statusColor={ctx.consent_signed ? "green" : ctx.consent_pending ? "amber" : "gray"}
          expanded={openSection === "consent"}
          onToggle={() => toggle("consent")}
        >
          <p className="text-sm text-[var(--text-muted)]">
            {ctx.consent_signed
              ? "Consentement signé. Aucune action requise."
              : "Créez un consentement depuis la section en bas du dossier."}
          </p>
        </AccordionTile>

        <AccordionTile
          title="Photos"
          Icon={Camera}
          accent="bg-amber-100 text-amber-700"
          status={
            ctx.photos_before + ctx.photos_after > 0
              ? `${ctx.photos_before} avant · ${ctx.photos_after} après`
              : "Aucune"
          }
          statusColor={ctx.photos_before > 0 ? "green" : "gray"}
          expanded={openSection === "photos"}
          onToggle={() => toggle("photos")}
        >
          <PhotosCard patientId={patientId} />
        </AccordionTile>

        <AccordionTile
          title="Consultations"
          Icon={Stethoscope}
          accent="bg-violet-100 text-violet-700"
          status={consults.length > 0 ? `${consults.length} note${consults.length > 1 ? "s" : ""}` : "Aucune"}
          statusColor={ctx.soap_exists ? "green" : "gray"}
          expanded={openSection === "soap"}
          onToggle={() => toggle("soap")}
        >
          <div className="space-y-2">
            {consults.map((c) => (
              <Link
                key={c.id}
                href={`/consultations/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]"
              >
                <div>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{c.number}</span>
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {new Date(c.visit_date).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <Badge variant={c.status === "signed" ? "success" : "outline"}>
                  {c.status === "signed" ? "Signée" : c.status === "draft" ? "Brouillon" : c.status}
                </Badge>
              </Link>
            ))}
            <NewConsultationDialog patientId={patientId} />
          </div>
        </AccordionTile>

        <AccordionTile
          title="Ordonnance"
          Icon={Pill}
          accent="bg-rose-100 text-rose-700"
          status={ctx.ordonnance_exists ? "Créée" : "Optionnel"}
          statusColor={ctx.ordonnance_exists ? "green" : "gray"}
          expanded={openSection === "rx"}
          onToggle={() => toggle("rx")}
        >
          <NewPrescriptionDialog patientId={patientId} />
        </AccordionTile>

        <AccordionTile
          title="Plans de traitement"
          Icon={FileText}
          accent="bg-teal-100 text-teal-700"
          status={plans.length > 0 ? `${plans.length} plan${plans.length > 1 ? "s" : ""}` : "Aucun"}
          statusColor={plans.length > 0 ? "green" : "gray"}
          expanded={openSection === "plans"}
          onToggle={() => toggle("plans")}
        >
          <div className="space-y-2">
            {plans.map((plan) => (
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
            <NewPlanDialog patientId={patientId} />
          </div>
        </AccordionTile>

        <AccordionTile
          title="Factures"
          Icon={FileText}
          accent="bg-orange-100 text-orange-700"
          status={invoices.length > 0 ? `${invoices.length} facture${invoices.length > 1 ? "s" : ""}` : "Aucune"}
          statusColor={invoices.length > 0 ? "green" : "gray"}
          expanded={openSection === "invoices"}
          onToggle={() => toggle("invoices")}
        >
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]"
              >
                <span className="font-mono font-bold text-[var(--text-primary)]">{inv.number}</span>
                <span className="font-mono text-[var(--text-primary)]">{inv.total} MAD</span>
              </Link>
            ))}
            <NewInvoiceDialog patientId={patientId} />
          </div>
        </AccordionTile>
      </div>

      {!ctx.can_terminate && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Complétez le <strong>screening</strong> + la <strong>note SOAP</strong> pour terminer.
        </p>
      )}
    </div>
  );
}
