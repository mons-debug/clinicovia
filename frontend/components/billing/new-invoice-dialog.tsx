"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";

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

import { useCreateInvoice } from "@/lib/api/invoices";

interface LineRow {
  label: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  patientId: string;
  planId?: string | null;
  sessionId?: string | null;
  sessionPrice?: number | null;
  treatmentName?: string | null;
  triggerLabel?: string;
}

const blankRow: LineRow = { label: "", quantity: 1, unit_price: 0 };

export function NewInvoiceDialog({ patientId, planId, sessionId, sessionPrice, treatmentName, triggerLabel = "Nouvelle facture" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultRow: LineRow = sessionPrice
    ? { label: treatmentName || "Séance", quantity: 1, unit_price: sessionPrice }
    : { ...blankRow };
  const [rows, setRows] = useState<LineRow[]>([defaultRow]);
  const [discount, setDiscount] = useState(0);
  const [tvaRate, setTvaRate] = useState(0);
  const [notes, setNotes] = useState("");

  const create = useCreateInvoice();

  const subtotal = useMemo(
    () => rows.reduce((acc, r) => acc + (r.quantity || 0) * (r.unit_price || 0), 0),
    [rows]
  );
  const afterDiscount = Math.max(0, subtotal - (discount || 0));
  const tva = (afterDiscount * (tvaRate || 0)) / 100;
  const total = afterDiscount + tva;

  const reset = () => {
    setRows([{ ...blankRow }]);
    setDiscount(0);
    setTvaRate(0);
    setNotes("");
  };

  const updateRow = (i: number, patch: Partial<LineRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { ...blankRow }]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const submit = async () => {
    const valid = rows.filter((r) => r.label.trim() && r.quantity > 0 && r.unit_price >= 0);
    if (valid.length === 0) return toast.error("Ajouter au moins une ligne valide");

    try {
      const inv = await create.mutateAsync({
        patient_id: patientId,
        plan_id: planId ?? null,
        session_id: sessionId ?? null,
        line_items: valid.map((r) => ({
          label: r.label.trim(),
          quantity: r.quantity,
          unit_price: r.unit_price,
        })),
        discount,
        tva_rate: tvaRate,
        notes: notes.trim() || null,
      });
      toast.success("Brouillon créé");
      reset();
      setOpen(false);
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
          <DialogTitle>Nouvelle facture</DialogTitle>
          <DialogDescription>
            Crée un brouillon. Le numéro FAC-AAAA-NNNN est attribué à l&apos;émission.
          </DialogDescription>
        </DialogHeader>

        {/* Line items */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            <div className="col-span-6">Désignation</div>
            <div className="col-span-2 text-right">Qté</div>
            <div className="col-span-3 text-right">Prix unitaire</div>
            <div className="col-span-1" />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <Input
                  placeholder="ex. Botox glabelle"
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={r.quantity}
                  onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={r.unit_price}
                  onChange={(e) => updateRow(i, { unit_price: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus className="h-3 w-3" /> Ajouter une ligne
          </Button>
        </div>

        {/* Adjustments */}
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--line-soft,_#E2E8F0)] pt-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="discount">Remise (MAD)</Label>
            <Input
              id="discount"
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tva">TVA (%)</Label>
            <Input
              id="tva"
              type="number"
              min={0}
              max={30}
              step={1}
              value={tvaRate}
              onChange={(e) => setTvaRate(Number(e.target.value) || 0)}
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              Actes médicaux exonérés en général. Laissez à 0 sauf prescription contraire.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes-inv">Notes</Label>
            <Input
              id="notes-inv"
              placeholder="Optionnel"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Sous-total</span>
            <span className="font-mono">{subtotal.toLocaleString("fr-FR")} MAD</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[var(--danger)]">
              <span>Remise</span>
              <span className="font-mono">− {discount.toLocaleString("fr-FR")} MAD</span>
            </div>
          )}
          {tva > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">TVA {tvaRate}%</span>
              <span className="font-mono">{tva.toLocaleString("fr-FR")} MAD</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[var(--line-soft,_#E2E8F0)] pt-2 text-base font-bold">
            <span>TOTAL</span>
            <span className="font-mono">{total.toLocaleString("fr-FR")} MAD</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Créer le brouillon
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
