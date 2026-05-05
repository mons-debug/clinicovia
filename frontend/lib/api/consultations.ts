import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export type ConsultationStatus = "draft" | "signed" | "cancelled";

export interface Consultation {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  plan_id: string | null;
  session_id: string | null;
  doctor_id: string | null;
  number: string;
  visit_date: string;
  language: string;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan_text: string | null;
  notes: string | null;
  status: ConsultationStatus;
  signed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationCreateInput {
  patient_id: string;
  appointment_id?: string | null;
  plan_id?: string | null;
  session_id?: string | null;
  visit_date?: string;
  chief_complaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan_text?: string | null;
  notes?: string | null;
}

export function usePatientConsultations(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["consultations", "patient", patientId],
    queryFn: () =>
      apiClient<{ consultations: Consultation[]; total: number }>(
        `/consultations?patient_id=${patientId}`,
        { token: token ?? undefined }
      ),
    enabled: !!patientId,
  });
}

export function useConsultation(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["consultations", "detail", id],
    queryFn: () =>
      apiClient<Consultation>(`/consultations/${id}`, { token: token ?? undefined }),
    enabled: !!id,
  });
}

export function useCreateConsultation() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConsultationCreateInput) =>
      apiClient<Consultation>("/consultations", {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["consultations", "patient", c.patient_id] });
    },
  });
}

export function useUpdateConsultation(id: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ConsultationCreateInput>) =>
      apiClient<Consultation>(`/consultations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", "detail", id] });
    },
  });
}

export function useSignConsultation(id: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<Consultation>(`/consultations/${id}/sign`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", "detail", id] });
    },
  });
}
