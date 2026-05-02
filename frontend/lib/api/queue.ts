import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Patient } from "./patients";

export type IntakeStatus =
  | "intake_pending"
  | "awaiting_doctor"
  | "in_room"
  | "checkout_pending"
  | "active"
  | "archived";

export interface CheckoutDocuments {
  patient_id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_total: number | null;
  prescription_ids: string[];
  prescription_numbers: string[];
}

export interface InRoomDocuments {
  patient_id: string;
  consent_id: string | null;
  consent_status: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_total: number | null;
  invoice_status: string | null;
  prescription_ids: string[];
  prescription_numbers: string[];
}

export interface QueueBoard {
  intake_pending: Patient[];
  awaiting_doctor: Patient[];
  in_room: Patient[];
  checkout_pending: Patient[];
  checkout_documents: CheckoutDocuments[];
  in_room_documents: InRoomDocuments[];
  counts: {
    intake_pending: number;
    awaiting_doctor: number;
    in_room: number;
    checkout_pending: number;
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

// End-of-visit checkout from patient dossier. Doctor clicks "Terminer
// la visite" on the patient detail page → creates invoice draft, closes
// appointment, schedules follow-up, flips to CHECKOUT_PENDING.
export function useCheckoutFromDossier() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      amount,
      followUpWeeks,
      notes,
    }: {
      patientId: string;
      amount: number;
      followUpWeeks?: number | null;
      notes?: string | null;
    }) =>
      apiClient<Patient>(`/queue/${patientId}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          follow_up_weeks: followUpWeeks ?? null,
          notes: notes ?? null,
        }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

// Doctor → reception ping. POST /queue/:id/call sets doctor_called_at,
// reception's queue board pulses green + chimes on the next 4-second poll.
export function useCallPatient() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      apiClient<Patient>(`/queue/${patientId}/call`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useUncallPatient() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      apiClient<Patient>(`/queue/${patientId}/uncall`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

// Existing-patient walk-in: creates a placeholder appointment (kind=walk_in)
// and flips the patient into AWAITING_DOCTOR. Use this when a known patient
// shows up without a prior booking (e.g. séances 2, 3, 4 of a treatment plan).
//
// New-patient walk-in path: pass flip_to_awaiting=false. Then the appointment
// is still created (calendar shows the load) but the patient stays at
// INTAKE_PENDING so reception can finish filling the dossier.
export function useWalkInExistingPatient() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      requestedService,
      note,
      flipToAwaiting,
      isFirstVisit,
    }: {
      patientId: string;
      requestedService?: string | null;
      note?: string | null;
      flipToAwaiting?: boolean;
      isFirstVisit?: boolean;
    }) =>
      apiClient<unknown>(`/queue/${patientId}/walk-in`, {
        method: "POST",
        body: JSON.stringify({
          requested_service: requestedService ?? null,
          note: note ?? null,
          flip_to_awaiting: flipToAwaiting ?? true,
          is_first_visit: isFirstVisit ?? false,
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

export function usePrepareSession() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      apiClient<{ consent_id: string | null; invoice_id: string | null; message: string }>(
        `/queue/${patientId}/prepare-session`,
        { method: "POST", token: token ?? undefined }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["session-context"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
