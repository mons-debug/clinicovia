"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Calendar, Clock, User, Phone, Mail,
  CheckCircle, XCircle, UserCheck, Play, Loader2, AlertCircle,
  Pencil, Save, X,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { useAppointment, useUpdateAppointment, useUpdateAppointmentStatus } from "@/lib/api/appointments";

const STATUS_ACTIONS: Record<string, { label: string; next: string; icon: typeof CheckCircle; color: string }[]> = {
  scheduled: [{ label: "Confirm", next: "confirmed", icon: CheckCircle, color: "bg-blue-600" }],
  confirmed: [{ label: "Check In", next: "checked_in", icon: UserCheck, color: "bg-emerald-600" }],
  checked_in: [
    { label: "Start", next: "in_progress", icon: Play, color: "bg-blue-600" },
    { label: "No Show", next: "no_show", icon: XCircle, color: "bg-red-600" },
  ],
  in_progress: [{ label: "Complete", next: "completed", icon: CheckCircle, color: "bg-emerald-600" }],
};

export default function AppointmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { data: apt, isLoading, isError, error } = useAppointment(id);
  const statusMutation = useUpdateAppointmentStatus();
  const updateMutation = useUpdateAppointment(id);

  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editTreatment, setEditTreatment] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const startEdit = () => {
    if (!apt) return;
    setEditDate(apt.appointment_date);
    setEditStart(apt.start_time);
    setEditEnd(apt.end_time);
    setEditTreatment(apt.treatment);
    setEditNotes(apt.notes || "");
    setIsEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateMutation.mutateAsync({
        appointment_date: editDate,
        start_time: editStart,
        end_time: editEnd,
        treatment: editTreatment,
        notes: editNotes || null,
      });
      toast.success("Appointment updated");
      setIsEditing(false);
    } catch { toast.error("Failed to update"); }
  };

  const handleStatus = async (newStatus: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: newStatus });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this appointment?")) return;
    await handleStatus("cancelled");
  };

  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-text-muted" /><span className="ml-2 text-sm text-text-secondary">Loading...</span></div>;

  if (isError || !apt) return (
    <div className="space-y-6">
      <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{error instanceof Error ? error.message : "Not found"}</p></div>
    </div>
  );

  const currentStatus = apt.status;
  const isTerminal = ["completed", "cancelled", "no_show"].includes(currentStatus);
  const actions = STATUS_ACTIONS[currentStatus] || [];
  const inputClass = "w-full rounded-lg border border-border bg-white py-2 px-3 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Calendar
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">{apt.treatment}</h1>
              <StatusBadge status={apt.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} variant={getStatusVariant(apt.status)} dot />
              {apt.is_first_visit && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">First Visit</span>}
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {formatDate(apt.appointment_date)} &middot; {apt.start_time} - {apt.end_time} ({apt.duration_minutes}min)
            </p>
            {apt.doctor_name && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: apt.doctor_color }} />
                <span className="text-sm text-text-secondary">{apt.doctor_name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isTerminal && !isEditing && (
              <>
                <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                {actions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button key={act.next} onClick={() => handleStatus(act.next)} disabled={statusMutation.isPending} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white ${act.color} hover:opacity-90 disabled:opacity-60`}>
                      <Icon className="h-4 w-4" /> {act.label}
                    </button>
                  );
                })}
                <button onClick={handleCancel} disabled={statusMutation.isPending} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"><X className="h-4 w-4" /> Discard</button>
                <button onClick={saveEdit} disabled={updateMutation.isPending} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: "var(--primary-light)" }}><Save className="h-4 w-4" /> Save</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Patient Info */}
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-base font-semibold text-text-primary">Patient</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />
              <Link href={`/patients/${apt.patient_id}`} className="text-sm font-medium hover:underline" style={{ color: "var(--primary-light)" }}>
                {apt.patient_name}
              </Link>
            </div>
            {apt.patient_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-text-muted" /><span className="text-sm text-text-secondary">{apt.patient_phone}</span></div>}
          </div>
        </div>

        {/* Details / Edit */}
        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-text-primary">Details</h3>
          {isEditing ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs text-text-muted">Date</label><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Treatment</label><input value={editTreatment} onChange={(e) => setEditTreatment(e.target.value)} className={inputClass} /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Start Time</label><input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputClass} /></div>
              <div><label className="mb-1 block text-xs text-text-muted">End Time</label><input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputClass} /></div>
              <div className="col-span-2"><label className="mb-1 block text-xs text-text-muted">Notes</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} /></div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {[
                { label: "Treatment", value: apt.treatment },
                { label: "Date", value: formatDate(apt.appointment_date) },
                { label: "Time", value: `${apt.start_time} - ${apt.end_time}` },
                { label: "Duration", value: `${apt.duration_minutes} minutes` },
                { label: "Doctor", value: apt.doctor_name || "--" },
                { label: "Status", value: apt.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          {!isEditing && apt.notes && (
            <div className="mt-5 rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Notes</p>
              <p className="mt-1 text-sm text-amber-800">{apt.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
