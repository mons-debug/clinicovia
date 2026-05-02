import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export type PlanStatus = "draft" | "active" | "completed" | "cancelled";
export type SessionStatus = "planned" | "scheduled" | "in_progress" | "completed" | "skipped";

export interface TreatmentSession {
  id: string;
  plan_id: string;
  appointment_id: string | null;
  session_number: number;
  planned_for: string | null;
  status: SessionStatus;
  products_used: unknown[] | null;
  outcome_score: number | null;
  outcome_note: string | null;
  session_price: number | null;
  completed_at: string | null;
  skipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlan {
  id: string;
  clinic_id: string;
  patient_id: string;
  created_by: string | null;
  doctor_id: string | null;
  title: string;
  primary_service: string | null;
  indication_slugs: string[] | null;
  zone_slugs: string[] | null;
  total_sessions: number;
  interval_value: number;
  interval_unit: "days" | "weeks" | "months";
  estimated_total: number | null;
  currency: string;
  status: PlanStatus;
  version: string;
  start_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sessions: TreatmentSession[];
}

export interface PlanCreateInput {
  patient_id: string;
  title: string;
  primary_service?: string | null;
  indication_slugs?: string[] | null;
  zone_slugs?: string[] | null;
  total_sessions: number;
  interval_value: number;
  interval_unit: "days" | "weeks" | "months";
  estimated_total?: number | null;
  currency?: string;
  doctor_id?: string | null;
  notes?: string | null;
  start_at?: string | null;
  session_price?: number | null;
  auto_schedule?: boolean;
  default_hour?: number;
  default_minute?: number;
  default_duration_minutes?: number;
}

// ── Hooks ──────────────────────────────────────────────────────

export function usePatientPlans(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["plans", "patient", patientId],
    queryFn: () =>
      apiClient<{ plans: TreatmentPlan[]; total: number }>(
        `/plans?patient_id=${patientId}`,
        { token: token ?? undefined }
      ),
    enabled: !!patientId,
  });
}

export function usePlan(planId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["plans", "detail", planId],
    queryFn: () =>
      apiClient<TreatmentPlan>(`/plans/${planId}`, { token: token ?? undefined }),
    enabled: !!planId,
  });
}

// ── Plan timeline (séance-centric view) ─────────────────────────

export interface TimelineAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  treatment: string;
  room: string | null;
}

export interface TimelinePhoto {
  id: string;
  zone_slug: string;
  stage: string;
  storage_key: string;
}

export interface TimelinePrescription {
  id: string;
  number: string;
  status: string;
  created_at: string;
}

export interface TimelineInvoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  session_id: string | null;
}

export interface SessionTimelineEntry {
  session: TreatmentSession;
  appointment: TimelineAppointment | null;
  photos: TimelinePhoto[];
  prescriptions: TimelinePrescription[];
}

export interface PlanTimeline {
  plan: TreatmentPlan;
  sessions: SessionTimelineEntry[];
  invoices: TimelineInvoice[];
}

export function usePlanTimeline(planId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["plans", "timeline", planId],
    queryFn: () =>
      apiClient<PlanTimeline>(`/plans/${planId}/timeline`, { token: token ?? undefined }),
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlanCreateInput) =>
      apiClient<TreatmentPlan>("/plans", {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ["plans", "patient", plan.patient_id] });
      qc.invalidateQueries({ queryKey: ["plans", "detail", plan.id] });
    },
  });
}

export function useUpdateSession(planId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      outcomeScore,
      outcomeNote,
      productsUsed,
    }: {
      sessionId: string;
      outcomeScore?: number | null;
      outcomeNote?: string | null;
      productsUsed?: unknown[] | null;
    }) =>
      apiClient<TreatmentSession>(`/plans/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          outcome_score: outcomeScore ?? undefined,
          outcome_note: outcomeNote ?? undefined,
          products_used: productsUsed ?? undefined,
        }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans", "detail", planId] });
      qc.invalidateQueries({ queryKey: ["plans", "timeline", planId] });
    },
  });
}

export function useAdvanceSession(planId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      to,
      outcomeScore,
      outcomeNote,
    }: {
      sessionId: string;
      to: SessionStatus;
      outcomeScore?: number;
      outcomeNote?: string;
    }) =>
      apiClient<TreatmentSession>(`/plans/sessions/${sessionId}/advance`, {
        method: "POST",
        body: JSON.stringify({
          to_status: to,
          outcome_score: outcomeScore ?? null,
          outcome_note: outcomeNote ?? null,
        }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans", "detail", planId] });
    },
  });
}
