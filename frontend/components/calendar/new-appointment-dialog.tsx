"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

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

import { useCreateAppointment } from "@/lib/api/appointments";
import { usePatients } from "@/lib/api/patients";
import { useAllServices } from "@/lib/api/doctor-services";
import { DoctorServiceSelect } from "@/components/queue/walk-in-dialog";

const KIND_OPTIONS = [
  { value: "consultation", label: "Consultation" },
  { value: "session", label: "Séance" },
  { value: "control", label: "Contrôle" },
  { value: "other", label: "Autre" },
];

interface Props {
  isoDate: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  // Pre-fill with a known patient (skips the search box)
  prefillPatientId?: string;
  prefillPatientLabel?: string;
  // Pre-fill suggested kind / default treatment string
  prefillKind?: string;
  prefillTreatment?: string;
}

export function NewAppointmentDialog({
  isoDate,
  triggerLabel = "Nouveau RDV",
  triggerVariant = "default",
  prefillPatientId,
  prefillPatientLabel,
  prefillKind,
  prefillTreatment,
}: Props) {
  const [open, setOpen] = useState(false);

  const [patientSearch, setPatientSearch] = useState(prefillPatientLabel ?? "");
  const [patientId, setPatientId] = useState<string>(prefillPatientId ?? "");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(isoDate);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [duration, setDuration] = useState<number>(30);
  const [kind, setKind] = useState<string>(prefillKind ?? "consultation");
  const [treatment, setTreatment] = useState<string>(prefillTreatment ?? "");
  const [room, setRoom] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Reset to current isoDate whenever the parent flips dates
  useEffect(() => {
    if (!open) setDate(isoDate);
  }, [isoDate, open]);

  // Re-apply prefills when reopening (so the dialog stays sticky to the parent)
  useEffect(() => {
    if (open) {
      if (prefillPatientId) setPatientId(prefillPatientId);
      if (prefillPatientLabel) setPatientSearch(prefillPatientLabel);
      if (prefillKind) setKind(prefillKind);
      if (prefillTreatment !== undefined) setTreatment(prefillTreatment);
    }
  }, [open, prefillPatientId, prefillPatientLabel, prefillKind, prefillTreatment]);

  const { data: patientsData } = usePatients({
    search: patientSearch || undefined,
    page_size: 10,
  });
  const patients = patientsData?.patients ?? [];

  const { data: serviceGroups } = useAllServices();

  const selectedService = useMemo(() => {
    if (!serviceGroups || !selectedServiceId) return null;
    for (const g of serviceGroups) {
      const s = g.services.find((s) => s.id === selectedServiceId);
      if (s) return s;
    }
    return null;
  }, [serviceGroups, selectedServiceId]);

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (!serviceGroups) return;
    for (const g of serviceGroups) {
      const s = g.services.find((s) => s.id === serviceId);
      if (s) {
        setTreatment(s.name);
        setDuration(s.duration_minutes);
        break;
      }
    }
  };

  const createMut = useCreateAppointment();
  const qc = useQueryClient();

  const endTime = useMemo(() => {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const totalMin = h * 60 + m + (duration || 30);
    const eh = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
    const em = String(totalMin % 60).padStart(2, "0");
    return `${eh}:${em}`;
  }, [startTime, duration]);

  const reset = () => {
    setPatientId(prefillPatientId ?? "");
    setPatientSearch(prefillPatientLabel ?? "");
    setSelectedDoctorId("");
    setSelectedServiceId("");
    setStartTime("10:00");
    setDuration(30);
    setKind(prefillKind ?? "consultation");
    setTreatment(prefillTreatment ?? "");
    setRoom("");
    setNotes("");
  };

  const submit = async () => {
    if (!patientId) return toast.error("Choisir un patient");
    if (!treatment.trim()) return toast.error("Indiquer le traitement");
    if (!startTime) return toast.error("Indiquer l'heure");

    try {
      await createMut.mutateAsync({
        patient_id: patientId,
        doctor_id: selectedDoctorId || null,
        doctor_service_id: selectedServiceId || null,
        appointment_date: date,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        duration_minutes: duration,
        treatment: treatment.trim(),
        kind,
        room: room.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Rendez-vous créé");
      qc.invalidateQueries({ queryKey: ["calendar", "day", date] });
      qc.invalidateQueries({ queryKey: ["calendar", "day", isoDate] });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la création");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant}>
          <Plus className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
          <DialogDescription>
            Programmez un rendez-vous pour un patient existant.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Patient picker — collapsed when pre-filled */}
          {prefillPatientId ? (
            <div className="sm:col-span-2 space-y-2">
              <Label>Patient</Label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <span className="font-medium">{prefillPatientLabel ?? "Patient sélectionné"}</span>
              </div>
            </div>
          ) : (
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="patient-search">Patient</Label>
              <Input
                id="patient-search"
                placeholder="Rechercher par nom ou téléphone…"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setPatientId(""); // clear selection on new search
                }}
              />
              {patients.length > 0 && !patientId && (
                <div className="max-h-44 overflow-y-auto rounded-md border border-[var(--border)] bg-white">
                  {patients.slice(0, 8).map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setPatientId(p.id);
                        setPatientSearch(`${p.first_name} ${p.last_name}`);
                      }}
                      className="flex w-full items-center justify-between border-b border-[var(--line-soft,_#E2E8F0)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                    >
                      <span className="font-medium">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {p.phone_country_code}
                        {p.phone}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {patientId && (
                <p className="text-xs text-[var(--success)]">✓ Patient sélectionné</p>
              )}
            </div>
          )}

          {/* Date + time */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="time">Heure</Label>
              <Input
                id="time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Durée (min)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 30)}
              />
            </div>
          </div>

          {/* Kind + treatment */}
          <div className="space-y-2">
            <Label htmlFor="kind">Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Doctor + Service */}
          <div className="sm:col-span-2">
            <DoctorServiceSelect
              selectedDoctorId={selectedDoctorId}
              selectedServiceId={selectedServiceId}
              onDoctorChange={setSelectedDoctorId}
              onServiceChange={handleServiceChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room">Salle</Label>
            <Input
              id="room"
              placeholder="ex. 1, 2, Laser…"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Notes internes (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Créer le rendez-vous
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
