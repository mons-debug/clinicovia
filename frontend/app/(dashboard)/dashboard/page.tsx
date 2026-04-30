"use client";

import Link from "next/link";
import {
  Calendar as CalendarIcon,
  UserPlus,
  DollarSign,
  Clock,
  Activity,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { useAuthStore } from "@/stores/auth-store";

const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  checked_in: "Arrivé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const APPT_STATUS_VARIANT: Record<string, "default" | "outline" | "secondary" | "warning" | "success" | "destructive"> = {
  scheduled: "outline",
  confirmed: "secondary",
  checked_in: "warning",
  in_progress: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "destructive",
};

function fmtMad(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function fmtTodayLong(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();
  const role = useAuthStore((s) => s.currentRole);
  const isReception = role === "receptionist";
  const isDoctor = role === "doctor";

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const m = data.metrics;
  const revenueDeltaPct =
    m.revenue_last_month > 0
      ? Math.round(((m.revenue_mtd - m.revenue_last_month) / m.revenue_last_month) * 100)
      : null;

  // KPI cards — role-aware. Reception focuses on flow; doctor on
  // clinical load; owner/manager sees the full picture.
  const allKpis = {
    rdv: {
      label: "Rendez-vous aujourd'hui",
      value: m.today_appointments.toString(),
      change:
        m.today_appointments_delta >= 0
          ? `+${m.today_appointments_delta} vs hier`
          : `${m.today_appointments_delta} vs hier`,
      changeUp: m.today_appointments_delta >= 0,
      icon: CalendarIcon,
      href: "/calendar",
    },
    queue: {
      label: "En salle d'attente",
      value: m.in_queue.toString(),
      change: m.in_queue === 0 ? "Aucun patient en cours" : "Patients en cours",
      changeUp: true,
      icon: Clock,
      href: "/queue",
    },
    newPatients: {
      label: "Nouveaux patients (7 j)",
      value: m.new_patients_week.toString(),
      change: "Cette semaine",
      changeUp: true,
      icon: UserPlus,
      href: "/patients?tab=patients",
    },
    leads: {
      label: "Leads WhatsApp (7 j)",
      value: m.leads_week.toString(),
      change: m.leads_total === 0 ? "Aucun lead actif" : `${m.leads_total} actifs au total`,
      changeUp: true,
      icon: UserPlus,
      href: "/patients?tab=leads",
    },
    plans: {
      label: "Plans actifs",
      value: m.active_plans.toString(),
      change: "Cures en cours",
      changeUp: true,
      icon: Activity,
      href: "/patients",
    },
    revenue: {
      label: "Recettes (MTD)",
      value: `${fmtMad(m.revenue_mtd)} ${m.currency}`,
      change:
        revenueDeltaPct === null
          ? "—"
          : revenueDeltaPct >= 0
          ? `+${revenueDeltaPct}% vs mois dernier`
          : `${revenueDeltaPct}% vs mois dernier`,
      changeUp: (revenueDeltaPct ?? 0) >= 0,
      icon: DollarSign,
      href: "/invoices",
    },
  } as const;

  const kpis = isReception
    ? [allKpis.rdv, allKpis.queue, allKpis.newPatients]
    : isDoctor
    ? [allKpis.rdv, allKpis.queue, allKpis.plans]
    : [allKpis.rdv, allKpis.queue, allKpis.newPatients, allKpis.leads, allKpis.plans, allKpis.revenue];

  return (
    <div className="space-y-6 p-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize text-[var(--text-primary)]">
            {greeting()}, {data.user.first_name}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] capitalize">{fmtTodayLong()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm">
            <Link href="/queue"><UserPlus className="h-3 w-3" />Nouveau patient · Walk-in</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/calendar"><CalendarIcon className="h-3 w-3" />Calendrier</Link>
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${kpis.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-5"}`}>
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="p-5 transition-shadow hover:shadow-card-hover">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-lighter)] text-[var(--primary)]">
                  <k.icon className="h-5 w-5" />
                </div>
                <span
                  className={`inline-flex items-center text-xs font-medium ${
                    k.changeUp ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {k.changeUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{k.value}</p>
              <p className="text-xs text-[var(--text-secondary)]">{k.label}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{k.change}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Rendez-vous du jour
            </h3>
            <Link href="/calendar" className="text-xs font-medium text-[var(--primary)] hover:underline">
              Voir tout →
            </Link>
          </div>
          {data.today_appointments.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-[var(--border)] p-8 text-center">
              <CalendarIcon className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
              <p className="mt-2 text-sm text-[var(--text-muted)]">Aucun rendez-vous programmé aujourd&apos;hui</p>
              <Link href="/calendar" className="mt-2 inline-block text-xs font-medium text-[var(--primary)] hover:underline">
                Programmer un rendez-vous →
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[var(--line-soft,_#E2E8F0)]">
              {data.today_appointments.map((a) => (
                <Link
                  key={a.id}
                  href={`/patients/${a.patient_id}`}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-[var(--background)]"
                >
                  <span className="font-mono text-sm font-bold text-[var(--text-primary)] w-12">
                    {a.start_time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-primary)]">{a.patient_name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {a.treatment}
                      {a.room && <span> · Salle {a.room}</span>}
                    </p>
                  </div>
                  <Badge variant={APPT_STATUS_VARIANT[a.status] ?? "outline"}>
                    {APPT_STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent patients */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Patients récents
            </h3>
            <Link href="/patients" className="text-xs font-medium text-[var(--primary)] hover:underline">
              Voir tous →
            </Link>
          </div>
          {data.recent_patients.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--text-muted)]">Aucun patient pour l&apos;instant.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.recent_patients.map((p) => (
                <Link
                  key={p.id}
                  href={`/patients/${p.id}`}
                  className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-[var(--background)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-xs font-bold text-[var(--primary)]">
                    {p.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{p.phone}</p>
                  </div>
                  {p.intake_status && p.intake_status !== "active" && (
                    <Badge variant="warning" className="text-[10px]">
                      <ClipboardList className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
