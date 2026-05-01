"use client";

import Link from "next/link";
import {
  Camera,
  ClipboardCheck,
  FileText,
  IdCard,
  Pill,
  Receipt,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { useSessionContext } from "@/lib/api/session-context";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  patientName: string;
}

function BentoCard({
  title,
  status,
  statusColor,
  detail,
  Icon,
  href,
  accent,
  children,
}: {
  title: string;
  status: string;
  statusColor: "green" | "amber" | "gray" | "blue";
  detail?: string;
  Icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent: string;
  children?: React.ReactNode;
}) {
  const colors = {
    green: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    gray: "text-[var(--text-muted)] bg-[var(--background)]",
    blue: "text-blue-700 bg-blue-50",
  };

  const content = (
    <Card className={cn("flex flex-col justify-between p-4 transition-all", href && "cursor-pointer hover:shadow-md hover:border-[var(--primary)]")}>
      <div>
        <div className="flex items-center justify-between">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", colors[statusColor])}>
            {statusColor === "green" && <CheckCircle2 className="h-3 w-3" />}
            {statusColor === "amber" && <AlertTriangle className="h-3 w-3" />}
            {status}
          </span>
        </div>
        <h4 className="mt-3 text-sm font-bold text-[var(--text-primary)]">{title}</h4>
        {detail && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{detail}</p>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
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
    <div className="space-y-4">
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

      {/* Bento grid — 3 columns, doctor's action tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Screening */}
        <BentoCard
          title="Screening"
          Icon={ShieldCheck}
          accent="bg-emerald-100 text-emerald-700"
          status={ctx.screening_ok ? (ctx.screening_flags > 0 ? `${ctx.screening_flags} drapeau${ctx.screening_flags > 1 ? "x" : ""}` : "OK") : "Non évalué"}
          statusColor={ctx.screening_ok ? (ctx.screening_flags > 0 ? "amber" : "green") : "gray"}
          detail="19 contre-indications"
        />

        {/* Consent */}
        <BentoCard
          title="Consentement"
          Icon={ClipboardCheck}
          accent="bg-blue-100 text-blue-700"
          status={ctx.consent_signed ? "Signé" : ctx.consent_pending ? "En attente" : "Aucun"}
          statusColor={ctx.consent_signed ? "green" : ctx.consent_pending ? "amber" : "gray"}
          detail={isSeance ? "Lié au plan" : "Acte spécifique"}
        />

        {/* Photos before */}
        <BentoCard
          title="Photos avant"
          Icon={Camera}
          accent="bg-amber-100 text-amber-700"
          status={ctx.photos_before > 0 ? `${ctx.photos_before} photo${ctx.photos_before > 1 ? "s" : ""}` : "Aucune"}
          statusColor={ctx.photos_before > 0 ? "green" : "gray"}
          detail="Avant traitement"
        />

        {/* SOAP Note */}
        <BentoCard
          title="Note SOAP"
          Icon={Stethoscope}
          accent="bg-[var(--primary-lighter)] text-[var(--primary)]"
          status={ctx.soap_exists ? "Rédigée" : "À rédiger"}
          statusColor={ctx.soap_exists ? "green" : "gray"}
          detail="Subjectif · Objectif · Évaluation · Plan"
          href={ctx.soap_id ? `/consultations/${ctx.soap_id}` : undefined}
        />

        {/* Photos after */}
        <BentoCard
          title="Photos après"
          Icon={Camera}
          accent="bg-violet-100 text-violet-700"
          status={ctx.photos_after > 0 ? `${ctx.photos_after} photo${ctx.photos_after > 1 ? "s" : ""}` : "Aucune"}
          statusColor={ctx.photos_after > 0 ? "green" : "gray"}
          detail="Résultat immédiat"
        />

        {/* Ordonnance */}
        <BentoCard
          title="Ordonnance"
          Icon={Pill}
          accent="bg-rose-100 text-rose-700"
          status={ctx.ordonnance_exists ? "Créée" : "Optionnel"}
          statusColor={ctx.ordonnance_exists ? "green" : "gray"}
          detail="Prescription post-acte"
        />
      </div>

      {/* Quick links row */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/patients/${patientId}`}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <IdCard className="mr-1.5 inline h-3.5 w-3.5" />
          Identité
        </Link>
        <Link
          href={`/patients/${patientId}`}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <FileText className="mr-1.5 inline h-3.5 w-3.5" />
          Dossier clinique
        </Link>
        {isSeance && ctx.plan_id && (
          <Link
            href={`/plans/${ctx.plan_id}`}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Receipt className="mr-1.5 inline h-3.5 w-3.5" />
            Voir le plan
          </Link>
        )}
      </div>

      {!ctx.can_terminate && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Complétez au minimum le <strong>screening</strong> + la <strong>note SOAP</strong> pour pouvoir terminer la visite.
        </p>
      )}
    </div>
  );
}
