"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";

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

import { useCheckoutAppointment, type CalendarAppointment } from "@/lib/api/calendar";

interface Props {
  appt: CalendarAppointment;
  isoDate: string;
  /** Optional: render inline (no Trigger) — caller provides own button */
  triggerLabel?: string;
}

export function TerminerDialog({ appt, isoDate, triggerLabel = "Terminer" }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [followUpWeeks, setFollowUpWeeks] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const mut = useCheckoutAppointment(isoDate);

  const submit = async () => {
    const amt = Number(amount) || 0;
    const weeks = followUpWeeks ? Number(followUpWeeks) : null;
    if (weeks !== null && (Number.isNaN(weeks) || weeks < 1)) {
      toast.error("Délai de suivi invalide");
      return;
    }
    try {
      await mut.mutateAsync({
        appointmentId: appt.id,
        amount: amt,
        follow_up_weeks: weeks,
        notes: notes.trim() || null,
      });
      toast.success(
        weeks
          ? `Terminé · ${amt} MAD à encaisser · suivi dans ${weeks} sem.`
          : `Terminé · ${amt} MAD à encaisser`
      );
      setOpen(false);
      setAmount(""); setFollowUpWeeks(""); setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <CheckCircle2 className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminer la consultation</DialogTitle>
          <DialogDescription>
            {appt.patient_name} · {appt.treatment}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-amount">Montant à encaisser (MAD)</Label>
            <Input
              id="t-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={50}
              placeholder="0 = pas de facture"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Une facture brouillon sera créée pour la réception.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-followup">Reprogrammer dans (semaines)</Label>
            <Input
              id="t-followup"
              type="number"
              min={1}
              max={52}
              placeholder="ex. 4 (laisser vide si pas de suivi)"
              value={followUpWeeks}
              onChange={(e) => setFollowUpWeeks(e.target.value)}
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Réception confirmera l&apos;heure exacte avec le patient.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notes pour la réception</Label>
            <textarea
              id="t-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. remettre crème post-acte · ordonnance signée à donner"
              className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Envoi…</>
            ) : (
              <><Receipt className="h-3 w-3" />Terminer & envoyer à la réception</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
