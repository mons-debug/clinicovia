"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Pill } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useCreatePrescription, useDrugs, useSeedDrugs, type Drug, type PrescriptionLine } from "@/lib/api/prescriptions";

interface Props {
  patientId: string;
  triggerLabel?: string;
}

const blank: PrescriptionLine = { dci: "", posology: "" };

export function NewPrescriptionDialog({ patientId, triggerLabel = "Nouvelle ordonnance" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [renewable, setRenewable] = useState(false);
  const [lines, setLines] = useState<PrescriptionLine[]>([{ ...blank }]);
  const [search, setSearch] = useState("");

  const create = useCreatePrescription();
  const seed = useSeedDrugs();
  const { data: drugsData } = useDrugs(search || undefined);
  const drugs = drugsData?.drugs ?? [];

  const reset = () => {
    setDiagnosis("");
    setNotes("");
    setRenewable(false);
    setLines([{ ...blank }]);
    setSearch("");
  };

  const updateLine = (i: number, patch: Partial<PrescriptionLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, { ...blank }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const insertDrug = (i: number, d: Drug) => {
    updateLine(i, {
      dci: d.dci,
      brand: d.brand ?? null,
      form: d.form,
      strength: d.strength ?? null,
      posology: d.default_posology ?? "",
      duration: d.default_duration ?? null,
    });
    setSearch("");
  };

  const submit = async () => {
    const valid = lines.filter((l) => l.dci.trim() && l.posology.trim());
    if (valid.length === 0) return toast.error("Ajouter au moins une ligne (DCI + posologie)");

    try {
      const rx = await create.mutateAsync({
        patient_id: patientId,
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
        renewable,
        lines: valid,
      });
      toast.success("Ordonnance créée (brouillon)");
      reset();
      setOpen(false);
      router.push(`/prescriptions/${rx.id}`);
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouvelle ordonnance</DialogTitle>
          <DialogDescription>
            Crée un brouillon. Le numéro ORD-AAAA-NNNN est attribué à la signature.
          </DialogDescription>
        </DialogHeader>

        {/* Indication */}
        <div className="space-y-2">
          <Label htmlFor="diagnosis">Indication / diagnostic</Label>
          <Input
            id="diagnosis"
            placeholder="ex. Suite à acte de Botox glabelle"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </div>

        {/* Drug catalog quick-search */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="drug-search">Catalogue (optionnel)</Label>
            {drugs.length === 0 && !search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seed.mutate(undefined, { onSuccess: (r) => toast.success(`${r.inserted} médicaments importés`) })}
                disabled={seed.isPending}
              >
                {seed.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pill className="h-3 w-3" />}
                Importer DCI Maroc
              </Button>
            )}
          </div>
          <Input
            id="drug-search"
            placeholder="Rechercher par DCI ou marque (ex. paracétamol, doliprane)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && drugs.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-[var(--border)] bg-white">
              {drugs.slice(0, 10).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => insertDrug(lines.length - 1, d)}
                  className="flex w-full items-center justify-between border-b border-[var(--line-soft,_#E2E8F0)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                >
                  <span>
                    <span className="font-medium">{d.dci}</span>
                    {d.strength && <span className="ml-1 text-[var(--text-secondary)]">{d.strength}</span>}
                    {d.brand && <span className="ml-2 text-xs italic text-[var(--text-muted)]">({d.brand})</span>}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{d.drug_class}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] font-mono text-xs font-bold text-[var(--primary)]">
                  {i + 1}
                </span>
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5 space-y-1">
                    <Label htmlFor={`dci-${i}`} className="text-xs">DCI / médicament</Label>
                    <Input
                      id={`dci-${i}`}
                      placeholder="paracétamol"
                      value={l.dci}
                      onChange={(e) => updateLine(i, { dci: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label htmlFor={`strength-${i}`} className="text-xs">Dosage</Label>
                    <Input
                      id={`strength-${i}`}
                      placeholder="500 mg"
                      value={l.strength ?? ""}
                      onChange={(e) => updateLine(i, { strength: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <Label htmlFor={`brand-${i}`} className="text-xs">Marque (optionnel)</Label>
                    <Input
                      id={`brand-${i}`}
                      placeholder="Doliprane"
                      value={l.brand ?? ""}
                      onChange={(e) => updateLine(i, { brand: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-8 space-y-1">
                    <Label htmlFor={`posology-${i}`} className="text-xs">Posologie</Label>
                    <Input
                      id={`posology-${i}`}
                      placeholder="1 cp × 3/j au cours du repas"
                      value={l.posology}
                      onChange={(e) => updateLine(i, { posology: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <Label htmlFor={`duration-${i}`} className="text-xs">Durée</Label>
                    <Input
                      id={`duration-${i}`}
                      placeholder="3 j"
                      value={l.duration ?? ""}
                      onChange={(e) => updateLine(i, { duration: e.target.value })}
                    />
                  </div>
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="mt-2 text-[var(--text-muted)] hover:text-[var(--danger)]"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addLine}>
            <Plus className="h-3 w-3" /> Ajouter une ligne
          </Button>
        </div>

        {/* Footer fields */}
        <div className="space-y-2">
          <Label htmlFor="rx-notes">Notes</Label>
          <Input
            id="rx-notes"
            placeholder="Notes complémentaires (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="renewable"
            checked={renewable}
            onCheckedChange={(v) => setRenewable(v === true)}
          />
          <Label htmlFor="renewable" className="text-sm">Ordonnance renouvelable</Label>
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
