"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Play,
  FileText,
  Receipt,
  Loader2,
  CheckCircle2,
  Pencil,
  Check,
  X,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

interface Props {
  planId: string;
  sessionId: string;
  sessionNumber: number;
  patientId: string;
  patientName: string;
  treatmentName: string;
  sessionPrice: number | null;
  totalSessions?: number;
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
  totalSessions,
  doctorServiceId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"preview" | "sending" | "sent">("preview");
  const advance = useAdvanceSession(planId);
  const prepare = usePrepareSession();
  const { data: doctorService } = useService(doctorServiceId ?? "");

  const initialConsent =
    doctorService?.consent_template || defaultConsentText(treatmentName);
  const initialPrice = doctorService?.default_price ?? sessionPrice ?? 0;

  const [consentText, setConsentText] = useState(initialConsent);
  const [editingConsent, setEditingConsent] = useState(false);
  const [consentDraft, setConsentDraft] = useState("");

  const [amount, setAmount] = useState(initialPrice);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");

  useEffect(() => {
    if (doctorService) {
      if (doctorService.consent_template)
        setConsentText(doctorService.consent_template);
      if (doctorService.default_price > 0)
        setAmount(doctorService.default_price);
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

  const sessionLabel = totalSessions
    ? `${sessionNumber}/${totalSessions}`
    : `${sessionNumber}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Play className="h-3 w-3" />
          Commencer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Démarrer la séance {sessionLabel}
          </DialogTitle>
          <DialogDescription>
            {patientName ? `${patientName} — ` : ""}
            {treatmentName}
          </DialogDescription>
        </DialogHeader>

        {step === "preview" && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Les documents suivants seront envoyés à la réception.
            </p>

            {/* Two cards: Consent + Facture */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ── Consent card ──────────────────── */}
              <div
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  "border-blue-200 bg-blue-50/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Consentement
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {consentEdited && (
                      <span className="text-[9px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        modifié
                      </span>
                    )}
                    {!editingConsent ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[var(--text-muted)] hover:text-blue-600"
                        onClick={() => {
                          setConsentDraft(consentText);
                          setEditingConsent(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : (
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-emerald-600"
                          onClick={() => {
                            setConsentText(consentDraft);
                            setEditingConsent(false);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => setEditingConsent(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {editingConsent ? (
                  <Textarea
                    value={consentDraft}
                    onChange={(e) => setConsentDraft(e.target.value)}
                    rows={4}
                    className="text-[11px] bg-white"
                  />
                ) : (
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                    {consentText}
                  </p>
                )}
              </div>

              {/* ── Facture card ──────────────────── */}
              <div
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  "border-amber-200 bg-amber-50/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                      <Receipt className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Facture
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {amountEdited && (
                      <span className="text-[9px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        modifié
                      </span>
                    )}
                    {!editingAmount ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[var(--text-muted)] hover:text-amber-600"
                        onClick={() => {
                          setAmountDraft(String(amount));
                          setEditingAmount(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : (
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-emerald-600"
                          onClick={() => {
                            const parsed = parseFloat(amountDraft);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setAmount(parsed);
                            }
                            setEditingAmount(false);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => setEditingAmount(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {editingAmount ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={amountDraft}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      className="h-8 text-right font-mono text-sm bg-white"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                          const parsed = parseFloat(amountDraft);
                          if (!isNaN(parsed) && parsed >= 0)
                            setAmount(parsed);
                          setEditingAmount(false);
                        }
                      }}
                    />
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      MAD
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">
                      {treatmentName}
                    </p>
                    <p className="text-xl font-bold font-mono text-[var(--text-primary)]">
                      {amount.toLocaleString("fr-FR")}{" "}
                      <span className="text-sm font-medium text-[var(--text-muted)]">
                        MAD
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-[var(--primary-lighter)] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Envoi en cours...
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Transmission à la réception
              </p>
            </div>
          </div>
        )}

        {step === "sent" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-emerald-700">
                Documents envoyés
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                La séance {sessionLabel} est en cours
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCommencer}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="h-3.5 w-3.5" />
                Commencer & envoyer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
