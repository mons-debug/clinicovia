"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useInvoice,
  useIssueInvoice,
  useRecordPayment,
  useCancelInvoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/lib/api/invoices";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  issued: "Émise",
  partial: "Partiel",
  paid: "Payée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};
const STATUS_VARIANT: Record<InvoiceStatus, "default" | "outline" | "warning" | "success" | "destructive"> = {
  draft: "outline",
  issued: "default",
  partial: "warning",
  paid: "success",
  cancelled: "destructive",
  refunded: "destructive",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  cheque: "Chèque",
  other: "Autre",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function InvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: inv, isLoading, isError } = useInvoice(id);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payRef, setPayRef] = useState("");

  const issueMut = useIssueInvoice(id);
  const cancelMut = useCancelInvoice(id);
  const payMut = useRecordPayment(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }
  if (isError || !inv) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <p className="text-sm text-[var(--text-muted)]">Facture introuvable.</p>
      </div>
    );
  }

  const remaining = Math.max(0, inv.total - inv.total_paid);

  const submitPayment = () => {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Montant invalide");
    payMut.mutate(
      { amount, method: payMethod, reference: payRef || undefined },
      {
        onSuccess: () => {
          toast.success(`Paiement enregistré · ${amount.toLocaleString("fr-FR")} ${inv.currency}`);
          setPayAmount("");
          setPayRef("");
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
      }
    );
  };

  const issue = () => {
    issueMut.mutate(undefined, {
      onSuccess: (i) => toast.success(`Facture émise · ${i.number}`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  const cancel = () => {
    const reason = window.prompt("Motif d'annulation ?", "");
    if (reason === null) return;
    cancelMut.mutate(reason || undefined, {
      onSuccess: () => toast.success("Facture annulée"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/patients/${inv.patient_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au dossier
      </Link>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[var(--primary)]" />
              <h1 className="font-mono text-xl font-bold text-[var(--text-primary)]">
                {inv.number}
              </h1>
              <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Émise le {fmtDate(inv.issue_date)}
              {inv.issued_at && ` · ${fmtDate(inv.issued_at)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" && (
              <Button onClick={issue} disabled={issueMut.isPending}>
                {issueMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Émettre
              </Button>
            )}
            {(inv.status === "issued" || inv.status === "partial") && (
              <Button variant="ghost" onClick={cancel} disabled={cancelMut.isPending}>
                <XCircle className="h-3 w-3" />
                Annuler
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Lines + totals */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Désignation</th>
              <th className="px-4 py-3 text-right w-20">Qté</th>
              <th className="px-4 py-3 text-right w-32">Prix unitaire</th>
              <th className="px-4 py-3 text-right w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.line_items.map((li, i) => (
              <tr key={i} className="border-t border-[var(--line-soft,_#E2E8F0)]">
                <td className="px-4 py-3">{li.label}</td>
                <td className="px-4 py-3 text-right font-mono">{li.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {li.unit_price.toLocaleString("fr-FR")} {inv.currency}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(li.total ?? li.quantity * li.unit_price).toLocaleString("fr-FR")} {inv.currency}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[var(--line-soft,_#E2E8F0)] text-sm">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-[var(--text-secondary)]">Sous-total</td>
              <td className="px-4 py-2 text-right font-mono">
                {inv.subtotal.toLocaleString("fr-FR")} {inv.currency}
              </td>
            </tr>
            {inv.discount > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[var(--text-secondary)]">Remise</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--danger)]">
                  − {inv.discount.toLocaleString("fr-FR")} {inv.currency}
                </td>
              </tr>
            )}
            {inv.tva > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[var(--text-secondary)]">
                  TVA {inv.tva_rate}%
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {inv.tva.toLocaleString("fr-FR")} {inv.currency}
                </td>
              </tr>
            )}
            <tr className="bg-[var(--background)]">
              <td colSpan={3} className="px-4 py-3 text-right font-bold">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono text-base font-bold">
                {inv.total.toLocaleString("fr-FR")} {inv.currency}
              </td>
            </tr>
            {inv.total_paid > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[var(--success)]">Payé</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--success)]">
                  {inv.total_paid.toLocaleString("fr-FR")} {inv.currency}
                </td>
              </tr>
            )}
            {remaining > 0 && inv.status !== "draft" && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right font-bold text-[var(--warning)]">Reste à payer</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-[var(--warning)]">
                  {remaining.toLocaleString("fr-FR")} {inv.currency}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </Card>

      {/* Payments + record form */}
      {(inv.status === "issued" || inv.status === "partial" || inv.status === "paid") && (
        <Card className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
            Paiements
          </h3>

          {inv.payments.length > 0 && (
            <div className="mt-3 space-y-2">
              {inv.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-[var(--line-soft,_#E2E8F0)] p-3 text-sm"
                >
                  <div>
                    <p className="font-mono">
                      {p.amount.toLocaleString("fr-FR")} {inv.currency}{" "}
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        {METHOD_LABEL[p.method]}
                      </span>
                    </p>
                    {p.reference && (
                      <p className="text-xs text-[var(--text-muted)]">Réf. {p.reference}</p>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{fmtDate(p.received_at)}</p>
                </div>
              ))}
            </div>
          )}

          {remaining > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder={remaining.toString()}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Méthode</Label>
                <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)}>
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["cash", "card", "transfer", "cheque", "other"] as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  placeholder="ex. cheque #123"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={submitPayment} disabled={payMut.isPending} className="w-full">
                  {payMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Encaisser"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
