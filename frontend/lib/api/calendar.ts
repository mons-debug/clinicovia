import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface CalendarAppointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_initials: string;
  doctor_id: string | null;
  doctor_name: string;
  doctor_color: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  treatment: string;
  kind?: string;
  status: string;
  room?: string | null;
  notes?: string | null;
  is_first_visit?: boolean;
  needs_confirmation?: boolean;
  arrived_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface DoctorBucket {
  doctor_id: string | null;
  doctor_name: string;
  doctor_color: string;
  appointments: CalendarAppointment[];
}

export interface CalendarDay {
  date: string;
  counts: Record<string, number>;
  doctors: DoctorBucket[];
  unassigned: CalendarAppointment[];
}

export type JourneyEvent = "arrived" | "started" | "ended" | "cancel" | "no_show";

// ── Hooks ──────────────────────────────────────────────────────

export function useCalendarDay(isoDate: string, refetchMs = 10_000) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["calendar", "day", isoDate],
    queryFn: () =>
      apiClient<CalendarDay>(`/calendar/day?date=${encodeURIComponent(isoDate)}`, {
        token: token ?? undefined,
      }),
    refetchInterval: refetchMs,
    refetchIntervalInBackground: false,
    enabled: !!isoDate,
  });
}

export function useJourneyEvent(isoDate: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, event }: { appointmentId: string; event: JourneyEvent }) =>
      apiClient<CalendarAppointment>(`/calendar/${appointmentId}/event`, {
        method: "POST",
        body: JSON.stringify({ event }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      // Calendar day refresh
      qc.invalidateQueries({ queryKey: ["calendar", "day", isoDate] });
      // Queue board reflects the patient's intake_status change instantly
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}
