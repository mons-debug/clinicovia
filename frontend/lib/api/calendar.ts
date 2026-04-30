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

export interface RescheduleArgs {
  appointmentId: string;
  appointment_date: string; // ISO yyyy-mm-dd
  start_time: string;       // "HH:MM" or "HH:MM:SS"
  duration_minutes: number;
  doctor_id?: string | null;
  room?: string | null;
}

export function useReschedule(isoDate: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: RescheduleArgs) =>
      apiClient<CalendarAppointment>(`/calendar/${args.appointmentId}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          appointment_date: args.appointment_date,
          start_time: args.start_time,
          duration_minutes: args.duration_minutes,
          doctor_id: args.doctor_id ?? null,
          room: args.room ?? null,
        }),
        token: token ?? undefined,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar", "day", isoDate] });
      // Also invalidate the destination date if it changed
      if (vars.appointment_date !== isoDate) {
        qc.invalidateQueries({ queryKey: ["calendar", "day", vars.appointment_date] });
      }
    },
  });
}

export function useConfirmAppointment(isoDate: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient<CalendarAppointment>(`/calendar/${appointmentId}/confirm`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "day", isoDate] });
    },
  });
}
