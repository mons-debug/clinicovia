"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle, Pill, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  usePrescription,
  useSignPrescription,
  useCancelPrescription,
  type PrescriptionStatus,
} from "@/lib/api/prescriptions";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  draft: "Brouillon",
  signed: "Signée",
  cancelled: "Annulée",
};
const STATUS_VARIANT: Record<PrescriptionStatus, "outline" | "success" | "destructive"> = {
  draft: "outline",
  signed: "success",
  cancelled: "destructive",
};

const FORM_LABEL: Record<string, string> = {
  tablet: "comprimé",
  capsule: "gélule",
  syrup: "sirop",
  injection: "injection",
  cream: "crème",
  ointment: "pommade",
  drops: "gouttes",
  spray: "spray",
  other: "",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function PrescriptionDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: rx, isLoading, isError } = usePrescription(id);

  const signMut = useSignPrescription(id);
  const cancelMut = useCancelPrescription(id);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }
  if (isError || !rx) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <p className="text-sm text-[var(--text-muted)]">Ordonnance introuvable.</p>
      </div>
    );
  }

  const sign = () => signMut.mutate(undefined, {
    onSuccess: (r) => toast.success(`Signée · ${r.number}`),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const cancel = () => {
    const reason = window.prompt("Motif d'annulation ?", "");
    if (reason === null) return;
    cancelMut.mutate(reason || undefined, {
      onSuccess: () => toast.success("Ordonnance annulée"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  const downloadPdf = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/prescriptions/${id}/pdf`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rx.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléchargement");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/patients/${rx.patient_id}`}
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
              <Pill className="h-5 w-5 text-[var(--primary)]" />
              <h1 className="font-mono text-xl font-bold text-[var(--text-primary)]">
                {rx.number}
              </h1>
              <Badge variant={STATUS_VARIANT[rx.status]}>{STATUS_LABEL[rx.status]}</Badge>
              {rx.renewable && <Badge variant="secondary">Renouvelable</Badge>}
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Émise le {fmtDate(rx.issue_date)}
              {rx.signed_at && ` · signée le ${fmtDate(rx.signed_at)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rx.status === "draft" && (
              <Button onClick={sign} disabled={signMut.isPending}>
                {signMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Signer
              </Button>
            )}
            {rx.status !== "draft" && (
              <Button variant="secondary" onClick={downloadPdf}>
                <Download className="h-3 w-3" />
                Télécharger PDF
              </Button>
            )}
            {rx.status === "signed" && (
              <Button variant="ghost" onClick={cancel} disabled={cancelMut.isPending}>
                <XCircle className="h-3 w-3" />
                Annuler
              </Button>
            )}
          </div>
        </div>

        {rx.diagnosis && (
          <div className="mt-4 rounded-md bg-[var(--background)] p-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Indication · </span>
            <span className="italic">{rx.diagnosis}</span>
          </div>
        )}
      </Card>

      {/* Drug lines */}
      <Card className="p-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Médicaments
        </h3>
        <div className="mt-4 space-y-3">
          {rx.lines.map((li, i) => (
            <div key={i} className="rounded-md border border-[var(--line-soft,_#E2E8F0)] p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-[var(--primary)]">{i + 1}.</span>
                <span className="font-semibold">{li.dci}</span>
                {li.strength && <span className="text-sm text-[var(--text-secondary)]">{li.strength}</span>}
                {li.brand && <span className="text-xs italic text-[var(--text-muted)]">({li.brand})</span>}
                {li.form && <span className="text-xs text-[var(--text-muted)]">— {FORM_LABEL[li.form] ?? li.form}</span>}
              </div>
              <p className="mt-1 ml-6 text-sm">{li.posology}</p>
              {li.duration && (
                <p className="mt-1 ml-6 text-xs text-[var(--text-secondary)]">Durée : {li.duration}</p>
              )}
              {li.note && (
                <p className="mt-2 ml-6 rounded bg-amber-50 px-3 py-1 text-xs text-amber-800">{li.note}</p>
              )}
            </div>
          ))}
        </div>

        {rx.notes && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {rx.notes}
          </div>
        )}
      </Card>
    </div>
  );
}
