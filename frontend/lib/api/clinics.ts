import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  clinic_type: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  language: string;
  ice: string | null;
  if_number: string | null;
  rc_number: string | null;
  cnss: string | null;
  primary_color: string;
  accent_color: string;
  plan: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicUpdateInput {
  name?: string;
  clinic_type?: string | null;
  description?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string;
  currency?: string;
  language?: string;
  ice?: string | null;
  if_number?: string | null;
  rc_number?: string | null;
  cnss?: string | null;
  primary_color?: string;
  accent_color?: string;
}

// ── Hooks ──────────────────────────────────────────────────────

export function useMyClinic() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["clinic", "me"],
    queryFn: () => apiClient<Clinic>("/clinics/me", { token: token ?? undefined }),
  });
}

export function useUpdateMyClinic() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClinicUpdateInput) =>
      apiClient<Clinic>("/clinics/me", {
        method: "PATCH",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic", "me"] }),
  });
}
