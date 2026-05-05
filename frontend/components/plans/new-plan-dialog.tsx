"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  CalendarDays,
  AlertTriangle,
  Check,
  Minus,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
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
import { useCalendarRange } from "@/lib/api/calendar";
import { useAllServices } from "@/lib/api/doctor-services";
import { DoctorServiceSelect } from "@/components/queue/walk-in-dialog";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  programmeId?: string | null;
  triggerLabel?: string;
}

const FR_DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

const STEPS = [
  { label: "Médecin & Service", short: "1" },
  { label: "Détails du plan", short: "2" },
  { label: "Aperçu", short: "3" },
];

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
    else if (intervalUnit === "weeks")
      d.setDate(d.getDate() + intervalValue * 7 * i);
    else d.setMonth(d.getMonth() + intervalValue * i);
    // Skip weekends
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {STEPS.slice(0, totalSteps).map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 transition-colors",
                  isDone ? "bg-[var(--primary)]" : "bg-gray-200"
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : isDone
                    ? "bg-[var(--primary)] text-white"
                    : "bg-gray-100 text-[var(--text-muted)]"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : step.short}
              </div>
              <span
                className={cn(
                  "hidden sm:block text-xs font-medium",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : isDone
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)]"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Number stepper (+/-) ──────────────────────────────────── */
function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 24,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= min && v <= max) onChange(v);
          }}
          className="h-9 w-16 text-center font-mono font-bold"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Dialog ────────────────────────────────────────────── */
export function NewPlanDialog({
  patientId,
  programmeId,
  triggerLabel = "Nouveau plan",
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [totalSessions, setTotalSessions] = useState(4);
  const [intervalValue, setIntervalValue] = useState(4);
  const [intervalUnit, setIntervalUnit] = useState<
    "days" | "weeks" | "months"
  >("weeks");
  const [sessionPrice, setSessionPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [defaultHour, setDefaultHour] = useState(10);

  const { data: serviceGroups } = useAllServices();

  const selectedService = useMemo(() => {
    if (!serviceGroups || !selectedServiceId) return null;
    for (const g of serviceGroups) {
      const s = g.services.find((sv) => sv.id === selectedServiceId);
      if (s) return s;
    }
    return null;
  }, [serviceGroups, selectedServiceId]);

  const selectedDoctorName = useMemo(() => {
    if (!serviceGroups || !selectedDoctorId) return "";
    const g = serviceGroups.find((g) => g.doctor_id === selectedDoctorId);
    return g?.doctor_name ?? "";
  }, [serviceGroups, selectedDoctorId]);

  const projectedDates = useMemo(() => {
    if (!startDate || totalSessions < 1) return [];
    return projectDates(startDate, totalSessions, intervalValue, intervalUnit);
  }, [startDate, totalSessions, intervalValue, intervalUnit]);

  const rangeFrom = projectedDates[0] ?? "";
  const rangeTo = projectedDates[projectedDates.length - 1] ?? "";
  const { data: rangeData } = useCalendarRange(rangeFrom, rangeTo);
  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rangeData?.days ?? []) map.set(d.date, d.total);
    return map;
  }, [rangeData]);

  const computedTotal = sessionPrice
    ? Number(sessionPrice) * totalSessions
    : 0;

  const create = useCreatePlan();

  const reset = () => {
    setTitle("");
    setSelectedDoctorId("");
    setSelectedServiceId("");
    setTotalSessions(4);
    setIntervalValue(4);
    setIntervalUnit("weeks");
    setSessionPrice("");
    setStartDate("");
    setNotes("");
    setAutoSchedule(true);
    setDefaultHour(10);
    setStep(0);
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (!serviceGroups) return;
    for (const g of serviceGroups) {
      const s = g.services.find((sv) => sv.id === serviceId);
      if (s) {
        if (!title) setTitle(`${s.name} — cure ${totalSessions} séances`);
        if (!sessionPrice && s.default_price > 0)
          setSessionPrice(String(s.default_price));
        break;
      }
    }
  };

  const canGoToStep2 = selectedDoctorId.length > 0;
  const canGoToStep3 = title.trim().length > 0 && totalSessions >= 1;

  const submit = async () => {
    if (!title.trim()) return toast.error("Indiquer un titre de plan");

    try {
      const plan = await create.mutateAsync({
        patient_id: patientId,
        programme_id: programmeId ?? null,
        title: title.trim(),
        primary_service: selectedService?.name ?? null,
        doctor_service_id: selectedServiceId || null,
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

  const intervalLabel =
    intervalUnit === "weeks"
      ? "semaines"
      : intervalUnit === "days"
      ? "jours"
      : "mois";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau plan de traitement</DialogTitle>
          <DialogDescription>
            {step === 0
              ? "Choisissez le médecin et le service."
              : step === 1
              ? "Configurez les détails du plan."
              : "Vérifiez et confirmez le plan."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator currentStep={step} totalSteps={3} />

        {/* ─── Step 1: Doctor & Service ────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <DoctorServiceSelect
              selectedDoctorId={selectedDoctorId}
              selectedServiceId={selectedServiceId}
              onDoctorChange={setSelectedDoctorId}
              onServiceChange={handleServiceChange}
            />
            {selectedService && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {selectedService.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {selectedService.duration_minutes} min ·{" "}
                  {selectedService.default_price > 0
                    ? `${selectedService.default_price.toLocaleString("fr-FR")} MAD`
                    : "Prix non défini"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Plan details ────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="plan-title">Titre du plan</Label>
              <Input
                id="plan-title"
                placeholder="ex. Botox visage — cure 4 séances"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Sessions + Interval */}
            <div className="grid grid-cols-2 gap-4">
              <NumberStepper
                label="Nombre de séances"
                value={totalSessions}
                onChange={(v) => {
                  setTotalSessions(v);
                  if (
                    title &&
                    selectedService &&
                    title.includes("cure")
                  ) {
                    setTitle(
                      `${selectedService.name} — cure ${v} séances`
                    );
                  }
                }}
                min={1}
                max={24}
              />
              <div className="space-y-2">
                <Label className="text-xs">Intervalle</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={intervalValue}
                    onChange={(e) =>
                      setIntervalValue(Number(e.target.value) || 1)
                    }
                    className="h-9 w-16 text-center font-mono"
                  />
                  <Select
                    value={intervalUnit}
                    onValueChange={(v) =>
                      setIntervalUnit(v as typeof intervalUnit)
                    }
                  >
                    <SelectTrigger className="h-9 flex-1">
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
            </div>

            {/* Price + Start date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Prix par séance (MAD)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  step={50}
                  placeholder="ex. 2000"
                  value={sessionPrice}
                  onChange={(e) => setSessionPrice(e.target.value)}
                />
                {computedTotal > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Total :{" "}
                    <span className="font-mono font-bold">
                      {computedTotal.toLocaleString("fr-FR")} MAD
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-start">Date de début</Label>
                <Input
                  id="plan-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="plan-notes">Notes (optionnel)</Label>
              <Input
                id="plan-notes"
                placeholder="Notes cliniques"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ─── Step 3: Preview ──────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {selectedDoctorName && `Dr. ${selectedDoctorName} · `}
                    {selectedService?.name ?? "Service personnalisé"}
                  </p>
                </div>
                {computedTotal > 0 && (
                  <div className="text-right">
                    <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                      {computedTotal.toLocaleString("fr-FR")} MAD
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {totalSessions} x{" "}
                      {Number(sessionPrice).toLocaleString("fr-FR")} MAD
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                <span>
                  {totalSessions} séance{totalSessions > 1 ? "s" : ""}
                </span>
                <span>
                  Tous les {intervalValue} {intervalLabel}
                </span>
                {startDate && (
                  <span>
                    Début le{" "}
                    {new Date(startDate).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Auto-schedule toggle */}
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSchedule}
                  onChange={(e) => setAutoSchedule(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)] rounded"
                />
                <span className="flex-1">
                  <span className="font-medium text-[var(--text-primary)]">
                    Programmer automatiquement
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                    {totalSessions} rendez-vous créés dans le calendrier. La
                    réception confirme l&apos;heure.
                  </span>
                </span>
              </label>
              {autoSchedule && (
                <div className="mt-3 flex items-center gap-3 pl-7">
                  <Label className="text-xs whitespace-nowrap">
                    Heure par défaut
                  </Label>
                  <Input
                    type="number"
                    min={7}
                    max={20}
                    value={defaultHour}
                    onChange={(e) =>
                      setDefaultHour(Number(e.target.value) || 10)
                    }
                    className="w-20 h-8"
                  />
                  <span className="text-xs text-[var(--text-muted)]">h00</span>
                </div>
              )}
            </div>

            {/* Projected dates */}
            {projectedDates.length > 0 && autoSchedule && (
              <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--background)] border-b border-[var(--border)]">
                  <CalendarDays className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    Dates projetées
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {projectedDates.map((d, i) => {
                    const dayOfWeek =
                      FR_DAYS[new Date(d).getDay()];
                    const count = dayCounts.get(d) ?? 0;
                    const busy = count > 6;
                    return (
                      <div
                        key={d}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-[10px] font-bold text-[var(--primary)]">
                            {i + 1}
                          </span>
                          <span className="text-[var(--text-muted)]">
                            {dayOfWeek}{" "}
                            {new Date(d).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            busy
                              ? "font-bold text-amber-700"
                              : "text-[var(--text-muted)]"
                          )}
                        >
                          {busy && <AlertTriangle className="h-3 w-3" />}
                          {count} RDV
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {notes.trim() && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-medium">Notes :</span> {notes}
              </div>
            )}
          </div>
        )}

        {/* Footer with navigation */}
        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
                Retour
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>
              Annuler
            </Button>
            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 0 && !canGoToStep2) ||
                  (step === 1 && !canGoToStep3)
                }
              >
                Suivant
                <ChevronRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={create.isPending}
                className="gap-2"
              >
                {create.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    Créer le plan
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
