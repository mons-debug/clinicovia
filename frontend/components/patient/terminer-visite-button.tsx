"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Receipt,
  Stethoscope,
  Camera,
  Pill,
  FileText,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
  intervalValue?: number | null;
  soapExists?: boolean;
  ordonnanceExists?: boolean;
  ordonnanceCount?: number;
  photosBefore?: number;
  photosAfter?: number;
  screeningOk?: boolean;
  consentSigned?: boolean;
  consentPending?: boolean;
  factureStatus?: string | null;
  factureAmount?: number | null;
}

function StatusRow({
  icon: Icon,
  label,
  value,
  done,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  done: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm ${done ? "font-medium text-[var(--text-primary)]" : warn ? "font-medium text-amber-600" : "text-[var(--text-muted)]"}`}>
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
  intervalValue,
  soapExists,
  ordonnanceExists,
  ordonnanceCount = 0,
  photosBefore = 0,
  photosAfter = 0,
  screeningOk,
  consentSigned,
  consentPending,
  factureStatus,
  factureAmount,
}: Props) {
  const [open, setOpen] = useState(false);
  const isSeance = mode === "seance";
  const hasNextSession = isSeance && sessionNumber && totalSessions && sessionNumber < totalSessions;
  const [followUpWeeks, setFollowUpWeeks] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (hasNextSession && intervalValue && !followUpWeeks) {
      setFollowUpWeeks(String(intervalValue));
    }
  }, [hasNextSession, intervalValue, followUpWeeks]);

  const mut = useCheckoutFromDossier();

  const effectiveAmount = factureStatus === "paid" ? (factureAmount ?? 0) : (sessionPrice ?? 0);

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
          ? `Visite terminée · prochain RDV dans ${weeks} sem.`
          : "Visite terminée"
      );
      setOpen(false);
      setFollowUpWeeks("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const factureLabel = (() => {
    if (factureStatus === "paid") return `${(factureAmount ?? 0).toLocaleString("fr-FR")} MAD · Payée`;
    if (factureStatus === "issued") return `${(factureAmount ?? 0).toLocaleString("fr-FR")} MAD · Validée`;
    if (factureStatus === "draft") return `${(factureAmount ?? 0).toLocaleString("fr-FR")} MAD · Brouillon`;
    return "Non créée";
  })();

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
        <span title={isSeance ? "Complétez le screening avant de terminer" : "Complétez le screening et la consultation (SOAP) avant de terminer"}>
          <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 opacity-50 cursor-not-allowed" disabled>
            <CheckCircle2 className="h-4 w-4" />
            Terminer la visite
          </Button>
        </span>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Terminer la visite</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context banner */}
          {isSeance && planTitle ? (
            <div className="rounded-lg bg-teal-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-800">
                  Séance {sessionNumber}/{totalSessions} — {treatment || planTitle}
                </span>
              </div>
              <p className="text-[11px] text-teal-600 mt-0.5 ml-6">{patientName}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--text-primary)]">{patientName}</p>
              {treatment && <p className="text-xs text-[var(--text-muted)]">{treatment}</p>}
            </div>
          )}

          {/* Visit summary */}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Résumé de la visite
            </p>
            <div className="divide-y divide-[var(--line-soft,_#E2E8F0)]">
              <StatusRow
                icon={ShieldCheck}
                label="Screening"
                value={screeningOk ? "OK" : "Non évalué"}
                done={!!screeningOk}
              />
              <StatusRow
                icon={ClipboardCheck}
                label="Consentement"
                value={consentSigned ? "Signé" : consentPending ? "En attente" : "—"}
                done={!!consentSigned}
                warn={!!consentPending}
              />
              {!isSeance && (
                <StatusRow
                  icon={Stethoscope}
                  label="Note SOAP"
                  value={soapExists ? "Rédigée" : "Non créée"}
                  done={!!soapExists}
                />
              )}
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
                    : "Optionnel"
                }
                done={!!ordonnanceExists}
              />
              <StatusRow
                icon={Receipt}
                label="Facture"
                value={factureLabel}
                done={factureStatus === "paid" || factureStatus === "issued"}
                warn={factureStatus === "draft"}
              />
            </div>
          </div>

          {factureStatus === "draft" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                La facture est encore en brouillon. La réception la validera à l&apos;encaissement.
              </p>
            </div>
          )}

          {ordonnanceCount > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-700">
                {ordonnanceCount} ordonnance{ordonnanceCount > 1 ? "s" : ""} sera{ordonnanceCount > 1 ? "ont" : ""} envoyée{ordonnanceCount > 1 ? "s" : ""} à la réception pour impression.
              </p>
            </div>
          )}

          {/* Follow-up + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tv-followup" className="text-xs">
                {hasNextSession ? `Prochain RDV (séance ${(sessionNumber ?? 0) + 1})` : "Prochain RDV (semaines)"}
              </Label>
              <Input
                id="tv-followup"
                type="number"
                min={1}
                max={52}
                placeholder="—"
                value={followUpWeeks}
                onChange={(e) => setFollowUpWeeks(e.target.value)}
              />
              {hasNextSession && (
                <p className="text-[10px] text-[var(--text-muted)]">
                  Pré-rempli selon l&apos;intervalle du plan
                </p>
              )}
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
              <><CheckCircle2 className="h-3 w-3" />Terminer & envoyer</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
