import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────

export type PhotoStage = "before" | "during" | "after" | "follow_up" | "control";
export type PhotoAngle =
  | "front" | "left_45" | "right_45" | "left_profile" | "right_profile" | "back" | "detail" | "other";
export type ConsentScope = "medical" | "before_after" | "marketing";

export interface BodyZone {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string | null;
  name_en: string | null;
  category: "face" | "body" | "hair" | "extremities";
  sort_order: number;
  is_active: boolean;
}

export interface PatientPhoto {
  id: string;
  patient_id: string;
  plan_id: string | null;
  appointment_id: string | null;
  captured_by: string | null;
  storage: string;
  storage_key: string;
  content_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  zone_slug: string;
  stage: PhotoStage;
  angle: PhotoAngle | null;
  consent_scope: ConsentScope;
  captured_at: string;
  note: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────

export function photoFileUrl(photoId: string): string {
  return `${API_BASE_URL}/api/v1/photos/${photoId}/file`;
}

// ── Hooks ──────────────────────────────────────────────────────

export function useBodyZones() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["photos", "zones"],
    queryFn: () =>
      apiClient<{ zones: BodyZone[]; total: number }>("/photos/zones", {
        token: token ?? undefined,
      }),
  });
}

export function useSeedZones() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<{ inserted: number }>("/photos/zones/seed", {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", "zones"] }),
  });
}

export function usePatientPhotos(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["photos", "patient", patientId],
    queryFn: () =>
      apiClient<{ photos: PatientPhoto[]; total: number }>(
        `/photos?patient_id=${patientId}`,
        { token: token ?? undefined }
      ),
    enabled: !!patientId,
  });
}

export function useUploadPhoto() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      file: File;
      patient_id: string;
      zone_slug: string;
      stage: PhotoStage;
      angle?: PhotoAngle;
      consent_scope?: ConsentScope;
      plan_id?: string;
      appointment_id?: string;
      note?: string;
    }) => {
      const fd = new FormData();
      fd.append("file", input.file);
      fd.append("patient_id", input.patient_id);
      fd.append("zone_slug", input.zone_slug);
      fd.append("stage", input.stage);
      if (input.angle) fd.append("angle", input.angle);
      if (input.consent_scope) fd.append("consent_scope", input.consent_scope);
      if (input.plan_id) fd.append("plan_id", input.plan_id);
      if (input.appointment_id) fd.append("appointment_id", input.appointment_id);
      if (input.note) fd.append("note", input.note);

      const res = await fetch(`${API_BASE_URL}/api/v1/photos/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return (await res.json()) as PatientPhoto;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["photos", "patient", p.patient_id] });
    },
  });
}

export function useDeletePhoto(patientId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`${API_BASE_URL}/api/v1/photos/${photoId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["photos", "patient", patientId] }),
  });
}
