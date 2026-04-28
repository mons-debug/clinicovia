"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  CalendarDays,
  MessageSquare,
  Bell,
  CheckCircle,
  Clock,
  List,
  BarChart3,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import {
  useAppointments,
  useSendAppointmentWhatsApp,
  useUpdateAppointmentStatus,
  type AppointmentResponse,
} from "@/lib/api/appointments";

type ViewMode = "day" | "week" | "month" | "list";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00
const HOUR_HEIGHT = 72; // px per hour

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return fmtDate(d);
}

function getMonthStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return fmtDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function getMonthEnd(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function shortTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#F59E0B",
  confirmed: "#3B82F6",
  checked_in: "#10B981",
  in_progress: "#8B5CF6",
  completed: "#059669",
  cancelled: "#EF4444",
  no_show: "#6B7280",
};

function WhatsAppActions({ appointment }: { appointment: AppointmentResponse }) {
  const sendWa = useSendAppointmentWhatsApp();
  const [open, setOpen] = useState(false);

  const handle = async (type: "confirmation" | "reminder") => {
    setOpen(false);
    try {
      await sendWa.mutateAsync({ id: appointment.id, type });
      toast.success(`${type === "reminder" ? "Reminder" : "Confirmation"} sent via WhatsApp`);
    } catch {
      toast.error("Failed to send WhatsApp message");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="rounded p-1 transition-colors hover:bg-gray-100"
        title="Send WhatsApp"
      >
        <MessageSquare className="h-3.5 w-3.5" style={{ color: "#25D366" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-40 rounded-lg border border-border bg-white py-1 shadow-lg">
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handle("confirmation"); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-gray-50">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Send Confirmation
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handle("reminder"); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-gray-50">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              Send Reminder
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Appointment block for day/week calendar ──
function AppointmentBlock({ apt, style }: { apt: AppointmentResponse; style?: React.CSSProperties }) {
  const isCancelled = apt.status === "cancelled" || apt.status === "no_show";
  const color = apt.doctor_color || STATUS_COLORS[apt.status] || "#6B7280";

  return (
    <Link
      href={`/appointments/${apt.id}`}
      className={`absolute left-1 right-1 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-[10px] transition-all hover:shadow-md hover:z-10 ${isCancelled ? "opacity-40" : ""}`}
      style={{
        ...style,
        borderLeftColor: color,
        backgroundColor: `${color}15`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className={`truncate font-semibold text-text-primary ${isCancelled ? "line-through" : ""}`}>
          {apt.patient_name}
        </p>
        {!isCancelled && <WhatsAppActions appointment={apt} />}
      </div>
      <p className="truncate text-text-muted">
        {shortTime(apt.start_time)} - {apt.treatment}
      </p>
    </Link>
  );
}

export default function AppointmentsPage() {
  const [view, setView] = useState<ViewMode>("day");
  const today = fmtDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const statusMutation = useUpdateAppointmentStatus();

  // Calculate date range based on view
  const { dateFrom, dateTo } = useMemo(() => {
    switch (view) {
      case "week":
        const ws = getWeekStart(selectedDate);
        return { dateFrom: ws, dateTo: addDays(ws, 6) };
      case "month":
        return { dateFrom: getMonthStart(selectedDate), dateTo: getMonthEnd(selectedDate) };
      case "list":
        return { dateFrom: today, dateTo: addDays(today, 90) };
      default:
        return { dateFrom: selectedDate, dateTo: selectedDate };
    }
  }, [view, selectedDate, today]);

  const { data, isLoading, isError, error } = useAppointments(
    { date_from: dateFrom, date_to: dateTo, page_size: 200 },
    { enabled: true },
  );

  const appointments = data?.appointments ?? [];
  const stats = data?.stats;

  const navigate = useCallback((offset: number) => {
    setSelectedDate((d) => {
      if (view === "week") return addDays(d, offset * 7);
      if (view === "month") {
        const dt = new Date(d + "T00:00:00");
        dt.setMonth(dt.getMonth() + offset);
        return fmtDate(dt);
      }
      return addDays(d, offset);
    });
  }, [view]);

  const headerLabel = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    if (view === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const ws = new Date(getWeekStart(selectedDate) + "T00:00:00");
      const we = new Date(addDays(getWeekStart(selectedDate), 6) + "T00:00:00");
      return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${we.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "list") return "Upcoming Appointments";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, selectedDate]);

  const dayAppointments = useMemo(
    () => appointments.filter((a) => a.appointment_date === selectedDate),
    [appointments, selectedDate],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading appointments...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-text-secondary hover:bg-gray-100">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setSelectedDate(today)} className="rounded-lg px-3 py-1 text-xs font-medium text-text-primary hover:bg-gray-100">
                Today
              </button>
              <button onClick={() => navigate(1)} className="rounded-lg p-1.5 text-text-secondary hover:bg-gray-100">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
          <h1 className="text-lg font-semibold text-text-primary">{headerLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border border-border bg-white">
            {([
              { key: "day", icon: CalendarDays },
              { key: "week", icon: Calendar },
              { key: "month", icon: BarChart3 },
              { key: "list", icon: List },
            ] as { key: ViewMode; icon: typeof CalendarDays }[]).map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === key ? "bg-gray-100 text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {key}
              </button>
            ))}
          </div>
          <Link
            href="/appointments/new"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            <Plus className="h-4 w-4" />
            Book
          </Link>
        </div>
      </div>

      {/* ── Stats chips ── */}
      {stats && stats.total > 0 && (
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Total", value: stats.total, color: "#6B7280" },
            { label: "Scheduled", value: stats.scheduled, color: STATUS_COLORS.scheduled },
            { label: "Confirmed", value: stats.confirmed, color: STATUS_COLORS.confirmed },
            { label: "Checked In", value: stats.checked_in, color: STATUS_COLORS.checked_in },
            { label: "Completed", value: stats.completed, color: STATUS_COLORS.completed },
          ].filter(s => s.value > 0).map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-medium text-text-secondary">{s.label}</span>
              <span className="text-xs font-bold text-text-primary">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-16">
          <CalendarDays className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">No appointments</p>
          <p className="mt-1 text-xs text-text-secondary">Book your first appointment to get started.</p>
          <Link href="/appointments/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--primary-light)" }}>
            <Plus className="h-4 w-4" /> Book Appointment
          </Link>
        </div>
      )}

      {/* ══════════════ DAY VIEW ══════════════ */}
      {view === "day" && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
              {/* Time grid lines */}
              {HOURS.map((hour, i) => (
                <div key={hour} className="absolute left-0 right-0 border-t border-border/40" style={{ top: i * HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 left-2 text-[10px] font-medium text-text-muted">{formatHour(hour)}</span>
                </div>
              ))}
              {/* Current time indicator */}
              {selectedDate === today && (() => {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const topOffset = ((nowMin - HOURS[0] * 60) / 60) * HOUR_HEIGHT;
                if (topOffset < 0 || topOffset > HOURS.length * HOUR_HEIGHT) return null;
                return (
                  <div className="absolute left-12 right-0 z-20" style={{ top: topOffset }}>
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <div className="h-[1.5px] flex-1 bg-red-500" />
                    </div>
                  </div>
                );
              })()}
              {/* Appointment blocks */}
              <div className="absolute left-14 right-2 top-0">
                {dayAppointments.map((apt) => {
                  const startMin = timeToMinutes(apt.start_time);
                  const endMin = timeToMinutes(apt.end_time);
                  const top = ((startMin - HOURS[0] * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
                  return <AppointmentBlock key={apt.id} apt={apt} style={{ top, height }} />;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ WEEK VIEW ══════════════ */}
      {view === "week" && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {/* Day headers */}
          <div className="flex border-b border-border">
            <div className="w-14 shrink-0" />
            {Array.from({ length: 7 }, (_, i) => {
              const dateStr = addDays(getWeekStart(selectedDate), i);
              const d = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === today;
              return (
                <div key={dateStr} className={`flex-1 border-l border-border/30 py-2 text-center ${isToday ? "bg-blue-50/50" : ""}`}>
                  <p className="text-[10px] font-medium text-text-muted">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <button
                    onClick={() => { setSelectedDate(dateStr); setView("day"); }}
                    className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      isToday ? "bg-blue-500 text-white" : "text-text-primary hover:bg-gray-100"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Time grid */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 18rem)" }}>
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
              {HOURS.map((hour, i) => (
                <div key={hour} className="absolute left-0 right-0 border-t border-border/30" style={{ top: i * HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 left-1 text-[9px] font-medium text-text-muted">{formatHour(hour)}</span>
                </div>
              ))}
              {/* Columns */}
              <div className="absolute left-14 right-0 top-0 flex">
                {Array.from({ length: 7 }, (_, i) => {
                  const dateStr = addDays(getWeekStart(selectedDate), i);
                  const dayApts = appointments.filter((a) => a.appointment_date === dateStr);
                  const isToday = dateStr === today;
                  return (
                    <div key={dateStr} className={`relative flex-1 border-l border-border/20 ${isToday ? "bg-blue-50/30" : ""}`} style={{ height: HOURS.length * HOUR_HEIGHT }}>
                      {dayApts.map((apt) => {
                        const startMin = timeToMinutes(apt.start_time);
                        const endMin = timeToMinutes(apt.end_time);
                        const top = ((startMin - HOURS[0] * 60) / 60) * HOUR_HEIGHT;
                        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);
                        return <AppointmentBlock key={apt.id} apt={apt} style={{ top, height }} />;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MONTH VIEW ══════════════ */}
      {view === "month" && (() => {
        const monthStart = new Date(getMonthStart(selectedDate) + "T00:00:00");
        const monthEnd = new Date(getMonthEnd(selectedDate) + "T00:00:00");
        const calStart = new Date(monthStart);
        calStart.setDate(calStart.getDate() - calStart.getDay()); // start from Sunday
        const calEnd = new Date(monthEnd);
        calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay())); // end on Saturday

        const weeks: string[][] = [];
        const cursor = new Date(calStart);
        while (cursor <= calEnd) {
          const week: string[] = [];
          for (let i = 0; i < 7; i++) {
            week.push(fmtDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
          weeks.push(week);
        }

        return (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-text-muted">{d}</div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-border/50 last:border-b-0">
                {week.map((dateStr) => {
                  const d = new Date(dateStr + "T00:00:00");
                  const isToday = dateStr === today;
                  const isCurrentMonth = d.getMonth() === monthStart.getMonth();
                  const dayApts = appointments.filter((a) => a.appointment_date === dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[90px] border-l border-border/30 first:border-l-0 p-1 ${!isCurrentMonth ? "bg-gray-50/50" : ""}`}
                    >
                      <button
                        onClick={() => { setSelectedDate(dateStr); setView("day"); }}
                        className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                          isToday
                            ? "bg-blue-500 text-white"
                            : isCurrentMonth
                              ? "text-text-primary hover:bg-gray-100"
                              : "text-text-muted"
                        }`}
                      >
                        {d.getDate()}
                      </button>
                      <div className="space-y-0.5">
                        {dayApts.slice(0, 3).map((apt) => {
                          const color = apt.doctor_color || STATUS_COLORS[apt.status] || "#6B7280";
                          return (
                            <Link
                              key={apt.id}
                              href={`/appointments/${apt.id}`}
                              className="block truncate rounded px-1 py-0.5 text-[9px] font-medium transition-colors hover:opacity-80"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {apt.start_time?.slice(0, 5)} {apt.patient_name}
                            </Link>
                          );
                        })}
                        {dayApts.length > 3 && (
                          <button
                            onClick={() => { setSelectedDate(dateStr); setView("day"); }}
                            className="block w-full text-left px-1 text-[9px] font-medium text-blue-500 hover:underline"
                          >
                            +{dayApts.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ══════════════ LIST VIEW ══════════════ */}
      {view === "list" && appointments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/80">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Patient</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Date & Time</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Treatment</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((apt) => (
                <tr key={apt.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/patients/${apt.patient_id}`} className="flex items-center gap-2 group">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: apt.doctor_color || "#0D4F6C" }}>
                        {apt.patient_initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary group-hover:text-primary-light">{apt.patient_name}</p>
                        {apt.doctor_name && <p className="text-[10px] text-text-muted">{apt.doctor_name}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-primary">
                      {new Date(apt.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-[10px] text-text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {shortTime(apt.start_time)} - {shortTime(apt.end_time)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">{apt.treatment}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={apt.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} variant={getStatusVariant(apt.status)} dot />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {!["cancelled", "no_show", "completed"].includes(apt.status) && (
                        <WhatsAppActions appointment={apt} />
                      )}
                      {apt.status === "scheduled" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: apt.id, status: "confirmed" })}
                          className="rounded px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
