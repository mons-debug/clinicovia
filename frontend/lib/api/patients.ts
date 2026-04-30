import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface PatientTag {
  id: string;
  tag: string;
  color: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  // Identity
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  phone_country_code: string;
  gender: string | null;
  date_of_birth: string | null;
  cnie: string | null;
  avatar_url: string | null;
  // Address
  city: string | null;
  country: string | null;
  // Preferences
  language_pref: string;
  channel_pref: string;
  // Clinical
  fitzpatrick: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  smoker: boolean | null;
  // Lead / attribution
  status: string;
  lead_source: string | null;
  lead_score: number;
  treatment_interests: string | null;
  source_campaign: string | null;
  source_medium: string | null;
  first_touch_at: string | null;
  // Workflow
  intake_status: string;
  intake_at: string | null;
  requested_service: string | null;
  // Assignment + financial
  assigned_to: string | null;
  total_spent: number;
  lifetime_value: number;
  // WhatsApp
  whatsapp_id: string | null;
  // Notes + lifecycle
  internal_notes: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  tags: PatientTag[];
}

export interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PatientNote {
  id: string;
  content: string;
  is_pinned: boolean;
  author_id: string | null;
  created_at: string;
}

export interface PatientActivity {
  id: string;
  action: string;
  description: string;
  actor_id: string | null;
  created_at: string;
}

export interface PatientCreateInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  phone_country_code?: string;
  gender?: string | null;
  date_of_birth?: string | null;
  cnie?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  language_pref?: string | null;
  channel_pref?: string | null;
  fitzpatrick?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  smoker?: boolean | null;
  lead_source?: string | null;
  treatment_interests?: string | null;
  intake_status?: string | null;
  requested_service?: string | null;
  assigned_to?: string | null;
  internal_notes?: string | null;
  tags?: string[] | null;
}

export interface PatientUpdateInput {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string;
  phone_country_code?: string;
  gender?: string | null;
  date_of_birth?: string | null;
  cnie?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  language_pref?: string | null;
  channel_pref?: string | null;
  fitzpatrick?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  smoker?: boolean | null;
  status?: string;
  lead_source?: string | null;
  lead_score?: number;
  treatment_interests?: string | null;
  intake_status?: string | null;
  requested_service?: string | null;
  assigned_to?: string | null;
  internal_notes?: string | null;
}

export interface ListPatientsParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  source?: string;
  sort_by?: string;
  sort_dir?: string;
}

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listPatients(params: ListPatientsParams = {}): Promise<PatientListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.source) searchParams.set("source", params.source);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_dir) searchParams.set("sort_dir", params.sort_dir);

  const qs = searchParams.toString();
  return apiClient<PatientListResponse>(`/patients${qs ? `?${qs}` : ""}`, {
    token: getToken(),
  });
}

export async function getPatient(id: string): Promise<Patient> {
  return apiClient<Patient>(`/patients/${id}`, { token: getToken() });
}

export async function createPatient(data: PatientCreateInput): Promise<Patient> {
  return apiClient<Patient>("/patients", {
    method: "POST",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function updatePatient(id: string, data: PatientUpdateInput): Promise<Patient> {
  return apiClient<Patient>(`/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function deletePatient(id: string): Promise<void> {
  await apiClient<void>(`/patients/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}

export async function listPatientNotes(patientId: string): Promise<PatientNote[]> {
  return apiClient<PatientNote[]>(`/patients/${patientId}/notes`, {
    token: getToken(),
  });
}

export async function createPatientNote(
  patientId: string,
  data: { content: string; is_pinned?: boolean }
): Promise<PatientNote> {
  return apiClient<PatientNote>(`/patients/${patientId}/notes`, {
    method: "POST",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function listPatientActivities(
  patientId: string,
  limit = 50
): Promise<PatientActivity[]> {
  return apiClient<PatientActivity[]>(
    `/patients/${patientId}/activities?limit=${limit}`,
    { token: getToken() }
  );
}

// ── React Query Hooks ──────────────────────────────────────────

export function usePatients(params: ListPatientsParams = {}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => listPatients(params),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
    enabled: !!id,
  });
}

export function usePatientNotes(patientId: string) {
  return useQuery({
    queryKey: ["patient-notes", patientId],
    queryFn: () => listPatientNotes(patientId),
    enabled: !!patientId,
  });
}

export function usePatientActivities(patientId: string) {
  return useQuery({
    queryKey: ["patient-activities", patientId],
    queryFn: () => listPatientActivities(patientId),
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientCreateInput) => createPatient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientUpdateInput) => updatePatient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useCreatePatientNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; is_pinned?: boolean }) =>
      createPatientNote(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notes", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patient-activities", patientId] });
    },
  });
}
