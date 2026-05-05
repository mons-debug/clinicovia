import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface AppointmentResponse {
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
  status: string;
  notes: string | null;
  is_first_visit: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentStats {
  total: number;
  scheduled: number;
  confirmed: number;
  checked_in: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

export interface AppointmentListResponse {
  appointments: AppointmentResponse[];
  total: number;
  stats: AppointmentStats;
}

export interface TreatmentResponse {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  category: string | null;
  specialty: string | null;
}

export interface TreatmentListResponse {
  treatments: TreatmentResponse[];
}

export interface AppointmentCreateInput {
  patient_id: string;
  doctor_id?: string | null;
  doctor_service_id?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  treatment: string;
  kind?: string;
  room?: string | null;
  notes?: string | null;
}

export interface AppointmentUpdateInput {
  doctor_id?: string | null;
  appointment_date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  treatment?: string;
  notes?: string | null;
}

export interface ListAppointmentsParams {
  date_from?: string;
  date_to?: string;
  doctor_id?: string;
  status?: string;
  patient_search?: string;
  page?: number;
  page_size?: number;
}

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listAppointments(params: ListAppointmentsParams = {}): Promise<AppointmentListResponse> {
  const sp = new URLSearchParams();
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.doctor_id) sp.set("doctor_id", params.doctor_id);
  if (params.status) sp.set("status", params.status);
  if (params.patient_search) sp.set("patient_search", params.patient_search);
  if (params.page) sp.set("page", String(params.page));
  if (params.page_size) sp.set("page_size", String(params.page_size));
  const qs = sp.toString();
  return apiClient<AppointmentListResponse>(`/appointments${qs ? `?${qs}` : ""}`, { token: getToken() });
}

export async function getAppointment(id: string): Promise<AppointmentResponse> {
  return apiClient<AppointmentResponse>(`/appointments/${id}`, { token: getToken() });
}

export async function createAppointment(data: AppointmentCreateInput): Promise<AppointmentResponse> {
  return apiClient<AppointmentResponse>("/appointments", {
    method: "POST",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function updateAppointment(id: string, data: AppointmentUpdateInput): Promise<AppointmentResponse> {
  return apiClient<AppointmentResponse>(`/appointments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function updateAppointmentStatus(id: string, status: string): Promise<AppointmentResponse> {
  return apiClient<AppointmentResponse>(`/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    token: getToken(),
  });
}

export async function listTreatments(specialty?: string): Promise<TreatmentListResponse> {
  const qs = specialty ? `?specialty=${encodeURIComponent(specialty)}` : "";
  return apiClient<TreatmentListResponse>(`/appointments/treatments${qs}`, { token: getToken() });
}

export async function sendAppointmentWhatsApp(
  id: string,
  type: "confirmation" | "reminder" | "custom" = "confirmation",
  message?: string,
): Promise<{ status: string; type: string }> {
  return apiClient<{ status: string; type: string }>(
    `/appointments/${id}/send-whatsapp`,
    {
      method: "POST",
      body: JSON.stringify({ type, message }),
      token: getToken(),
    },
  );
}

// ── React Query Hooks ──────────────────────────────────────────

export function useAppointments(params: ListAppointmentsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => listAppointments(params),
    enabled: options?.enabled,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: () => getAppointment(id),
    enabled: !!id,
  });
}

export function useTreatments(specialty?: string) {
  return useQuery({
    queryKey: ["treatments", specialty ?? "all"],
    queryFn: () => listTreatments(specialty),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentCreateInput) => createAppointment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUpdateAppointment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentUpdateInput) => updateAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useSendAppointmentWhatsApp() {
  return useMutation({
    mutationFn: ({ id, type, message }: { id: string; type?: "confirmation" | "reminder" | "custom"; message?: string }) =>
      sendAppointmentWhatsApp(id, type, message),
  });
}
