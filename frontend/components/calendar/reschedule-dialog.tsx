"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";

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

import { useReschedule, type CalendarAppointment } from "@/lib/api/calendar";

interface Props {
  appt: CalendarAppointment;
  isoDate: string;
}

export function RescheduleDialog({ appt, isoDate }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(appt.appointment_date);
  const [time, setTime] = useState(appt.start_time?.slice(0, 5) || "10:00");
  const [duration, setDuration] = useState(appt.duration_minutes || 30);

  const mut = useReschedule(isoDate);

  const submit = async () => {
    try {
      await mut.mutateAsync({
        appointmentId: appt.id,
        appointment_date: date,
        start_time: `${time}:00`,
        duration_minutes: duration,
      });
      toast.success("Rendez-vous reprogrammé");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <CalendarClock className="h-3 w-3" />
          Reprogrammer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogrammer le rendez-vous</DialogTitle>
          <DialogDescription>
            {appt.patient_name} · {appt.treatment}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="r-date">Nouvelle date</Label>
            <Input
              id="r-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="r-time">Heure</Label>
              <Input
                id="r-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-duration">Durée (min)</Label>
              <Input
                id="r-duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 30)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Reprogrammer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
