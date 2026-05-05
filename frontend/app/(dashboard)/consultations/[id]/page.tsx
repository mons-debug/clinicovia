"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewAppointmentDialog } from "@/components/calendar/new-appointment-dialog";
import {
  useConsultation,
  useUpdateConsultation,
  useSignConsultation,
  type ConsultationStatus,
} from "@/lib/api/consultations";
import { usePatient } from "@/lib/api/patients";

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  draft: "Brouillon",
  signed: "Signée",
  cancelled: "Annulée",
};
const STATUS_VARIANT: Record<ConsultationStatus, "outline" | "success" | "destructive"> = {
  draft: "outline",
  signed: "success",
  cancelled: "destructive",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function ConsultationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: cons, isLoading, isError } = useConsultation(id);

  const updateMut = useUpdateConsultation(id);
  const signMut = useSignConsultation(id);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [planText, setPlanText] = useState("");

  useEffect(() => {
    if (cons) {
      setChiefComplaint(cons.chief_complaint ?? "");
      setSubjective(cons.subjective ?? "");
      setObjective(cons.objective ?? "");
      setAssessment(cons.assessment ?? "");
      setPlanText(cons.plan_text ?? "");
    }
  }, [cons]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }
  if (isError || !cons) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <p className="text-sm text-[var(--text-muted)]">Consultation introuvable.</p>
      </div>
    );
  }

  const isDraft = cons.status === "draft";

  // Suggested follow-up date: +14 days from today (control / next session default)
  const suggestedDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })();

  const save = async () => {
    if (!isDraft) return;
    try {
      await updateMut.mutateAsync({
        chief_complaint: chiefComplaint.trim() || null,
        subjective: subjective.trim() || null,
        objective: objective.trim() || null,
        assessment: assessment.trim() || null,
        plan_text: planText.trim() || null,
      });
      toast.success("Note enregistrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const sign = async () => {
    try {
      await save(); // ensure latest content is persisted
      await signMut.mutateAsync();
      toast.success("Consultation signée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/patients/${cons.patient_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au dossier
      </Link>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--primary)]" />
              <h1 className="font-mono text-xl font-bold text-[var(--text-primary)]">{cons.number}</h1>
              <Badge variant={STATUS_VARIANT[cons.status]}>{STATUS_LABEL[cons.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Visite du {fmtDate(cons.visit_date)}
              {cons.signed_at && ` · signée le ${fmtDate(cons.signed_at)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FollowUpButton consultation={cons} suggestedDate={suggestedDate} />
            {isDraft && (
              <>
                <Button variant="ghost" onClick={save} disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Enregistrer
                </Button>
                <Button onClick={sign} disabled={signMut.isPending}>
                  {signMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Signer
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Body */}
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="cc">Motif principal</Label>
          <Input
            id="cc"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            disabled={!isDraft}
          />
        </div>

        {[
          { id: "s", label: "S — Subjectif", value: subjective, set: setSubjective },
          { id: "o", label: "O — Objectif", value: objective, set: setObjective },
          { id: "a", label: "A — Évaluation", value: assessment, set: setAssessment },
          { id: "p", label: "P — Plan", value: planText, set: setPlanText },
        ].map(({ id, label, value, set }) => (
          <div key={id} className="space-y-2">
            <Label htmlFor={id} className="text-xs uppercase tracking-wide text-[var(--primary)]">{label}</Label>
            <textarea
              id={id}
              value={value}
              onChange={(e) => set(e.target.value)}
              disabled={!isDraft}
              rows={4}
              className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:bg-[var(--background)] disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
            />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Follow-up booking trigger ───────────────────────────────────────
// Wraps NewAppointmentDialog with the consultation's patient pre-filled
// and a sensible default visit date (+14 days). Shown on every consultation
// regardless of draft / signed — the doctor's last move is "réservez le retour".

function FollowUpButton({
  consultation,
  suggestedDate,
}: {
  consultation: { patient_id: string };
  suggestedDate: string;
}) {
  const { data: patient } = usePatient(consultation.patient_id);
  const label = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";

  return (
    <NewAppointmentDialog
      isoDate={suggestedDate}
      triggerLabel="Programmer prochain RDV"
      triggerVariant="outline"
      prefillPatientId={consultation.patient_id}
      prefillPatientLabel={label}
      prefillKind="control"
    />
  );
}
