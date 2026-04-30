"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreatePlan } from "@/lib/api/plans";

interface Props {
  patientId: string;
  triggerLabel?: string;
}

export function NewPlanDialog({ patientId, triggerLabel = "Nouveau plan" }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [primaryService, setPrimaryService] = useState("");
  const [totalSessions, setTotalSessions] = useState(4);
  const [intervalValue, setIntervalValue] = useState(4);
  const [intervalUnit, setIntervalUnit] = useState<"days" | "weeks" | "months">("weeks");
  const [estimatedTotal, setEstimatedTotal] = useState<string>("");
  const [notes, setNotes] = useState("");

  const create = useCreatePlan();

  const reset = () => {
    setTitle("");
    setPrimaryService("");
    setTotalSessions(4);
    setIntervalValue(4);
    setIntervalUnit("weeks");
    setEstimatedTotal("");
    setNotes("");
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Indiquer un titre de plan");

    try {
      const plan = await create.mutateAsync({
        patient_id: patientId,
        title: title.trim(),
        primary_service: primaryService.trim() || null,
        total_sessions: totalSessions,
        interval_value: intervalValue,
        interval_unit: intervalUnit,
        estimated_total: estimatedTotal ? Number(estimatedTotal) : null,
        notes: notes.trim() || null,
      });
      toast.success(`Plan créé · ${plan.total_sessions} séances`);
      reset();
      setOpen(false);
      router.push(`/plans/${plan.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau plan de traitement</DialogTitle>
          <DialogDescription>
            Programmez automatiquement N séances espacées d&apos;un intervalle fixe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              placeholder="ex. Botox visage — cure 4 séances"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Traitement principal</Label>
            <Input
              id="service"
              placeholder="ex. botox · hydrafacial"
              value={primaryService}
              onChange={(e) => setPrimaryService(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimated">Coût estimé (MAD)</Label>
            <Input
              id="estimated"
              type="number"
              placeholder="ex. 8000"
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">Nombre de séances</Label>
            <Input
              id="total"
              type="number"
              min={1}
              max={24}
              value={totalSessions}
              onChange={(e) => setTotalSessions(Number(e.target.value) || 1)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="interval">Intervalle</Label>
              <Input
                id="interval"
                type="number"
                min={1}
                value={intervalValue}
                onChange={(e) => setIntervalValue(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unité</Label>
              <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as typeof intervalUnit)}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Jours</SelectItem>
                  <SelectItem value="weeks">Semaines</SelectItem>
                  <SelectItem value="months">Mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Notes cliniques (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Créer le plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
