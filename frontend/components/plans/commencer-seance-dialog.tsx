"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play, FileText, Receipt, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAdvanceSession, type SessionStatus } from "@/lib/api/plans";
import { usePrepareSession } from "@/lib/api/queue";

interface Props {
  planId: string;
  sessionId: string;
  sessionNumber: number;
  patientId: string;
  patientName: string;
  treatmentName: string;
  sessionPrice: number | null;
}

export function CommencerSeanceDialog({
  planId,
  sessionId,
  sessionNumber,
  patientId,
  patientName,
  treatmentName,
  sessionPrice,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"preview" | "sending" | "sent">("preview");
  const advance = useAdvanceSession(planId);
  const prepare = usePrepareSession();

  const handleCommencer = async () => {
    setStep("sending");
    try {
      // 1. Advance séance to in_progress
      await advance.mutateAsync({
        sessionId,
        to: "in_progress" as SessionStatus,
      });

      // 2. Send consent + facture to reception
      await prepare.mutateAsync(patientId);

      setStep("sent");
      toast.success("Séance commencée · documents envoyés à la réception");

      setTimeout(() => {
        setOpen(false);
        setStep("preview");
      }, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep("preview"); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-2">
          <Play className="h-3 w-3" />
          Commencer la séance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commencer la séance {sessionNumber}</DialogTitle>
          <DialogDescription>{patientName} — {treatmentName}</DialogDescription>
        </DialogHeader>

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Les documents suivants seront envoyés à la réception pour impression, signature et paiement.
            </p>

            {/* Consent preview */}
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-bold text-[var(--text-primary)]">Consentement</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-xs text-[var(--text-secondary)]">
                <p className="font-medium mb-1">Consentement — {treatmentName}</p>
                <p>
                  Je soussigné(e), autorise le Dr. à effectuer le traitement
                  &laquo;{treatmentName}&raquo; après avoir été informé(e) des risques,
                  bénéfices et alternatives. J{"'"}ai eu l{"'"}occasion de poser toutes mes questions.
                </p>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                La réception imprimera le consentement pour signature du patient.
              </p>
            </div>

            {/* Facture preview */}
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-bold text-[var(--text-primary)]">Facture</p>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{treatmentName}</p>
                  <p className="text-xs text-[var(--text-muted)]">1 × {(sessionPrice ?? 0).toLocaleString("fr-FR")} MAD</p>
                </div>
                <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {(sessionPrice ?? 0).toLocaleString("fr-FR")} MAD
                </p>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                La réception encaissera le paiement avant le traitement.
              </p>
            </div>
          </div>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">Envoi à la réception...</p>
          </div>
        )}

        {step === "sent" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Documents envoyés à la réception</p>
            <p className="text-xs text-[var(--text-muted)]">La séance est en cours. En attente de la réception.</p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCommencer} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Play className="h-3 w-3" />
                Commencer & envoyer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
