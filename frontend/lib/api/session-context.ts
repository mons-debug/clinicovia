import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface SessionContext {
  active: boolean;
  mode: "consultation" | "seance";
  appointment_id: string | null;
  treatment: string | null;
  plan_id: string | null;
  plan_title: string | null;
  session_id: string | null;
  session_number: number | null;
  total_sessions: number | null;
  interval_value: number | null;
  screening_ok: boolean;
  screening_flags: number;
  consent_signed: boolean;
  consent_pending: boolean;
  photos_before: number;
  photos_after: number;
  soap_exists: boolean;
  soap_id: string | null;
  ordonnance_exists: boolean;
  ordonnance_count: number;
  session_price: number | null;
  prep_sent: boolean;
  consent_id: string | null;
  consent_status: string | null;
  facture_id: string | null;
  facture_status: string | null;
  facture_amount: number | null;
  can_terminate: boolean;
}

export function useSessionContext(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["session-context", patientId],
    queryFn: () =>
      apiClient<SessionContext>(`/patients/${patientId}/session-context`, {
        token: token ?? undefined,
      }),
    enabled: !!patientId,
    refetchInterval: 5000,
  });
}
