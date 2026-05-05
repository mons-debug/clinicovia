"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  Pencil,
  StickyNote,
  Activity,
  User,
  DollarSign,
  Star,
  Loader2,
  AlertCircle,
  Pin,
  FolderOpen,
  Clock,
  CalendarPlus,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import {
  usePatient,
  usePatientNotes,
  usePatientActivities,
  useCreatePatientNote,
} from "@/lib/api/patients";
import { useAppointments, type AppointmentResponse } from "@/lib/api/appointments";
import { useConversations, useWhatsAppSessions, startConversation } from "@/lib/api/whatsapp";
import { useAuthStore } from "@/stores/auth-store";

type TabKey = "overview" | "dossier" | "conversations" | "notes" | "activity";

function shortTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function PatientProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { currentRole, user: authUser } = useAuthStore();
  const isDoctor = currentRole === "doctor" && !authUser?.isSuperAdmin;
  const [activeTab, setActiveTab] = useState<TabKey>(isDoctor ? "dossier" : "overview");
  const [noteContent, setNoteContent] = useState("");

  const router = useRouter();
  const { data: patient, isLoading, isError, error } = usePatient(id);
  const { data: sessionsData } = useWhatsAppSessions();

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    ...(isDoctor ? [] : [{ key: "overview" as TabKey, label: "Overview", icon: User }]),
    { key: "dossier", label: "Dossier", icon: FolderOpen },
    ...(isDoctor ? [] : [{ key: "conversations" as TabKey, label: "Conversations", icon: MessageSquare }]),
    { key: "notes", label: "Notes", icon: StickyNote },
    ...(isDoctor ? [] : [{ key: "activity" as TabKey, label: "Activity", icon: Activity }]),
  ];
  const connectedSessions = (sessionsData?.sessions || []).filter((s) => s.status === "connected");
  const { data: notes = [] } = usePatientNotes(id);
  const { data: activities = [] } = usePatientActivities(id);
  const createNoteMutation = useCreatePatientNote(id);
  const { data: convsData } = useConversations({ patient_id: id });
  const patientConversations = convsData?.conversations || [];

  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "";
  const { data: aptData } = useAppointments(
    { patient_search: patientName, date_from: "2020-01-01", date_to: "2030-12-31", page_size: 200 },
    { enabled: !!patientName },
  );
  const patientAppointments = (aptData?.appointments ?? []).filter((a) => a.patient_id === id);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast.error("Note content cannot be empty");
      return;
    }
    try {
      await createNoteMutation.mutateAsync({ content: noteContent.trim() });
      setNoteContent("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading patient...</span>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="space-y-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : "Patient not found"}
          </p>
        </div>
      </div>
    );
  }

  const p = patient;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      {/* Patient header card */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: "#0D4F6C" }}
            >
              {p.first_name[0]}{p.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">
                  {p.first_name} {p.last_name}
                </h1>
                <StatusBadge
                  status={p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  variant={getStatusVariant(p.status)}
                  dot
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {p.phone_country_code}{p.phone}
                </span>
                {p.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {p.email}
                  </span>
                )}
                {(p.city || p.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {[p.city, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              {p.tags.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-md px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!p.phone) return;
                const session = connectedSessions[0];
                if (!session) {
                  toast.error("No WhatsApp number connected");
                  return;
                }
                try {
                  const phone = `${p.phone_country_code}${p.phone}`.replace(/\D/g, "");
                  const jid = `${phone}@s.whatsapp.net`;
                  const conv = await startConversation(session.id, jid, `${p.first_name} ${p.last_name}`);
                  router.push(`/whatsapp?conversation=${conv.id}`);
                } catch {
                  toast.error("Failed to start WhatsApp conversation");
                }
              }}
              disabled={!p.phone || connectedSessions.length === 0}
              className={`flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium transition-colors ${
                p.phone && connectedSessions.length > 0
                  ? "text-text-primary hover:bg-gray-50"
                  : "cursor-not-allowed text-text-muted"
              }`}
              title={!p.phone ? "No phone number" : connectedSessions.length === 0 ? "No WhatsApp connected" : "Send WhatsApp message"}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </button>
            <Link
              href={`/patients/${id}/edit`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Lead Score", value: `${p.lead_score}/100`, icon: Star, color: "#F59E0B" },
            { label: "Total Spent", value: `$${p.total_spent.toLocaleString()}`, icon: DollarSign, color: "#10B981" },
            { label: "Lifetime Value", value: `$${p.lifetime_value.toLocaleString()}`, icon: DollarSign, color: "#059669" },
            { label: "Patient Since", value: formatDate(p.created_at), icon: Calendar, color: "#3B82F6" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: stat.color }} />
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-text-primary">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-light text-primary-light"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
            <h3 className="text-base font-semibold text-text-primary">Patient Details</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {[
                { label: "Full Name", value: `${p.first_name} ${p.last_name}` },
                { label: "Gender", value: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "--" },
                { label: "Date of Birth", value: p.date_of_birth || "--" },
                { label: "Lead Source", value: p.lead_source || "--" },
                { label: "Treatment Interests", value: p.treatment_interests || "--" },
                { label: "Address", value: [p.city, p.country].filter(Boolean).join(", ") || "--" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
            {p.internal_notes && (
              <div className="mt-5 rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-700">Internal Notes</p>
                <p className="mt-1 text-sm text-amber-800">{p.internal_notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-base font-semibold text-text-primary">Recent Activity</h3>
            <div className="mt-4 space-y-3">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  <div>
                    <p className="text-xs text-text-primary">{act.description}</p>
                    <p className="text-[10px] text-text-muted">{formatDate(act.created_at)}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-xs text-text-muted">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "dossier" && (
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Link
              href={`/appointments/new?patient=${id}`}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
            >
              <CalendarPlus className="h-4 w-4" />
              Nouveau RDV
            </Link>
          </div>

          {/* Treatment history */}
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-base font-semibold text-text-primary">Historique des traitements</h3>
            {patientAppointments.length === 0 ? (
              <div className="mt-4 py-6 text-center">
                <FileText className="mx-auto h-7 w-7 text-text-muted" />
                <p className="mt-2 text-sm text-text-secondary">Aucun traitement enregistre</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {patientAppointments
                  .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date) || b.start_time.localeCompare(a.start_time))
                  .map((apt) => {
                    const isCompleted = apt.status === "completed";
                    const isCancelled = apt.status === "cancelled" || apt.status === "no_show";
                    const statusColor = {
                      completed: "bg-emerald-50 text-emerald-700",
                      cancelled: "bg-red-50 text-red-600",
                      no_show: "bg-gray-100 text-gray-500",
                      scheduled: "bg-amber-50 text-amber-700",
                      confirmed: "bg-blue-50 text-blue-700",
                      checked_in: "bg-emerald-50 text-emerald-700",
                      in_progress: "bg-purple-50 text-purple-700",
                    }[apt.status] || "bg-gray-100 text-gray-600";

                    return (
                      <Link
                        key={apt.id}
                        href={`/appointments/${apt.id}`}
                        className={`flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-gray-50 ${isCancelled ? "opacity-50" : ""}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-50">
                          <span className="text-[10px] font-semibold text-text-secondary">
                            {new Date(apt.appointment_date + "T00:00:00").toLocaleDateString("fr-FR", { month: "short" }).toUpperCase()}
                          </span>
                          <span className="text-sm font-bold text-text-primary">
                            {new Date(apt.appointment_date + "T00:00:00").getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium text-text-primary ${isCancelled ? "line-through" : ""}`}>
                            {apt.treatment}
                          </p>
                          <p className="text-xs text-text-muted">
                            {shortTime(apt.start_time)} - {shortTime(apt.end_time)}
                            {apt.doctor_name && ` · ${apt.doctor_name}`}
                          </p>
                          {apt.notes && (
                            <p className="mt-1 text-xs text-text-secondary line-clamp-1">{apt.notes}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColor}`}>
                          {apt.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Medical notes */}
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-base font-semibold text-text-primary">Notes medicales</h3>
            <div className="mt-4">
              <textarea
                placeholder="Ajouter une note..."
                rows={2}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full resize-none rounded-lg border border-border bg-gray-50 p-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleAddNote}
                  disabled={createNoteMutation.isPending}
                  className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--primary-light)" }}
                >
                  {createNoteMutation.isPending ? "Enregistrement..." : "Ajouter la note"}
                </button>
              </div>
            </div>
            {notes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border p-3">
                    {note.is_pinned && (
                      <span className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <Pin className="h-3 w-3" /> Epingle
                      </span>
                    )}
                    <p className="text-sm text-text-primary">{note.content}</p>
                    <p className="mt-1.5 text-xs text-text-muted">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-text-muted">Aucune note</p>
            )}
          </div>

          {/* Treatment plans placeholder */}
          <div className="rounded-xl border border-dashed border-border bg-gray-50 p-5 text-center">
            <FileText className="mx-auto h-7 w-7 text-text-muted" />
            <p className="mt-2 text-sm font-medium text-text-primary">Plans de traitement</p>
            <p className="mt-1 text-xs text-text-secondary">Bientot disponible - gestion des plans de traitement personnalises</p>
          </div>
        </div>
      )}

      {activeTab === "conversations" && (
        <div className="rounded-xl border border-border bg-white">
          {patientConversations.length > 0 ? (
            <div className="divide-y divide-border">
              {patientConversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/whatsapp?conversation=${conv.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary">
                        +{conv.contact_phone}
                      </p>
                      <span className="text-[10px] text-text-muted">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-text-secondary">
                      {conv.last_message || "No messages"}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      {conv.unread_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-3 text-sm font-medium text-text-primary">
                No WhatsApp Conversations
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Conversations will appear here when this patient messages via WhatsApp.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-3">
          {/* Add note */}
          <div className="rounded-xl border border-border bg-white p-4">
            <textarea
              placeholder="Add a note..."
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-gray-50 p-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleAddNote}
                disabled={createNoteMutation.isPending}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {createNoteMutation.isPending ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-border bg-white p-4">
              {note.is_pinned && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              <p className="text-sm text-text-primary">{note.content}</p>
              <p className="mt-2 text-xs text-text-muted">{formatDate(note.created_at)}</p>
            </div>
          ))}

          {notes.length === 0 && (
            <div className="rounded-xl border border-border bg-white p-6 text-center">
              <p className="text-sm text-text-secondary">No notes yet. Add your first note above.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="rounded-xl border border-border bg-white">
          {activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Activity className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm text-text-primary">{act.description}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatDate(act.created_at)} at {formatTime(act.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-text-secondary">No activity recorded yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
