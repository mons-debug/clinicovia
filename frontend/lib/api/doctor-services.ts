import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface DoctorService {
  id: string;
  clinic_id: string;
  doctor_id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  default_price: number;
  consent_template: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface DoctorServiceGroup {
  doctor_id: string;
  doctor_name: string;
  specialty: string | null;
  services: DoctorService[];
}

export interface ServiceCreateInput {
  name: string;
  category?: string;
  description?: string;
  duration_minutes?: number;
  default_price?: number;
  consent_template?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface ServiceUpdateInput {
  name?: string;
  category?: string;
  description?: string;
  duration_minutes?: number;
  default_price?: number;
  consent_template?: string;
  is_active?: boolean;
  sort_order?: number;
}

export function useMyServices() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["doctor-services", "mine"],
    queryFn: () =>
      apiClient<DoctorService[]>("/doctor-services", {
        token: token ?? undefined,
      }),
    enabled: !!token,
  });
}

export function useAllServices() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["doctor-services", "all"],
    queryFn: () =>
      apiClient<DoctorServiceGroup[]>("/doctor-services/all", {
        token: token ?? undefined,
      }),
    enabled: !!token,
  });
}

export function useService(serviceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["doctor-services", serviceId],
    queryFn: () =>
      apiClient<DoctorService>(`/doctor-services/${serviceId}`, {
        token: token ?? undefined,
      }),
    enabled: !!token && !!serviceId,
  });
}

export function useCreateService() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceCreateInput) =>
      apiClient<DoctorService>("/doctor-services", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-services"] });
    },
  });
}

export function useUpdateService(serviceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceUpdateInput) =>
      apiClient<DoctorService>(`/doctor-services/${serviceId}`, {
        method: "PUT",
        token: token ?? undefined,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-services"] });
    },
  });
}

export function useDeleteService() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) =>
      apiClient<void>(`/doctor-services/${serviceId}`, {
        method: "DELETE",
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-services"] });
    },
  });
}
