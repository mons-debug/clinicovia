"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Receipt,
  Stethoscope,
  Camera,
  Pill,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCheckoutFromDossier } from "@/lib/api/queue";

interface Props {
  patientId: string;
  patientName: string;
  canTerminate?: boolean;
  sessionPrice?: number | null;
  treatment?: string | null;
  mode?: "consultation" | "seance";
  planTitle?: string | null;
  sessionNumber?: number | null;
  totalSessions?: number | null;
  soapExists?: boolean;
  ordonnanceExists?: boolean;
  ordonnanceCount?: number;
  photosBefore?: number;
  photosAfter?: number;
  factureStatus?: string | null;
  factureAmount?: number | null;
}

function StatusRow({
  icon: Icon,
  label,
  value,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm ${done ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
          {value}
        </span>
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border border-gray-300" />
        )}
      </div>
    </div>
  );
}

export function TerminerVisiteButton({
  patientId,
  patientName,
  canTerminate = true,
  sessionPrice,
  treatment,
  mode,
  planTitle,
  sessionNumber,
  totalSessions,
  soapExists,
  ordonnanceExists,
  ordonnanceCount = 0,
  photosBefore = 0,
  photosAfter = 0,
  factureStatus,
  factureAmount,
}: Props) {
  const [open, setOpen] = useState(false);
  const isSeance = mode === "seance";
  const alreadyPaid = factureStatus === "paid";
  const defaultAmount = alreadyPaid ? String(factureAmount || 0) : (sessionPrice ? String(sessionPrice) : "");
  const [amount, setAmount] = useState(defaultAmount);
  const [editingAmount, setEditingAmount] = useState(!isSeance && !sessionPrice && !alreadyPaid);
  const [followUpWeeks, setFollowUpWeeks] = useState("");
  const [notes, setNotes] = useState("");

  const mut = useCheckoutFromDossier();

  const effectiveAmount = Number(amount) || 0;
  const treatmentLabel = treatment || "Consultation";

  const submit = async () => {
    const weeks = followUpWeeks ? Number(followUpWeeks) : null;
    try {
      await mut.mutateAsync({
        patientId,
        amount: effectiveAmount,
        followUpWeeks: weeks,
        notes: notes.trim() || null,
      });
      toast.success(
        weeks
          ? `Visite terminée · ${effectiveAmount} MAD · suivi dans ${weeks} sem.`
          : `Visite terminée · ${effectiveAmount} MAD`
      );
      setOpen(false);
      setAmount("");
      setFollowUpWeeks("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {canTerminate ? (
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Terminer la visite
          </Button>
        </DialogTrigger>
      ) : (
        <span title="Complétez le screening et la consultation (SOAP) avant de terminer">
          <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 opacity-50 cursor-not-allowed" disabled>
            <CheckCircle2 className="h-4 w-4" />
            Terminer la visite
          </Button>
        </span>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Terminer la visite</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Séance badge */}
          {isSeance && planTitle && (
            <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2">
              <FileText className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-800">
                Séance {sessionNumber}/{totalSessions} — {planTitle}
              </span>
            </div>
          )}

          {/* Visit summary */}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Résumé de la visite
            </p>
            <div className="divide-y divide-[var(--line-soft,_#E2E8F0)]">
              <StatusRow
                icon={Stethoscope}
                label="Consultation"
                value={soapExists ? "SOAP créée" : "Non créée"}
                done={!!soapExists}
              />
              <StatusRow
                icon={Camera}
                label="Photos"
                value={
                  photosBefore > 0 || photosAfter > 0
                    ? `${photosBefore} avant · ${photosAfter} après`
                    : "Aucune"
                }
                done={photosBefore > 0 || photosAfter > 0}
              />
              <StatusRow
                icon={Pill}
                label="Ordonnance"
                value={
                  ordonnanceCount > 0
                    ? `${ordonnanceCount} ordonnance${ordonnanceCount > 1 ? "s" : ""}`
                    : "Aucune"
                }
                done={!!ordonnanceExists}
              />
            </div>
          </div>

          {/* Facture preview */}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Facturation
            </p>
            {alreadyPaid ? (
              <div className="flex items-center justify-between rounded-md bg-emerald-50 p-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Déjà payée</span>
                </div>
                <span className="text-lg font-bold font-mono text-emerald-800">
                  {(factureAmount ?? 0).toLocaleString("fr-FR")} MAD
                </span>
              </div>
            ) : editingAmount ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={50}
                    placeholder="0 = pas de facture"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <span className="text-sm font-medium text-[var(--text-muted)]">MAD</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">{treatmentLabel}</p>
              </div>
            ) : (
              <div
                className="flex items-center justify-between rounded-md bg-[var(--background)] p-2.5 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setEditingAmount(true)}
                title="Cliquer pour modifier"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{treatmentLabel}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">1 × {effectiveAmount.toLocaleString("fr-FR")} MAD</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                    {effectiveAmount.toLocaleString("fr-FR")} MAD
                  </p>
                  {effectiveAmount === 0 && (
                    <Badge variant="outline" className="text-[10px]">Gratuit</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Follow-up + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tv-followup" className="text-xs">Reprogrammer (semaines)</Label>
              <Input
                id="tv-followup"
                type="number"
                min={1}
                max={52}
                placeholder="—"
                value={followUpWeeks}
                onChange={(e) => setFollowUpWeeks(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-notes" className="text-xs">Notes réception</Label>
              <Input
                id="tv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex. remettre crème"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={mut.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {mut.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Envoi…</>
            ) : (
              <><Receipt className="h-3 w-3" />Envoyer à la réception</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
