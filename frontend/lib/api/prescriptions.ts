import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export type PrescriptionStatus = "draft" | "signed" | "cancelled";

export interface Drug {
  id: string;
  dci: string;
  brand: string | null;
  form: string;
  strength: string | null;
  drug_class: string | null;
  default_posology: string | null;
  default_duration: string | null;
  is_active: boolean;
}

export interface PrescriptionLine {
  dci: string;
  brand?: string | null;
  form?: string | null;
  strength?: string | null;
  posology: string;
  duration?: string | null;
  note?: string | null;
}

export interface Prescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  plan_id: string | null;
  appointment_id: string | null;
  doctor_id: string | null;
  number: string;
  issue_date: string;
  language: string;
  lines: PrescriptionLine[];
  diagnosis: string | null;
  notes: string | null;
  renewable: boolean;
  status: PrescriptionStatus;
  signed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionCreateInput {
  patient_id: string;
  plan_id?: string | null;
  appointment_id?: string | null;
  issue_date?: string;
  diagnosis?: string | null;
  notes?: string | null;
  renewable?: boolean;
  lines: PrescriptionLine[];
}

// ── Hooks ──────────────────────────────────────────────────────

export function useDrugs(search?: string) {
  const token = useAuthStore((s) => s.accessToken);
  const url = search ? `/prescriptions/drugs?search=${encodeURIComponent(search)}` : "/prescriptions/drugs";
  return useQuery({
    queryKey: ["drugs", search ?? ""],
    queryFn: () =>
      apiClient<{ drugs: Drug[]; total: number }>(url, { token: token ?? undefined }),
  });
}

export function useSeedDrugs() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<{ inserted: number }>("/prescriptions/seed-drugs", {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drugs"] }),
  });
}

export function usePatientPrescriptions(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["prescriptions", "patient", patientId],
    queryFn: () =>
      apiClient<{ prescriptions: Prescription[]; total: number }>(
        `/prescriptions?patient_id=${patientId}`,
        { token: token ?? undefined }
      ),
    enabled: !!patientId,
  });
}

export function usePrescription(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["prescriptions", "detail", id],
    queryFn: () =>
      apiClient<Prescription>(`/prescriptions/${id}`, { token: token ?? undefined }),
    enabled: !!id,
  });
}

export function useCreatePrescription() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PrescriptionCreateInput) =>
      apiClient<Prescription>("/prescriptions", {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: (rx) => {
      qc.invalidateQueries({ queryKey: ["prescriptions", "patient", rx.patient_id] });
    },
  });
}

export function useSignPrescription(id: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<Prescription>(`/prescriptions/${id}/sign`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      qc.invalidateQueries({ queryKey: ["prescriptions", "detail", id] });
    },
  });
}

export function useCancelPrescription(id: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      apiClient<Prescription>(`/prescriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      qc.invalidateQueries({ queryKey: ["prescriptions", "detail", id] });
    },
  });
}
