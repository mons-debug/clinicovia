"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  UserPlus,
  DollarSign,
  Clock,
  Plus,
  Activity,
  Loader2,
  CheckCircle,
  User,
  ArrowRight,
  CalendarPlus,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useAppointments, useUpdateAppointmentStatus, type AppointmentResponse } from "@/lib/api/appointments";
import { usePatients } from "@/lib/api/patients";
import { QuickAddPatientModal } from "@/components/patients/quick-add-modal";
import { toast } from "sonner";

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function shortTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
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

// ── Doctor Dashboard ──────────────────────────────────────────

function DoctorDashboard() {
  const { user } = useAuthStore();
  const today = fmtDate(new Date());
  const statusMutation = useUpdateAppointmentStatus();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const { data: aptData, isLoading: aptLoading } = useAppointments({
    date_from: today,
    date_to: today,
    page_size: 100,
  });

  const { data: patientsData, isLoading: patsLoading } = usePatients({
    page_size: 5,
    sort_by: "created_at",
    sort_dir: "desc",
  });

  const appointments = aptData?.appointments ?? [];
  const stats = aptData?.stats;
  const recentPatients = patientsData?.patients ?? [];

  const scheduled = useMemo(
    () => appointments.filter((a) => ["scheduled", "confirmed"].includes(a.status)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments],
  );
  const waiting = useMemo(() => appointments.filter((a) => a.status === "checked_in"), [appointments]);
  const inProgress = useMemo(() => appointments.filter((a) => a.status === "in_progress"), [appointments]);

  const handleStatus = (id: string, status: string) => {
    statusMutation.mutate(
      { id, status },
      { onSuccess: () => toast.success("Statut mis a jour"), onError: () => toast.error("Erreur") },
    );
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon apres-midi";
    return "Bonsoir";
  })();

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting}, Dr. {user?.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary capitalize">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
          >
            <UserPlus className="h-4 w-4" />
            Nouveau patient
          </button>
          <Link
            href="/appointments/new"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            <CalendarPlus className="h-4 w-4" />
            Nouveau RDV
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Aujourd'hui", value: stats.total, icon: Calendar, color: "#3B82F6", bg: "#EFF6FF" },
            { label: "En attente", value: stats.checked_in, icon: Clock, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "En cours", value: stats.in_progress, icon: Activity, color: "#8B5CF6", bg: "#F5F3FF" },
            { label: "Termines", value: stats.completed, icon: CheckCircle, color: "#059669", bg: "#ECFDF5" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: s.bg }}>
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs text-text-secondary">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-text-primary">{s.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Today's schedule */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Programme du jour</h3>
            <Link href="/appointments" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--primary-light)" }}>
              Voir l'agenda
            </Link>
          </div>

          {aptLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : scheduled.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-2 text-sm text-text-secondary">Aucun rendez-vous prevu</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {scheduled.map((apt) => {
                const color = apt.doctor_color || STATUS_COLORS[apt.status] || "#6B7280";
                return (
                  <div key={apt.id} className="flex items-center gap-4 py-3">
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                      {shortTime(apt.start_time)}
                    </span>
                    <div className="h-8 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/patients/${apt.patient_id}`} className="text-sm font-medium text-text-primary hover:text-primary-light">
                        {apt.patient_name}
                      </Link>
                      <p className="text-xs text-text-secondary">{apt.treatment}</p>
                    </div>
                    <button
                      onClick={() => handleStatus(apt.id, "checked_in")}
                      disabled={statusMutation.isPending}
                      className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Check in
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Waiting room */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Salle d'attente</h3>
            <Link href="/queue" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--primary-light)" }}>
              Voir tout
            </Link>
          </div>

          {/* In progress */}
          {inProgress.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-purple-500">En cours</p>
              {inProgress.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 rounded-lg bg-purple-50 p-2.5 mb-1.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
                    {apt.patient_initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary">{apt.patient_name}</p>
                    <p className="text-[10px] text-text-muted">{apt.treatment}</p>
                  </div>
                  <button
                    onClick={() => handleStatus(apt.id, "completed")}
                    className="rounded px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Terminer
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Waiting */}
          {waiting.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500">En attente</p>
              {waiting.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 rounded-lg bg-amber-50 p-2.5 mb-1.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                    {apt.patient_initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary">{apt.patient_name}</p>
                    <p className="text-[10px] text-text-muted">{apt.treatment}</p>
                  </div>
                  <span className="text-[10px] font-medium text-amber-600">
                    {elapsedMinutes(apt.updated_at)} min
                  </span>
                  <button
                    onClick={() => handleStatus(apt.id, "in_progress")}
                    className="rounded px-2 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-100"
                  >
                    Demarrer
                  </button>
                </div>
              ))}
            </div>
          )}

          {waiting.length === 0 && inProgress.length === 0 && (
            <div className="mt-4 py-6 text-center">
              <Clock className="mx-auto h-7 w-7 text-text-muted" />
              <p className="mt-2 text-xs text-text-secondary">Salle d'attente vide</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent patients */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Derniers patients</h3>
          <Link href="/patients" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--primary-light)" }}>
            Tous les patients
          </Link>
        </div>
        {patsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : recentPatients.length === 0 ? (
          <div className="py-6 text-center">
            <User className="mx-auto h-7 w-7 text-text-muted" />
            <p className="mt-2 text-xs text-text-secondary">Aucun patient</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {recentPatients.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-3 py-3 transition-colors hover:bg-gray-50 -mx-2 px-2 rounded-lg group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary group-hover:text-primary-light">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {p.treatment_interests || p.lead_source || "Patient"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating action button */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ backgroundColor: "var(--primary-light)" }}
        title="Nouveau patient"
      >
        <Plus className="h-6 w-6" />
      </button>

      <QuickAddPatientModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────────────

const STATUS_FR: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  checked_in: "Arrivé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

function AdminDashboard() {
  const { user } = useAuthStore();
  const today = fmtDate(new Date());
  const { data: aptData, isLoading: aptLoading } = useAppointments({ date_from: today, date_to: today, page_size: 50 });
  const { data: patientsData } = usePatients({ page_size: 1 });
  const { data: recentPatientsData } = usePatients({ page_size: 5 });

  const appointments = aptData?.appointments ?? [];
  const totalPatients = patientsData?.total ?? 0;
  const recentPatients = recentPatientsData?.patients ?? [];

  const todayStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const a of appointments) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    }
    return byStatus;
  }, [appointments]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{greeting}, {user?.firstName}</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/patients" className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-gray-50">
            <UserPlus className="h-3.5 w-3.5" /> Nouveau patient
          </Link>
          <Link href="/calendar" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "var(--primary)" }}>
            <CalendarPlus className="h-3.5 w-3.5" /> Nouveau RDV
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-4 text-sm text-text-secondary">RDV aujourd&apos;hui</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{aptLoading ? "—" : appointments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <User className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-4 text-sm text-text-secondary">Total patients</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{totalPatients}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-4 text-sm text-text-secondary">En attente</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{(todayStats["checked_in"] || 0) + (todayStats["scheduled"] || 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <p className="mt-4 text-sm text-text-secondary">Terminés</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{todayStats["completed"] || 0}</p>
        </div>
      </div>

      {/* Today's appointments + recent patients */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">RDV du jour</h3>
            <Link href="/calendar" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--primary-light)" }}>Voir le calendrier</Link>
          </div>
          {appointments.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">Aucun rendez-vous aujourd&apos;hui</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {appointments.slice(0, 8).map((apt) => (
                <div key={apt.id} className="flex items-center gap-4 py-3">
                  <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-text-primary">{shortTime(apt.start_time)}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/patients/${apt.patient_id}`} className="text-sm font-medium text-text-primary hover:underline">{apt.patient_name}</Link>
                    <p className="text-xs text-text-secondary">{apt.treatment}{apt.doctor_name ? ` · ${apt.doctor_name}` : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: (STATUS_COLORS[apt.status] || "#6B7280") + "15", color: STATUS_COLORS[apt.status] || "#6B7280" }}>
                    {STATUS_FR[apt.status] || apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Derniers patients</h3>
            <Link href="/patients" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--primary-light)" }}>Voir tous</Link>
          </div>
          <div className="mt-4 space-y-1">
            {recentPatients.map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-gray-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{p.first_name} {p.last_name}</p>
                  <p className="truncate text-xs text-text-secondary">{p.phone_country_code}{p.phone}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page Export ────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentRole, user } = useAuthStore();
  const isDoctor = currentRole === "doctor" && !user?.isSuperAdmin;

  if (isDoctor) return <DoctorDashboard />;
  return <AdminDashboard />;
}
