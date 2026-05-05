"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Play, FileText, Receipt, Loader2, CheckCircle2, Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
import { useService } from "@/lib/api/doctor-services";

interface Props {
  planId: string;
  sessionId: string;
  sessionNumber: number;
  patientId: string;
  patientName: string;
  treatmentName: string;
  sessionPrice: number | null;
  doctorServiceId?: string | null;
}

function defaultConsentText(treatmentName: string) {
  return (
    `Je soussigné(e), autorise le Dr. à effectuer le traitement «${treatmentName}» ` +
    `après avoir été informé(e) des risques, bénéfices et alternatives. ` +
    `J'ai eu l'occasion de poser toutes mes questions.`
  );
}

export function CommencerSeanceDialog({
  planId,
  sessionId,
  sessionNumber,
  patientId,
  patientName,
  treatmentName,
  sessionPrice,
  doctorServiceId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"preview" | "sending" | "sent">("preview");
  const advance = useAdvanceSession(planId);
  const prepare = usePrepareSession();
  const { data: doctorService } = useService(doctorServiceId ?? "");

  const initialConsent = doctorService?.consent_template || defaultConsentText(treatmentName);
  const initialPrice = doctorService?.default_price ?? sessionPrice ?? 0;

  const [consentText, setConsentText] = useState(initialConsent);
  const [editingConsent, setEditingConsent] = useState(false);
  const [consentDraft, setConsentDraft] = useState("");

  const [amount, setAmount] = useState(initialPrice);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");

  useEffect(() => {
    if (doctorService) {
      if (doctorService.consent_template) setConsentText(doctorService.consent_template);
      if (doctorService.default_price > 0) setAmount(doctorService.default_price);
    }
  }, [doctorService]);

  const consentEdited = consentText !== initialConsent;
  const amountEdited = amount !== initialPrice;

  const handleCommencer = async () => {
    setStep("sending");
    try {
      await prepare.mutateAsync({
        patientId,
        consentText: consentEdited ? consentText : undefined,
        invoiceAmount: amountEdited ? amount : undefined,
      });

      await advance.mutateAsync({
        sessionId,
        to: "in_progress" as SessionStatus,
      });

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

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setStep("preview");
      setEditingConsent(false);
      setEditingAmount(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">Consentement</p>
                  {consentEdited && (
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">modifié</span>
                  )}
                </div>
                {!editingConsent ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-blue-600"
                    onClick={() => { setConsentDraft(consentText); setEditingConsent(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                      onClick={() => { setConsentText(consentDraft); setEditingConsent(false); }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => setEditingConsent(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {editingConsent ? (
                <Textarea
                  value={consentDraft}
                  onChange={(e) => setConsentDraft(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
              ) : (
                <div className="rounded-md bg-gray-50 p-3 text-xs text-[var(--text-secondary)]">
                  <p className="font-medium mb-1">Consentement — {treatmentName}</p>
                  <p>{consentText}</p>
                </div>
              )}
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                La réception imprimera le consentement pour signature du patient.
              </p>
            </div>

            {/* Facture preview */}
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-600" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">Facture</p>
                  {amountEdited && (
                    <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">modifié</span>
                  )}
                </div>
                {!editingAmount ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-orange-600"
                    onClick={() => { setAmountDraft(String(amount)); setEditingAmount(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                      onClick={() => {
                        const parsed = parseFloat(amountDraft);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setAmount(parsed);
                        }
                        setEditingAmount(false);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => setEditingAmount(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {editingAmount ? (
                <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{treatmentName}</p>
                  <div className="ml-auto flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      value={amountDraft}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      className="w-28 text-right font-mono text-sm h-8"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                          const parsed = parseFloat(amountDraft);
                          if (!isNaN(parsed) && parsed >= 0) setAmount(parsed);
                          setEditingAmount(false);
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-[var(--text-muted)]">MAD</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{treatmentName}</p>
                    <p className="text-xs text-[var(--text-muted)]">1 × {amount.toLocaleString("fr-FR")} MAD</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                    {amount.toLocaleString("fr-FR")} MAD
                  </p>
                </div>
              )}
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
