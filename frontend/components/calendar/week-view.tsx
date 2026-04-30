"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { type CalendarDay } from "@/lib/api/calendar";
import { cn } from "@/lib/utils";

interface Props {
  isoDate: string;            // any date inside the target week
  onPickDate: (iso: string) => void;
  onSwitchToDay: () => void;
}

const FR_WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday on or before `d`
function mondayOf(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dow);
  return r;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-amber-100 text-amber-800",
  in_progress: "bg-[var(--primary)] text-white",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700 line-through",
  no_show: "bg-rose-100 text-rose-700",
};

export function WeekView({ isoDate, onPickDate, onSwitchToDay }: Props) {
  const monday = useMemo(() => mondayOf(new Date(isoDate)), [isoDate]);
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [monday]);

  const token = useAuthStore((s) => s.accessToken);
  const queries = useQueries({
    queries: days.map((d) => {
      const iso = isoDay(d);
      return {
        queryKey: ["calendar", "day", iso],
        queryFn: () =>
          apiClient<CalendarDay>(`/calendar/day?date=${encodeURIComponent(iso)}`, {
            token: token ?? undefined,
          }),
        staleTime: 30_000,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const todayIso = isoDay(new Date());

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la semaine…
      </div>
    );
  }

  // For each day, flatten all appointments (across doctors + unassigned) and sort by time.
  const dayBuckets = days.map((d, i) => {
    const data = queries[i].data;
    if (!data) return { date: d, appts: [] as CalendarDay["unassigned"] };
    const all = [...data.unassigned, ...data.doctors.flatMap((doc) => doc.appointments)];
    all.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    return { date: d, appts: all };
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {dayBuckets.map(({ date: d, appts }) => {
        const iso = isoDay(d);
        const isToday = iso === todayIso;
        return (
          <div
            key={iso}
            className={cn(
              "flex flex-col rounded-xl border bg-white p-2",
              isToday ? "border-[var(--primary)]" : "border-[var(--border)]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                onPickDate(iso);
                onSwitchToDay();
              }}
              className="mb-2 flex items-baseline justify-between border-b border-[var(--line-soft,_#E2E8F0)] pb-2 text-left hover:opacity-80"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {FR_WEEKDAYS[(d.getDay() + 6) % 7]}
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  isToday ? "text-[var(--primary)]" : "text-[var(--text-primary)]"
                )}
              >
                {d.getDate()}
              </span>
            </button>

            <div className="flex flex-col gap-1.5">
              {appts.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-[var(--text-muted)]">—</p>
              ) : (
                appts.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-md px-1.5 py-1 text-[10px] leading-tight",
                      STATUS_COLOR[a.status] ?? "bg-slate-100 text-slate-700",
                      a.kind === "walk_in" && "border border-dashed border-[var(--primary)]"
                    )}
                  >
                    <p className="font-mono font-bold">
                      {a.kind === "walk_in" ? "—" : (a.start_time || "").slice(0, 5)}
                    </p>
                    <p className="truncate font-medium">{a.patient_name}</p>
                    <p className="truncate opacity-80">{a.treatment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
