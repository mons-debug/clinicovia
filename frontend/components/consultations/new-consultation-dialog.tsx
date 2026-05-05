"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useCreateConsultation } from "@/lib/api/consultations";

interface Props {
  patientId: string;
  appointmentId?: string;
  triggerLabel?: string;
}

export function NewConsultationDialog({ patientId, appointmentId, triggerLabel = "Nouvelle consultation" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [planText, setPlanText] = useState("");

  const create = useCreateConsultation();

  const reset = () => {
    setChiefComplaint(""); setSubjective(""); setObjective("");
    setAssessment(""); setPlanText("");
  };

  const submit = async () => {
    if (!subjective.trim() && !objective.trim()) {
      return toast.error("Renseigner au moins S ou O");
    }
    try {
      const c = await create.mutateAsync({
        patient_id: patientId,
        appointment_id: appointmentId ?? null,
        chief_complaint: chiefComplaint.trim() || null,
        subjective: subjective.trim() || null,
        objective: objective.trim() || null,
        assessment: assessment.trim() || null,
        plan_text: planText.trim() || null,
      });
      toast.success("Consultation créée (brouillon)");
      reset();
      setOpen(false);
      router.push(`/consultations/${c.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--primary)]" />
            Nouvelle consultation
          </DialogTitle>
          <DialogDescription>
            Note SOAP. Le numéro CONS-AAAA-NNNN est attribué à la signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cc">Motif principal</Label>
            <Input
              id="cc"
              placeholder="ex. Sillons naso-géniens · Botox glabelle"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
          </div>

          {[
            { id: "s", label: "S — Subjectif (ce que dit le patient)", value: subjective, set: setSubjective, ph: "Demande, antécédents pertinents, ressenti…" },
            { id: "o", label: "O — Objectif (examen clinique)", value: objective, set: setObjective, ph: "Inspection, palpation, mesures, photos…" },
            { id: "a", label: "A — Évaluation / diagnostic", value: assessment, set: setAssessment, ph: "Indication, contre-indications, score…" },
            { id: "p", label: "P — Plan (geste réalisé / prévu)", value: planText, set: setPlanText, ph: "Acte, posologie, contrôle, recall…" },
          ].map(({ id, label, value, set, ph }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs">{label}</Label>
              <textarea
                id={id}
                placeholder={ph}
                value={value}
                onChange={(e) => set(e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Création…</> : <><Plus className="h-3 w-3" />Créer le brouillon</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
