"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";

import { useCalendarRange } from "@/lib/api/calendar";
import { cn } from "@/lib/utils";

interface Props {
  isoDate: string;            // any date inside the target month
  onPickDate: (iso: string) => void;
  onSwitchToDay: () => void;
}

const FR_WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// First Monday on or before the 1st of the month — i.e., the top-left cell.
function startOfGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  // JS: 0=Sunday, 1=Monday, … We want Monday as the start.
  const dow = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - dow);
  return first;
}

export function MonthView({ isoDate, onPickDate, onSwitchToDay }: Props) {
  const target = new Date(isoDate);
  const year = target.getFullYear();
  const month = target.getMonth();

  const gridStart = useMemo(() => startOfGrid(year, month), [year, month]);
  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + 41); // 6 rows × 7 days - 1
    return d;
  }, [gridStart]);

  const { data, isLoading } = useCalendarRange(isoDay(gridStart), isoDay(gridEnd));
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data?.days ?? []) {
      map.set(d.date, d.total);
    }
    return map;
  }, [data]);

  const todayIso = isoDay(new Date());

  // Build 6×7 grid of dates
  const cells: Date[] = useMemo(() => {
    const out: Date[] = [];
    const cur = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [gridStart]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du mois…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {FR_MONTHS[month]} {year}
      </h2>
      <div className="grid grid-cols-7 gap-1">
        {FR_WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const iso = isoDay(d);
          const inMonth = d.getMonth() === month;
          const isToday = iso === todayIso;
          const count = countsByDate.get(iso) ?? 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                onPickDate(iso);
                onSwitchToDay();
              }}
              className={cn(
                "flex aspect-square flex-col items-end justify-between rounded-md border p-1.5 text-left transition-colors",
                inMonth ? "bg-white" : "bg-[var(--background)]",
                inMonth ? "border-[var(--border)]" : "border-transparent",
                isToday && "ring-2 ring-[var(--primary)]",
                "hover:border-[var(--primary)] hover:bg-[var(--background)]"
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold",
                  inMonth ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
                  isToday && "text-[var(--primary)]"
                )}
              >
                {d.getDate()}
              </span>
              {count > 0 && (
                <span className="self-start rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
