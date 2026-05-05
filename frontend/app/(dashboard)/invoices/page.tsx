"use client";

import Link from "next/link";
import { Loader2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInvoices, type InvoiceStatus } from "@/lib/api/invoices";

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

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const { data, isLoading } = useInvoices();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Factures</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {invoices.length} facture{invoices.length > 1 ? "s" : ""} · numérotation FAC-AAAA-NNNN par an
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
            Aucune facture pour le moment
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Créez une facture depuis le dossier d&apos;un patient.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Numéro</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Payé</th>
                <th className="px-4 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t border-[var(--line-soft,_#E2E8F0)] hover:bg-[var(--background)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono text-sm font-semibold text-[var(--primary)] hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{fmt(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {inv.total.toLocaleString("fr-FR")} {inv.currency}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                    {inv.total_paid.toLocaleString("fr-FR")} {inv.currency}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[inv.status]}>
                      {STATUS_LABEL[inv.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
