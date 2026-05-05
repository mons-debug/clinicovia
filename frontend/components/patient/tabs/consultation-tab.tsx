"use client";

import Link from "next/link";
import { ClipboardList, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import { usePatientConsultations, type ConsultationStatus } from "@/lib/api/consultations";
import { useSessionContext } from "@/lib/api/session-context";

interface Props {
  patientId: string;
}

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  draft: "Brouillon",
  signed: "Signée",
  cancelled: "Annulée",
};

export function ConsultationTab({ patientId }: Props) {
  const { data: ctx } = useSessionContext(patientId);
  const { data: consultsData } = usePatientConsultations(patientId);
  const consults = consultsData?.consultations ?? [];

  const isLocked = ctx?.active && ctx.mode === "seance";

  if (isLocked) {
    return (
      <Card className="p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
        <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
          Séance en cours
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Les consultations autonomes sont désactivées pendant une séance active.
          La facturation passe par le plan de traitement.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Consultations</h3>
        <NewConsultationDialog patientId={patientId} />
      </div>

      {consults.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">Aucune consultation</p>
          <p className="text-xs text-[var(--text-muted)]">Note SOAP pour consultation autonome (hors plan).</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {consults.map((c) => (
            <Link
              key={c.id}
              href={`/consultations/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white p-4 transition-colors hover:border-[var(--primary)]"
            >
              <div>
                <span className="font-mono font-bold text-[var(--text-primary)]">{c.number}</span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {new Date(c.visit_date).toLocaleDateString("fr-FR")}
                </span>
                {c.chief_complaint && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{c.chief_complaint}</p>
                )}
              </div>
              <Badge variant={c.status === "signed" ? "success" : c.status === "cancelled" ? "destructive" : "outline"}>
                {STATUS_LABEL[c.status]}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
