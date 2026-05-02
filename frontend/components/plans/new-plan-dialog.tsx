"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, CalendarDays, AlertTriangle } from "lucide-react";
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
import { useTreatments, type TreatmentResponse } from "@/lib/api/appointments";
import { useCalendarRange } from "@/lib/api/calendar";

interface Props {
  patientId: string;
  triggerLabel?: string;
}

const FR_DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

function projectDates(
  startIso: string,
  total: number,
  intervalValue: number,
  intervalUnit: "days" | "weeks" | "months"
): string[] {
  const dates: string[] = [];
  const start = new Date(startIso);
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    if (intervalUnit === "days") d.setDate(d.getDate() + intervalValue * i);
    else if (intervalUnit === "weeks") d.setDate(d.getDate() + intervalValue * 7 * i);
    else d.setMonth(d.getMonth() + intervalValue * i);
    // Skip weekends → push to Monday
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function NewPlanDialog({ patientId, triggerLabel = "Nouveau plan" }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [selectedTreatmentId, setSelectedTreatmentId] = useState("");
  const [totalSessions, setTotalSessions] = useState(4);
  const [intervalValue, setIntervalValue] = useState(4);
  const [intervalUnit, setIntervalUnit] = useState<"days" | "weeks" | "months">("weeks");
  const [sessionPrice, setSessionPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [defaultHour, setDefaultHour] = useState(10);

  const { data: treatmentsData } = useTreatments();
  const treatments = treatmentsData?.treatments ?? [];

  // Group by category
  const treatmentsByCategory = useMemo(() => {
    const groups = new Map<string, TreatmentResponse[]>();
    for (const t of treatments) {
      const key = t.category ?? "Autre";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries());
  }, [treatments]);

  // Selected treatment object
  const selectedTreatment = useMemo(
    () => treatments.find((t) => t.id === selectedTreatmentId) ?? null,
    [treatments, selectedTreatmentId]
  );

  // Projected dates
  const projectedDates = useMemo(() => {
    if (!startDate || totalSessions < 1) return [];
    return projectDates(startDate, totalSessions, intervalValue, intervalUnit);
  }, [startDate, totalSessions, intervalValue, intervalUnit]);

  // Calendar availability for projected range
  const rangeFrom = projectedDates[0] ?? "";
  const rangeTo = projectedDates[projectedDates.length - 1] ?? "";
  const { data: rangeData } = useCalendarRange(rangeFrom, rangeTo);
  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rangeData?.days ?? []) map.set(d.date, d.total);
    return map;
  }, [rangeData]);

  const computedTotal = sessionPrice ? Number(sessionPrice) * totalSessions : 0;

  const create = useCreatePlan();

  const reset = () => {
    setTitle(""); setSelectedTreatmentId(""); setTotalSessions(4);
    setIntervalValue(4); setIntervalUnit("weeks"); setSessionPrice("");
    setStartDate(""); setNotes(""); setAutoSchedule(true); setDefaultHour(10);
  };

  const handleTreatmentSelect = (treatmentId: string) => {
    setSelectedTreatmentId(treatmentId);
    const t = treatments.find((x) => x.id === treatmentId);
    if (t) {
      if (!title) setTitle(`${t.name} — cure ${totalSessions} séances`);
      if (!sessionPrice && t.price > 0) setSessionPrice(String(t.price));
    }
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Indiquer un titre de plan");

    try {
      const plan = await create.mutateAsync({
        patient_id: patientId,
        title: title.trim(),
        primary_service: selectedTreatment?.name ?? null,
        total_sessions: totalSessions,
        interval_value: intervalValue,
        interval_unit: intervalUnit,
        estimated_total: computedTotal || null,
        session_price: sessionPrice ? Number(sessionPrice) : null,
        notes: notes.trim() || null,
        start_at: startDate || null,
        auto_schedule: autoSchedule,
        default_hour: defaultHour,
      });
      toast.success(
        autoSchedule
          ? `Plan créé · ${plan.total_sessions} séances + RDV programmés`
          : `Plan créé · ${plan.total_sessions} séances`
      );
      reset();
      setOpen(false);
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau plan de traitement</DialogTitle>
          <DialogDescription>
            Choisissez le service, le nombre de séances et la date de début.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Treatment selector */}
          <div className="sm:col-span-2 space-y-2">
            <Label>Service / Traitement</Label>
            <Select value={selectedTreatmentId || "_none"} onValueChange={(v) => v !== "_none" && handleTreatmentSelect(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un service…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Choisir un service…</SelectItem>
                {treatmentsByCategory.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {cat}
                    </div>
                    {items.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {t.duration_minutes}min{t.price > 0 ? ` · ${t.price} MAD` : ""}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Titre du plan</Label>
            <Input
              id="title"
              placeholder="ex. Botox visage — cure 4 séances"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Session count + interval */}
          <div className="space-y-2">
            <Label htmlFor="total">Nombre de séances</Label>
            <Input id="total" type="number" min={1} max={24} value={totalSessions}
              onChange={(e) => setTotalSessions(Number(e.target.value) || 1)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="interval">Intervalle</Label>
              <Input id="interval" type="number" min={1} value={intervalValue}
                onChange={(e) => setIntervalValue(Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as typeof intervalUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Jours</SelectItem>
                  <SelectItem value="weeks">Semaines</SelectItem>
                  <SelectItem value="months">Mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Session price + start date */}
          <div className="space-y-2">
            <Label htmlFor="price">Prix par séance (MAD)</Label>
            <Input id="price" type="number" min={0} step={50} placeholder="ex. 2000"
              value={sessionPrice} onChange={(e) => setSessionPrice(e.target.value)} />
            {computedTotal > 0 && (
              <p className="text-[11px] text-[var(--text-muted)]">
                Total estimé : <span className="font-mono font-bold">{computedTotal.toLocaleString("fr-FR")} MAD</span>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Date de début</Label>
            <Input id="start-date" type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Input id="notes" placeholder="Notes cliniques" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Smart scheduling */}
          <div className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              <span className="flex-1">
                <span className="font-medium text-[var(--text-primary)]">
                  Programmer automatiquement dans le calendrier
                </span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                  {totalSessions} rendez-vous créés · réception confirme l&apos;heure.
                </span>
              </span>
            </label>
            {autoSchedule && (
              <div className="mt-3 flex items-center gap-3 pl-7">
                <Label className="text-xs whitespace-nowrap">Heure par défaut</Label>
                <Input type="number" min={7} max={20} value={defaultHour}
                  onChange={(e) => setDefaultHour(Number(e.target.value) || 10)}
                  className="w-20" />
                <span className="text-xs text-[var(--text-muted)]">h00</span>
              </div>
            )}
          </div>

          {/* Projected dates preview */}
          {projectedDates.length > 0 && autoSchedule && (
            <div className="sm:col-span-2 rounded-lg border border-[var(--border)] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <CalendarDays className="h-3.5 w-3.5" />
                Dates projetées
              </p>
              <div className="space-y-1">
                {projectedDates.map((d, i) => {
                  const dayOfWeek = FR_DAYS[new Date(d).getDay()];
                  const count = dayCounts.get(d) ?? 0;
                  const busy = count > 6;
                  return (
                    <div key={d} className="flex items-center justify-between rounded px-2 py-1 text-xs">
                      <span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">Séance {i + 1}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{dayOfWeek} {d}</span>
                      </span>
                      <span className={busy ? "flex items-center gap-1 font-bold text-amber-700" : "text-[var(--text-muted)]"}>
                        {busy && <AlertTriangle className="h-3 w-3" />}
                        {count} RDV
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Création…</>
            ) : (
              <><Plus className="h-3 w-3" />Créer le plan</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
