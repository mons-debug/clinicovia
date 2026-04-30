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

// Existing-patient walk-in: creates a placeholder appointment (kind=walk_in)
// and flips the patient into AWAITING_DOCTOR. Use this when a known patient
// shows up without a prior booking (e.g. séances 2, 3, 4 of a treatment plan).
export function useWalkInExistingPatient() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      requestedService,
      note,
    }: {
      patientId: string;
      requestedService?: string | null;
      note?: string | null;
    }) =>
      apiClient<unknown>(`/queue/${patientId}/walk-in`, {
        method: "POST",
        body: JSON.stringify({
          requested_service: requestedService ?? null,
          note: note ?? null,
        }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
