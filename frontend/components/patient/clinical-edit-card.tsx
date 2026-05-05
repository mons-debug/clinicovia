"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Stethoscope, Loader2, Save, Lock } from "lucide-react";

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
import { useAuthStore } from "@/stores/auth-store";

interface Props {
  patient: Patient;
}

// Reading A: clinical fields are doctor's territory.
// Reception / sales can read but not edit. Owner overrides everything.
const EDIT_ROLES = new Set([
  "clinic_owner",
  "manager",
  "doctor",
  "super_admin",
]);

const FITZPATRICK_OPTIONS = ["I", "II", "III", "IV", "V", "VI"];

export function ClinicalEditCard({ patient }: Props) {
  const role = useAuthStore((s) => s.currentRole);
  const canEdit = !!role && EDIT_ROLES.has(role);
  const updateMut = useUpdatePatient(patient.id);

  const [weight, setWeight] = useState<string>(patient.weight_kg != null ? String(patient.weight_kg) : "");
  const [height, setHeight] = useState<string>(patient.height_cm != null ? String(patient.height_cm) : "");
  const [smoker, setSmoker] = useState<string>(patient.smoker == null ? "" : patient.smoker ? "yes" : "no");
  const [fitzpatrick, setFitzpatrick] = useState<string>(patient.fitzpatrick ?? "");
  const [internalNotes, setInternalNotes] = useState<string>(patient.internal_notes ?? "");

  useEffect(() => {
    setWeight(patient.weight_kg != null ? String(patient.weight_kg) : "");
    setHeight(patient.height_cm != null ? String(patient.height_cm) : "");
    setSmoker(patient.smoker == null ? "" : patient.smoker ? "yes" : "no");
    setFitzpatrick(patient.fitzpatrick ?? "");
    setInternalNotes(patient.internal_notes ?? "");
  }, [patient]);

  const w = Number(weight);
  const h = Number(height);
  const bmi = w > 0 && h > 0 ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null;

  const submit = async () => {
    try {
      await updateMut.mutateAsync({
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        smoker: smoker === "" ? null : smoker === "yes",
        fitzpatrick: fitzpatrick || null,
        internal_notes: internalNotes.trim() || null,
      });
      toast.success("Dossier clinique enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const inputProps = canEdit ? {} : { disabled: true };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <Stethoscope className="h-4 w-4 text-[var(--primary)]" />
          Dossier clinique
        </h3>
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Lock className="h-3 w-3" /> Lecture seule (réception)
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cl-weight">Poids (kg)</Label>
          <Input id="cl-weight" type="number" min={0} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-height">Taille (cm)</Label>
          <Input id="cl-height" type="number" min={0} value={height} onChange={(e) => setHeight(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label>IMC (calculé)</Label>
          <div className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-sm">
            {bmi ?? "—"}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-fitz">Phototype Fitzpatrick</Label>
          <Select value={fitzpatrick || "unset"} onValueChange={(v) => setFitzpatrick(v === "unset" ? "" : v)} disabled={!canEdit}>
            <SelectTrigger id="cl-fitz"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              {FITZPATRICK_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-smoker">Tabac</Label>
          <Select value={smoker || "unset"} onValueChange={(v) => setSmoker(v === "unset" ? "" : v)} disabled={!canEdit}>
            <SelectTrigger id="cl-smoker"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="no">Non</SelectItem>
              <SelectItem value="yes">Oui</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="cl-notes">Antécédents · allergies · traitements en cours</Label>
          <textarea
            id="cl-notes"
            rows={3}
            disabled={!canEdit}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-[var(--text-muted)] disabled:bg-[var(--background)] disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="ex. Allergie pénicilline · grossesse en cours · anticoagulants…"
          />
        </div>
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
