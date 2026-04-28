"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  Activity,
  Flame,
  Thermometer,
  Snowflake,
  Trophy,
  XCircle,
  Pencil,
  Save,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import {
  useDeal,
  useUpdateDeal,
  useMarkDealWon,
  useMarkDealLost,
} from "@/lib/api/deals";

const tempConfig: Record<string, { icon: typeof Flame; color: string; bg: string; label: string }> = {
  hot: { icon: Flame, color: "text-red-500", bg: "bg-red-50", label: "Hot" },
  warm: { icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50", label: "Warm" },
  cold: { icon: Snowflake, color: "text-blue-400", bg: "bg-blue-50", label: "Cold" },
};

export default function DealDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { data: deal, isLoading, isError, error } = useDeal(id);
  const updateMutation = useUpdateDeal(id);
  const wonMutation = useMarkDealWon();
  const lostMutation = useMarkDealLost();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState(0);
  const [editTreatment, setEditTreatment] = useState("");
  const [editTemperature, setEditTemperature] = useState("warm");
  const [editNotes, setEditNotes] = useState("");

  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");

  const startEditing = () => {
    if (!deal) return;
    setEditTitle(deal.title);
    setEditValue(deal.value);
    setEditTreatment(deal.treatment || "");
    setEditTemperature(deal.temperature);
    setEditNotes(deal.notes || "");
    setIsEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateMutation.mutateAsync({
        title: editTitle,
        value: editValue,
        treatment: editTreatment || null,
        temperature: editTemperature,
        notes: editNotes || null,
      });
      toast.success("Deal updated");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update deal");
    }
  };

  const handleWon = async () => {
    try {
      await wonMutation.mutateAsync(id);
      toast.success("Deal marked as won! Patient financials updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as won");
    }
  };

  const handleLost = async () => {
    if (!lostReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await lostMutation.mutateAsync({ id, reason: lostReason.trim() });
      toast.success("Deal marked as lost");
      setShowLostModal(false);
      setLostReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as lost");
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading deal...</span>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="space-y-6">
        <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Pipeline
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Deal not found"}</p>
        </div>
      </div>
    );
  }

  const temp = tempConfig[deal.temperature] || tempConfig.warm;
  const TempIcon = temp.icon;
  const isClosed = deal.is_won || deal.is_lost;
  const inputClass = "w-full rounded-lg border border-border bg-white py-2 px-3 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Pipeline
      </Link>

      {/* Deal Header */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {deal.is_won && (
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Trophy className="h-4 w-4" /> Deal Won
              </div>
            )}
            {deal.is_lost && (
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
                <XCircle className="h-4 w-4" /> Deal Lost
                {deal.lost_reason && <span className="font-normal text-text-muted"> — {deal.lost_reason}</span>}
              </div>
            )}

            {isEditing ? (
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`${inputClass} text-xl font-bold`} />
            ) : (
              <h1 className="text-xl font-bold text-text-primary">{deal.title}</h1>
            )}

            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={deal.pipeline_stage} variant={getStatusVariant(deal.pipeline_stage)} />
              <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${temp.bg} ${temp.color}`}>
                <TempIcon className="h-3 w-3" /> {temp.label}
              </div>
              <span className="text-xs text-text-muted">{deal.days_in_stage}d in stage</span>
            </div>
          </div>

          <div className="flex gap-2">
            {!isClosed && !isEditing && (
              <>
                <button onClick={startEditing} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button onClick={handleWon} disabled={wonMutation.isPending} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                  <Trophy className="h-4 w-4" /> {wonMutation.isPending ? "..." : "Won"}
                </button>
                <button onClick={() => setShowLostModal(true)} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                  <XCircle className="h-4 w-4" /> Lost
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button onClick={saveEdit} disabled={updateMutation.isPending} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: "var(--primary-light)" }}>
                  <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-text-muted">Value</span>
            </div>
            {isEditing ? (
              <input type="number" value={editValue} onChange={(e) => setEditValue(Number(e.target.value))} className={`mt-1 ${inputClass} text-sm font-semibold`} />
            ) : (
              <p className="mt-1 text-sm font-semibold text-text-primary">{deal.currency} {deal.value.toLocaleString()}</p>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-text-muted">Created</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(deal.created_at)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <span className="text-xs text-text-muted">Treatment</span>
            {isEditing ? (
              <input value={editTreatment} onChange={(e) => setEditTreatment(e.target.value)} className={`mt-1 ${inputClass} text-sm`} />
            ) : (
              <p className="mt-1 text-sm font-semibold text-text-primary">{deal.treatment || "--"}</p>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <span className="text-xs text-text-muted">Temperature</span>
            {isEditing ? (
              <select value={editTemperature} onChange={(e) => setEditTemperature(e.target.value)} className={`mt-1 ${inputClass} text-sm`}>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            ) : (
              <p className="mt-1 text-sm font-semibold text-text-primary capitalize">{deal.temperature}</p>
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
              <Link href={`/patients/${deal.patient_id}`} className="text-sm font-medium hover:underline" style={{ color: "var(--primary-light)" }}>
                {deal.patient_name || "Unknown"}
              </Link>
            </div>
            {deal.patient_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-text-muted" />
                <span className="text-sm text-text-secondary">{deal.patient_phone}</span>
              </div>
            )}
            {deal.patient_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-text-muted" />
                <span className="text-sm text-text-secondary">{deal.patient_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-text-primary">Notes</h3>
          {isEditing ? (
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className={`mt-3 ${inputClass} resize-none`} />
          ) : (
            <p className="mt-3 text-sm text-text-secondary">{deal.notes || "No notes"}</p>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-base font-semibold text-text-primary">Activity</h3>
        {deal.activities && deal.activities.length > 0 ? (
          <div className="mt-4 divide-y divide-border">
            {deal.activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Activity className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <div>
                  <p className="text-sm text-text-primary">{act.description}</p>
                  {act.from_stage && act.to_stage && (
                    <p className="text-xs text-text-muted">{act.from_stage} → {act.to_stage}</p>
                  )}
                  <p className="mt-0.5 text-xs text-text-muted">{formatDate(act.created_at)} at {formatTime(act.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">No activity recorded yet.</p>
        )}
      </div>

      {/* Lost reason modal */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-text-primary">Mark Deal as Lost</h3>
            <p className="mt-2 text-sm text-text-secondary">Please provide a reason for losing this deal.</p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={3}
              placeholder="Reason for loss..."
              className={`mt-4 ${inputClass} resize-none`}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setShowLostModal(false); setLostReason(""); }} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleLost} disabled={lostMutation.isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                {lostMutation.isPending ? "Saving..." : "Mark as Lost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
