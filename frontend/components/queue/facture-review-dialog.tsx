"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, Loader2, Receipt, Plus, Trash2 } from "lucide-react";

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
import { useUpdateInvoice, useIssueInvoice, type InvoiceLineItem } from "@/lib/api/invoices";

interface Props {
  invoiceId: string;
  lineItems: InvoiceLineItem[];
  discount: number;
  total: number;
  currency: string;
  status: string;
  trigger?: React.ReactNode;
}

export function FactureReviewDialog({
  invoiceId,
  lineItems: initialItems,
  discount: initialDiscount,
  total,
  currency,
  status,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InvoiceLineItem[]>(initialItems);
  const [discount, setDiscount] = useState(initialDiscount);

  const update = useUpdateInvoice(invoiceId);
  const issue = useIssueInvoice(invoiceId);

  const subtotal = items.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const computedTotal = Math.max(0, subtotal - discount);

  const updateItem = (idx: number, field: keyof InvoiceLineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { label: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({ line_items: items, discount });
      toast.success("Facture mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleValidate = async () => {
    try {
      await update.mutateAsync({ line_items: items, discount });
      await issue.mutateAsync();
      toast.success("Facture validée — prête pour paiement");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const isDraft = status === "draft";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setItems(initialItems);
          setDiscount(initialDiscount);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-6 text-[11px]">
            <Pencil className="h-3 w-3 mr-1" />
            Réviser
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-600" />
            {isDraft ? "Réviser la facture" : "Détail facture"}
          </DialogTitle>
          <DialogDescription>
            {isDraft
              ? "Vérifiez et ajustez les lignes avant de valider."
              : "Facture validée — en attente de paiement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Line items */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Lignes
            </Label>
            {items.map((li, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={li.label}
                  onChange={(e) => updateItem(idx, "label", e.target.value)}
                  placeholder="Désignation"
                  className="flex-1 text-sm"
                  disabled={!isDraft}
                />
                <Input
                  type="number"
                  min={1}
                  value={li.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                  className="w-16 text-sm text-center"
                  disabled={!isDraft}
                />
                <Input
                  type="number"
                  min={0}
                  value={li.unit_price}
                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                  className="w-24 text-sm text-right font-mono"
                  disabled={!isDraft}
                />
                {isDraft && items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {isDraft && (
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" /> Ajouter une ligne
              </Button>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Sous-total</span>
              <span className="font-mono">{subtotal.toLocaleString("fr-FR")} {currency}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-[var(--text-muted)]">Remise</span>
              {isDraft ? (
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">−</span>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 h-7 text-sm text-right font-mono"
                  />
                  <span className="text-xs text-[var(--text-muted)]">{currency}</span>
                </div>
              ) : (
                <span className="font-mono">− {discount.toLocaleString("fr-FR")} {currency}</span>
              )}
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--border)]">
              <span className="font-bold">Total</span>
              <span className="font-bold font-mono text-lg">
                {computedTotal.toLocaleString("fr-FR")} {currency}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={update.isPending}
              >
                {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enregistrer
              </Button>
              <Button
                onClick={handleValidate}
                disabled={update.isPending || issue.isPending || computedTotal <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1"
              >
                {issue.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Valider la facture
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
