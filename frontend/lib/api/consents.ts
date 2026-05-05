import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface Consent {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  consent_type: string;
  title: string;
  body_text: string | null;
  treatment_name: string | null;
  plan_id: string | null;
  status: string;
  signature_data: string | null;
  signed_at: string | null;
  created_at: string;
}

export function usePatientConsents(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["consents", patientId],
    queryFn: () =>
      apiClient<Consent[]>(`/consents?patient_id=${patientId}`, {
        token: token ?? undefined,
      }),
    enabled: !!patientId,
  });
}

export function useCreateConsent() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patient_id: string;
      consent_type?: string;
      title: string;
      body_text?: string | null;
      treatment_name?: string | null;
    }) =>
      apiClient<Consent>("/consents", {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["consents", c.patient_id] });
    },
  });
}

export function useSignConsent() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ consentId, signatureData }: { consentId: string; signatureData: string }) =>
      apiClient<Consent>(`/consents/${consentId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signature_data: signatureData }),
        token: token ?? undefined,
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["consents", c.patient_id] });
    },
  });
}
