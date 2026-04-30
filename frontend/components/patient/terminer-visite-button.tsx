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
import { useCheckoutFromDossier } from "@/lib/api/queue";

interface Props {
  patientId: string;
  patientName: string;
}

export function TerminerVisiteButton({ patientId, patientName }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [followUpWeeks, setFollowUpWeeks] = useState("");
  const [notes, setNotes] = useState("");

  const mut = useCheckoutFromDossier();

  const submit = async () => {
    const amt = Number(amount) || 0;
    const weeks = followUpWeeks ? Number(followUpWeeks) : null;
    try {
      await mut.mutateAsync({
        patientId,
        amount: amt,
        followUpWeeks: weeks,
        notes: notes.trim() || null,
      });
      toast.success(
        weeks
          ? `Visite terminée · ${amt} MAD · suivi dans ${weeks} sem.`
          : `Visite terminée · ${amt} MAD`
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
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Terminer la visite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminer la visite</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tv-amount">Montant à encaisser (MAD)</Label>
            <Input
              id="tv-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={50}
              placeholder="0 = pas de facture"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-followup">Reprogrammer dans (semaines)</Label>
            <Input
              id="tv-followup"
              type="number"
              min={1}
              max={52}
              placeholder="Laisser vide si pas de suivi"
              value={followUpWeeks}
              onChange={(e) => setFollowUpWeeks(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-notes">Notes pour la réception</Label>
            <textarea
              id="tv-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. remettre crème post-acte · ordonnance à donner"
              className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={mut.isPending} className="bg-emerald-600 hover:bg-emerald-700">
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
