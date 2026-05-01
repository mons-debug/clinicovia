"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { useSessionContext, type SessionContext } from "@/lib/api/session-context";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  patientName: string;
}

function CheckItem({
  done,
  warn,
  label,
  detail,
  href,
  Icon,
}: {
  done: boolean;
  warn?: boolean;
  label: string;
  detail?: string;
  href?: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        done ? "bg-emerald-50" : warn ? "bg-amber-50" : "bg-[var(--background)] hover:bg-gray-100"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : warn ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", done ? "text-emerald-600" : "text-[var(--text-secondary)]")} />
      <span className={cn("flex-1 font-medium", done ? "text-emerald-800" : "text-[var(--text-primary)]")}>
        {label}
      </span>
      {detail && (
        <span className="text-[11px] text-[var(--text-muted)]">{detail}</span>
      )}
    </div>
  );

  if (href && !done) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function SessionChecklist({ patientId, patientName }: Props) {
  const { data: ctx } = useSessionContext(patientId);

  if (!ctx?.active) return null;

  const isSeance = ctx.mode === "seance";
  const title = isSeance
    ? `Séance ${ctx.session_number}/${ctx.total_sessions} — ${ctx.plan_title}`
    : `Consultation — ${ctx.treatment || "Acte"}`;

  return (
    <Card className="border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Session active
          </p>
          <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {title}
          </h3>
        </div>
        <TerminerVisiteButton
          patientId={patientId}
          patientName={patientName}
        />
      </div>

      <div className="mt-3 space-y-1">
        <CheckItem
          done={ctx.screening_ok}
          warn={ctx.screening_flags > 0}
          label="Screening pré-traitement"
          detail={
            ctx.screening_ok
              ? ctx.screening_flags > 0
                ? `${ctx.screening_flags} drapeau${ctx.screening_flags > 1 ? "x" : ""}`
                : "OK"
              : "Non évalué"
          }
          Icon={ShieldCheck}
        />

        <CheckItem
          done={ctx.consent_signed}
          warn={ctx.consent_pending}
          label="Consentement"
          detail={
            ctx.consent_signed
              ? "Signé"
              : ctx.consent_pending
              ? "En attente de signature"
              : "Aucun"
          }
          Icon={ClipboardCheck}
        />

        <CheckItem
          done={ctx.photos_before > 0}
          label="Photos avant"
          detail={ctx.photos_before > 0 ? `${ctx.photos_before} photo${ctx.photos_before > 1 ? "s" : ""}` : "Aucune"}
          Icon={Camera}
        />

        <CheckItem
          done={ctx.soap_exists}
          label="Note SOAP"
          detail={ctx.soap_exists ? "Rédigée" : "À rédiger"}
          href={ctx.soap_id ? `/consultations/${ctx.soap_id}` : undefined}
          Icon={Stethoscope}
        />

        <CheckItem
          done={ctx.photos_after > 0}
          label="Photos après"
          detail={ctx.photos_after > 0 ? `${ctx.photos_after} photo${ctx.photos_after > 1 ? "s" : ""}` : "Aucune"}
          Icon={Camera}
        />

        <CheckItem
          done={ctx.ordonnance_exists}
          label="Ordonnance"
          detail={ctx.ordonnance_exists ? "Créée" : "Optionnel"}
          Icon={FileText}
        />
      </div>

      {!ctx.can_terminate && (
        <p className="mt-3 text-[11px] text-amber-700">
          Complétez au minimum le screening + la note SOAP pour pouvoir terminer la visite.
        </p>
      )}
    </Card>
  );
}
