import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  specialty: string;
  is_active: boolean;
  created_at: string;
}

export interface DoctorListResponse {
  doctors: Doctor[];
  total: number;
}

export interface DoctorCreateInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  specialty?: string;
  password: string;
}

export interface DoctorUpdateInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  specialty?: string;
}

export interface ListDoctorsParams {
  search?: string;
  page?: number;
  page_size?: number;
}

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listDoctors(params: ListDoctorsParams = {}): Promise<DoctorListResponse> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.page) sp.set("page", String(params.page));
  if (params.page_size) sp.set("page_size", String(params.page_size));
  const qs = sp.toString();
  return apiClient<DoctorListResponse>(`/doctors${qs ? `?${qs}` : ""}`, { token: getToken() });
}

export async function getDoctor(id: string): Promise<Doctor> {
  return apiClient<Doctor>(`/doctors/${id}`, { token: getToken() });
}

export async function createDoctor(data: DoctorCreateInput): Promise<Doctor> {
  return apiClient<Doctor>("/doctors", {
    method: "POST",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function updateDoctor(id: string, data: DoctorUpdateInput): Promise<Doctor> {
  return apiClient<Doctor>(`/doctors/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function deleteDoctor(id: string): Promise<void> {
  await apiClient<void>(`/doctors/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}

// ── React Query Hooks ──────────────────────────────────────────

export function useDoctors(params: ListDoctorsParams = {}) {
  return useQuery({
    queryKey: ["doctors", params],
    queryFn: () => listDoctors(params),
  });
}

export function useDoctor(id: string) {
  return useQuery({
    queryKey: ["doctor", id],
    queryFn: () => getDoctor(id),
    enabled: !!id,
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DoctorCreateInput) => createDoctor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
}

export function useUpdateDoctor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DoctorUpdateInput) => updateDoctor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", id] });
    },
  });
}

export function useDeleteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
}
