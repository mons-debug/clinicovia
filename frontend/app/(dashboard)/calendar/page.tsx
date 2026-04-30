"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  DoorOpen,
  CheckCircle2,
  XCircle,
  PlayCircle,
  UserCheck,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RescheduleDialog } from "@/components/calendar/reschedule-dialog";
import { TerminerDialog } from "@/components/calendar/terminer-dialog";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { QuickAddMenu } from "@/components/calendar/quick-add-menu";
import {
  useCalendarDay,
  useConfirmAppointment,
  useJourneyEvent,
  type CalendarAppointment,
  type JourneyEvent as Journey,
} from "@/lib/api/calendar";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtMonthLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtWeekRange(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `Semaine du ${fmt(monday)} au ${fmt(sunday)}`;
}

function fmtTime(t: string): string {
  // "10:00:00" -> "10:00"
  return t.slice(0, 5);
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  checked_in: "Arrivé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  scheduled: "outline",
  confirmed: "secondary",
  checked_in: "warning",
  in_progress: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "destructive",
};

// ── Appointment row ──────────────────────────────────────────────────

interface ApptRowProps {
  appt: CalendarAppointment;
  isoDate: string;
}

function ApptRow({ appt, isoDate }: ApptRowProps) {
  const ev = useJourneyEvent(isoDate);
  const confirmMut = useConfirmAppointment(isoDate);

  const fire = (event: Journey, label: string) => {
    ev.mutate(
      { appointmentId: appt.id, event },
      {
        onSuccess: () => toast.success(`${appt.patient_name} → ${label}`),
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : "Erreur";
          toast.error(msg);
        },
      }
    );
  };

  const confirm = () => {
    confirmMut.mutate(appt.id, {
      onSuccess: () => toast.success(`${appt.patient_name} → confirmé`),
      onError: (e: unknown) => {
        const msg = e instanceof Error ? e.message : "Erreur";
        toast.error(msg);
      },
    });
  };

  const isWalkIn = appt.kind === "walk_in";
  const isDone = appt.status === "completed" || appt.status === "cancelled" || appt.status === "no_show";
  const cardClass = cn(
    "flex items-stretch gap-3 rounded-lg p-3 transition-shadow",
    isDone
      ? "border border-[var(--border)] bg-[var(--background)] opacity-60"
      : isWalkIn
      ? "border-2 border-dashed border-[var(--primary)] bg-white hover:shadow-card-hover"
      : "border border-[var(--border)] bg-white hover:shadow-card-hover"
  );

  return (
    <div className={cardClass}>
      {/* Time column */}
      <div className="flex w-16 flex-col items-end justify-start border-r border-[var(--line-soft,_#E2E8F0)] pr-3 text-right">
        <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
          {isWalkIn ? "—" : fmtTime(appt.start_time)}
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          {isWalkIn ? "walk-in" : `${appt.duration_minutes}min`}
        </p>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-[var(--text-primary)]">
                {appt.patient_name}
              </p>
              {appt.is_first_visit && (
                <Badge variant="default" className="bg-[var(--primary)] text-[10px]">
                  ⭐ 1ʳᵉ visite
                </Badge>
              )}
              {isWalkIn && (
                <Badge variant="warning" className="text-[10px]">
                  ⚡ Walk-in
                </Badge>
              )}
              {appt.needs_confirmation && (
                <Badge variant="outline" className="border-[var(--warning)] text-[var(--warning)] text-[10px]">
                  ⏳ À confirmer
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">{appt.treatment}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
              {appt.room && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Salle {appt.room}
                </span>
              )}
              {appt.doctor_name && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: appt.doctor_color }}
                  />
                  {appt.doctor_name}
                </span>
              )}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[appt.status] ?? "outline"} className="shrink-0">
            {STATUS_LABEL[appt.status] ?? appt.status}
          </Badge>
        </div>

        {/* Action row */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {appt.status === "scheduled" || appt.status === "confirmed" ? (
            <>
              {appt.needs_confirmation && (
                <Button size="sm" variant="secondary" onClick={confirm} disabled={confirmMut.isPending}>
                  <CheckCircle2 className="h-3 w-3" />
                  Confirmer
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => fire("arrived", "Arrivé")} disabled={ev.isPending}>
                <UserCheck className="h-3 w-3" />
                Arrivé
              </Button>
              <RescheduleDialog appt={appt} isoDate={isoDate} />
              <Button size="sm" variant="ghost" onClick={() => fire("no_show", "Absent")} disabled={ev.isPending}>
                <XCircle className="h-3 w-3" />
                Absent
              </Button>
              <Button size="sm" variant="ghost" onClick={() => fire("cancel", "Annulé")} disabled={ev.isPending}>
                Annuler
              </Button>
            </>
          ) : appt.status === "checked_in" ? (
            <Button size="sm" variant="default" onClick={() => fire("started", "En cours")} disabled={ev.isPending}>
              <PlayCircle className="h-3 w-3" />
              Commencer
            </Button>
          ) : appt.status === "in_progress" ? (
            <TerminerDialog appt={appt} isoDate={isoDate} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const [iso, setIso] = useState<string>(isoToday());
  const [view, setView] = useState<ViewMode>("day");
  const { data, isLoading, isError, refetch, isFetching } = useCalendarDay(iso, view === "day" ? 10_000 : 60_000);

  const totals = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.counts).reduce((a, b) => a + b, 0);
  }, [data]);

  // Step navigation respects the current view
  const stepShift = (delta: number) => {
    if (view === "day") setIso(shiftDate(iso, delta));
    else if (view === "week") setIso(shiftDate(iso, delta * 7));
    else {
      const d = new Date(iso);
      d.setMonth(d.getMonth() + delta);
      setIso(d.toISOString().slice(0, 10));
    }
  };

  const headerTitle =
    view === "day" ? fmtDateLong(iso) : view === "week" ? fmtWeekRange(iso) : fmtMonthLong(iso);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize text-[var(--text-primary)]">
            {headerTitle}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {view === "day"
              ? `${totals} rendez-vous · synchronisation toutes les 10 s`
              : view === "week"
              ? "Vue semaine — clic sur un jour pour ouvrir"
              : "Vue mois — clic sur un jour pour ouvrir"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  view === v
                    ? "bg-[var(--primary)] text-white"
                    : "bg-white text-[var(--text-secondary)] hover:bg-[var(--background)]"
                )}
              >
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => stepShift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIso(isoToday())}
            className="gap-2"
          >
            <CalendarIcon className="h-3 w-3" />
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="sm" onClick={() => stepShift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {isFetching && view === "day" && <Loader2 className="h-3 w-3 animate-spin text-[var(--text-muted)]" />}
          <div className="ml-2">
            <QuickAddMenu isoDate={iso} />
          </div>
        </div>
      </div>

      {/* Status counts (day view only) */}
      {view === "day" && data && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.counts)
            .filter(([, n]) => n > 0)
            .map(([s, n]) => (
              <Badge key={s} variant={STATUS_VARIANT[s] ?? "outline"} className="font-mono">
                {STATUS_LABEL[s] ?? s} · {n}
              </Badge>
            ))}
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <WeekView
          isoDate={iso}
          onPickDate={setIso}
          onSwitchToDay={() => setView("day")}
        />
      )}

      {/* Month view */}
      {view === "month" && (
        <MonthView
          isoDate={iso}
          onPickDate={setIso}
          onSwitchToDay={() => setView("day")}
        />
      )}

      {/* Day body */}
      {view === "day" && (
        isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du calendrier…
        </div>
      ) : isError || !data ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
          <p>Impossible de charger le calendrier.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Réessayer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Doctor columns */}
          {data.doctors.length === 0 && data.unassigned.length === 0 ? (
            <Card className="col-span-full p-12 text-center">
              <DoorOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
                Aucun rendez-vous ce jour
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Utilisez le bouton « Nouveau patient » pour ajouter un rendez-vous.
              </p>
            </Card>
          ) : (
            <>
              {data.doctors.map((doc) => (
                <div
                  key={doc.doctor_id ?? "unassigned"}
                  className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: doc.doctor_color }}
                      />
                      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {doc.doctor_name}
                      </h3>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {doc.appointments.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {doc.appointments.map((a) => (
                      <ApptRow key={a.id} appt={a} isoDate={iso} />
                    ))}
                  </div>
                </div>
              ))}
              {data.unassigned.length > 0 && (
                <div className="flex flex-col rounded-xl border border-dashed border-[var(--border)] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        Non assigné
                      </h3>
                    </div>
                    <Badge variant="outline" className={cn("font-mono")}>
                      {data.unassigned.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.unassigned.map((a) => (
                      <ApptRow key={a.id} appt={a} isoDate={iso} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )
      )}
    </div>
  );
}
