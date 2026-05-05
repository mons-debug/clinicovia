"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Stethoscope, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useUpdatePatient, type Patient } from "@/lib/api/patients";

interface Props {
  patient: Patient;
}

const FITZPATRICK_OPTIONS = ["I", "II", "III", "IV", "V", "VI"];

export function CompleteDossierCard({ patient }: Props) {
  const qc = useQueryClient();
  const updateMut = useUpdatePatient(patient.id);

  // Local form state — pre-fills from current patient values
  const [gender, setGender] = useState<string>(patient.gender ?? "");
  const [dob, setDob] = useState<string>(patient.date_of_birth ?? "");
  const [cnie, setCnie] = useState<string>(patient.cnie ?? "");
  const [weight, setWeight] = useState<string>(patient.weight_kg != null ? String(patient.weight_kg) : "");
  const [height, setHeight] = useState<string>(patient.height_cm != null ? String(patient.height_cm) : "");
  const [smoker, setSmoker] = useState<string>(
    patient.smoker == null ? "" : patient.smoker ? "yes" : "no"
  );
  const [fitzpatrick, setFitzpatrick] = useState<string>(patient.fitzpatrick ?? "");
  const [internalNotes, setInternalNotes] = useState<string>(patient.internal_notes ?? "");

  // Re-pull when the patient prop changes (e.g. after another mutation)
  useEffect(() => {
    setGender(patient.gender ?? "");
    setDob(patient.date_of_birth ?? "");
    setCnie(patient.cnie ?? "");
    setWeight(patient.weight_kg != null ? String(patient.weight_kg) : "");
    setHeight(patient.height_cm != null ? String(patient.height_cm) : "");
    setSmoker(patient.smoker == null ? "" : patient.smoker ? "yes" : "no");
    setFitzpatrick(patient.fitzpatrick ?? "");
    setInternalNotes(patient.internal_notes ?? "");
  }, [patient]);

  const submit = async (markActive: boolean) => {
    try {
      await updateMut.mutateAsync({
        gender: gender || null,
        date_of_birth: dob || null,
        cnie: cnie.trim() || null,
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        smoker: smoker === "" ? null : smoker === "yes",
        fitzpatrick: fitzpatrick || null,
        internal_notes: internalNotes.trim() || null,
        ...(markActive ? { intake_status: "active" } : {}),
      });
      toast.success(markActive ? "Dossier complété · patient en actif" : "Dossier mis à jour");
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  // Live BMI preview
  const w = Number(weight);
  const h = Number(height);
  const bmiPreview =
    w > 0 && h > 0 ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null;

  return (
    <div className="rounded-xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary-lighter)]/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
            <Stethoscope className="h-4 w-4 text-[var(--primary)]" />
            Compléter le dossier clinique
          </h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            La réception a rempli l&apos;essentiel. Renseignez la partie clinique au fauteuil — elle alimente factures, ordonnances et photos.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cd-gender">Sexe</Label>
          <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)}>
            <SelectTrigger id="cd-gender"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="female">Femme</SelectItem>
              <SelectItem value="male">Homme</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-dob">Date de naissance</Label>
          <Input id="cd-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-cnie">CNIE</Label>
          <Input id="cd-cnie" placeholder="ex. AB123456" value={cnie} onChange={(e) => setCnie(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cd-weight">Poids (kg)</Label>
          <Input id="cd-weight" type="number" min={0} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-height">Taille (cm)</Label>
          <Input id="cd-height" type="number" min={0} value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>IMC (calculé)</Label>
          <div className="flex h-10 items-center rounded-md border border-[var(--border)] bg-white px-3 font-mono text-sm">
            {bmiPreview ?? "—"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cd-fitz">Phototype Fitzpatrick</Label>
          <Select value={fitzpatrick || "unset"} onValueChange={(v) => setFitzpatrick(v === "unset" ? "" : v)}>
            <SelectTrigger id="cd-fitz"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              {FITZPATRICK_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-smoker">Tabac</Label>
          <Select value={smoker || "unset"} onValueChange={(v) => setSmoker(v === "unset" ? "" : v)}>
            <SelectTrigger id="cd-smoker"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="no">Non</SelectItem>
              <SelectItem value="yes">Oui</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-3 space-y-2">
          <Label htmlFor="cd-notes">Notes cliniques</Label>
          <Input
            id="cd-notes"
            placeholder="Allergies, antécédents, traitements en cours…"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => submit(false)} disabled={updateMut.isPending}>
          {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Enregistrer
        </Button>
        <Button onClick={() => submit(true)} disabled={updateMut.isPending}>
          <CheckCircle2 className="h-3 w-3" />
          Marquer dossier complet
        </Button>
      </div>
    </div>
  );
}
