"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  Loader2,
  AlertCircle,
  Play,
  CheckCircle,
  CheckCircle2,
  LogIn,
  User,
  CalendarPlus,
  FileText,
  Receipt,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAppointments,
  useUpdateAppointmentStatus,
  type AppointmentResponse,
} from "@/lib/api/appointments";
import { useQueue, usePrepareSession, type InRoomDocuments } from "@/lib/api/queue";
import { Button } from "@/components/ui/button";

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function shortTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function elapsedLabel(updatedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function waitColor(updatedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
  if (mins <= 5) return "text-emerald-600";
  if (mins <= 15) return "text-amber-600";
  return "text-red-600";
}

function DocStatusChips({ docs }: { docs: InRoomDocuments }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      {docs.consent_id && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          docs.consent_status === "signed"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }`}>
          <FileText className="h-3 w-3" />
          {docs.consent_status === "signed" ? "Consentement signé" : "Consentement en attente"}
        </span>
      )}
      {docs.invoice_id && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          docs.invoice_status === "paid"
            ? "bg-emerald-100 text-emerald-700"
            : docs.invoice_status === "issued"
            ? "bg-blue-100 text-blue-700"
            : "bg-amber-100 text-amber-700"
        }`}>
          <Receipt className="h-3 w-3" />
          {docs.invoice_status === "paid"
            ? "Facture payée"
            : docs.invoice_status === "issued"
            ? `Émise · ${docs.invoice_total?.toLocaleString("fr-FR")} MAD`
            : `Brouillon · ${docs.invoice_total?.toLocaleString("fr-FR")} MAD`}
        </span>
      )}
      {!docs.consent_id && !docs.invoice_id && (
        <span className="text-[10px] text-text-muted">Aucun document envoyé</span>
      )}
    </div>
  );
}

function PrepareButton({ patientId }: { patientId: string }) {
  const prepareMut = usePrepareSession();
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 w-full text-[11px] border-blue-300 text-blue-700 hover:bg-blue-50"
      disabled={prepareMut.isPending}
      onClick={() => {
        prepareMut.mutate(
          { patientId },
          {
            onSuccess: () => toast.success("Documents envoyés à la réception"),
            onError: () => toast.error("Erreur lors de la préparation"),
          }
        );
      }}
    >
      {prepareMut.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Send className="h-3 w-3" />
      )}
      Préparer (consentement + facture)
    </Button>
  );
}

interface SectionProps {
  title: string;
  titleColor: string;
  appointments: AppointmentResponse[];
  action?: {
    label: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  };
  showWaitTime?: boolean;
  showTime?: boolean;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
  inRoomDocs?: InRoomDocuments[];
  showPrepare?: boolean;
}

function Section({ title, titleColor, appointments, action, showWaitTime, showTime, onStatusChange, isPending, inRoomDocs, showPrepare }: SectionProps) {
  if (appointments.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${titleColor}`}>{title}</span>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-text-secondary">
          {appointments.length}
        </span>
      </div>
      <div className="space-y-2">
        {appointments.map((apt) => {
          const docs = inRoomDocs?.find((d) => d.patient_id === apt.patient_id);
          const hasDocs = docs && (docs.consent_id || docs.invoice_id);

          return (
            <div key={apt.id}>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <Link
                  href={`/patients/${apt.patient_id}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: apt.doctor_color || "#0D4F6C" }}
                >
                  {apt.patient_initials}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/patients/${apt.patient_id}`} className="text-sm font-semibold text-text-primary hover:text-primary-light">
                    {apt.patient_name}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {apt.treatment}
                    {apt.doctor_name && <span className="text-text-muted"> · {apt.doctor_name}</span>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {showWaitTime && (
                    <span className={`text-sm font-bold tabular-nums ${waitColor(apt.updated_at)}`}>
                      {elapsedLabel(apt.updated_at)}
                    </span>
                  )}
                  {showTime && (
                    <span className="text-xs text-text-muted">{shortTime(apt.start_time)}</span>
                  )}
                  <span className="text-[10px] text-text-muted">{shortTime(apt.start_time)} - {shortTime(apt.end_time)}</span>
                </div>
                {action && (
                  <button
                    onClick={() => onStatusChange(apt.id, action.status)}
                    disabled={isPending}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: action.bgColor, color: action.color }}
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                )}
              </div>
              {/* Document status chips for in-progress patients */}
              {hasDocs && <DocStatusChips docs={docs} />}
              {showPrepare && !hasDocs && (
                <PrepareButton patientId={apt.patient_id} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  const today = fmtDate(new Date());
  const statusMutation = useUpdateAppointmentStatus();

  const { data, isLoading, isError, error } = useAppointments({
    date_from: today,
    date_to: today,
    page_size: 200,
  });

  const { data: queueData } = useQueue(5000);
  const inRoomDocs = queueData?.in_room_documents ?? [];

  const appointments = data?.appointments ?? [];
  const stats = data?.stats;

  const handleStatus = (id: string, status: string) => {
    statusMutation.mutate(
      { id, status },
      {
        onSuccess: () => toast.success("Statut mis à jour"),
        onError: () => toast.error("Erreur"),
      },
    );
  };

  const scheduled = useMemo(
    () => appointments.filter((a) => ["scheduled", "confirmed"].includes(a.status)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments],
  );
  const checkedIn = useMemo(
    () => appointments.filter((a) => a.status === "checked_in").sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
    [appointments],
  );
  const inProgress = useMemo(
    () => appointments.filter((a) => a.status === "in_progress"),
    [appointments],
  );
  const completed = useMemo(
    () => appointments.filter((a) => a.status === "completed").sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [appointments],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Chargement...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Erreur de chargement"}</p>
        </div>
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Salle d&apos;attente</h1>
          <p className="mt-0.5 text-sm text-text-secondary capitalize">
            {todayLabel} · {stats?.total ?? 0} rendez-vous
          </p>
        </div>
        <Link
          href="/appointments/new"
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <CalendarPlus className="h-4 w-4" />
          Nouveau RDV
        </Link>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Programmés", value: stats.scheduled + stats.confirmed, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "En attente", value: stats.checked_in, color: "#3B82F6", bg: "#EFF6FF" },
            { label: "En cours", value: stats.in_progress, color: "#8B5CF6", bg: "#F5F3FF" },
            { label: "Terminés", value: stats.completed, color: "#059669", bg: "#ECFDF5" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: s.bg }}>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-xs font-medium text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-16">
          <Clock className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">Aucun rendez-vous aujourd&apos;hui</p>
          <Link href="/appointments/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--primary-light)" }}>
            <CalendarPlus className="h-4 w-4" /> Planifier un RDV
          </Link>
        </div>
      )}

      {/* In Progress — with document status */}
      <Section
        title="En cours"
        titleColor="text-purple-600"
        appointments={inProgress}
        action={{ label: "Terminer", status: "completed", icon: CheckCircle, color: "#059669", bgColor: "#ECFDF5" }}
        showWaitTime
        onStatusChange={handleStatus}
        isPending={statusMutation.isPending}
        inRoomDocs={inRoomDocs}
        showPrepare
      />

      {/* Checked In / Waiting */}
      <Section
        title="En attente"
        titleColor="text-amber-600"
        appointments={checkedIn}
        action={{ label: "Démarrer", status: "in_progress", icon: Play, color: "#7C3AED", bgColor: "#F5F3FF" }}
        showWaitTime
        onStatusChange={handleStatus}
        isPending={statusMutation.isPending}
      />

      {/* Scheduled — not yet checked in */}
      <Section
        title="Programmés"
        titleColor="text-blue-600"
        appointments={scheduled}
        action={{ label: "Check in", status: "checked_in", icon: LogIn, color: "#0D9488", bgColor: "#F0FDFA" }}
        onStatusChange={handleStatus}
        isPending={statusMutation.isPending}
      />

      {/* Completed */}
      {completed.length > 0 && (
        <Section
          title="Terminés"
          titleColor="text-emerald-600"
          appointments={completed}
          showTime
          onStatusChange={handleStatus}
          isPending={statusMutation.isPending}
        />
      )}
    </div>
  );
}
