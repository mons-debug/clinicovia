import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface DashboardSummary {
  user: { first_name: string; last_name: string };
  metrics: {
    today_appointments: number;
    today_appointments_delta: number;
    in_queue: number;
    new_patients_week: number;
    leads_week: number;
    leads_total: number;
    active_plans: number;
    revenue_mtd: number;
    revenue_last_month: number;
    currency: string;
  };
  today_appointments: {
    id: string;
    patient_name: string;
    patient_id: string;
    start_time: string;
    treatment: string;
    status: string;
    room: string | null;
  }[];
  recent_patients: {
    id: string;
    name: string;
    phone: string;
    intake_status: string | null;
    lead_source: string | null;
    created_at: string | null;
  }[];
}

export function useDashboardSummary() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () =>
      apiClient<DashboardSummary>("/dashboard/summary", { token: token ?? undefined }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
