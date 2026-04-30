import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Patient } from "./patients";

export type IntakeStatus =
  | "intake_pending"
  | "awaiting_doctor"
  | "in_room"
  | "active"
  | "archived";

export interface QueueBoard {
  intake_pending: Patient[];
  awaiting_doctor: Patient[];
  in_room: Patient[];
  counts: {
    intake_pending: number;
    awaiting_doctor: number;
    in_room: number;
  };
}

export function useQueue(refetchMs = 4000) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["queue"],
    queryFn: () =>
      apiClient<QueueBoard>("/queue", { token: token ?? undefined }),
    refetchInterval: refetchMs,
    refetchIntervalInBackground: false,
  });
}

export function useAdvanceIntake() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, to }: { patientId: string; to: IntakeStatus }) =>
      apiClient<Patient>(`/queue/${patientId}/advance`, {
        method: "POST",
        body: JSON.stringify({ to_status: to }),
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}
