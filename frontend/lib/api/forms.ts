import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  helpText: string;
  required: boolean;
  validation: Record<string, unknown>;
  options: { label: string; value: string }[];
  order: number;
}

export interface FormSettings {
  submitButtonText: string;
  submitButtonColor: string;
  successMessage: string;
  redirectUrl: string | null;
}

export interface FormSchema {
  fields: FormField[];
  settings: FormSettings;
}

export interface FormResponse {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  schema: FormSchema;
  submission_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormListItem {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormStats {
  total: number;
  active: number;
  total_submissions: number;
}

export interface FormListResponse {
  forms: FormListItem[];
  total: number;
  stats: FormStats;
}

export interface FormSubmissionResponse {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  patient_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface FormSubmissionListResponse {
  submissions: FormSubmissionResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface FormCreateInput {
  title: string;
  description?: string | null;
  schema?: FormSchema;
}

export interface FormUpdateInput {
  title?: string;
  description?: string | null;
  status?: string;
  schema?: FormSchema;
}

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listForms(params: { status?: string; search?: string } = {}): Promise<FormListResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiClient<FormListResponse>(`/forms${qs ? `?${qs}` : ""}`, { token: getToken() });
}

export async function getForm(id: string): Promise<FormResponse> {
  return apiClient<FormResponse>(`/forms/${id}`, { token: getToken() });
}

export async function createForm(data: FormCreateInput): Promise<FormResponse> {
  return apiClient<FormResponse>("/forms", { method: "POST", body: JSON.stringify(data), token: getToken() });
}

export async function updateForm(id: string, data: FormUpdateInput): Promise<FormResponse> {
  return apiClient<FormResponse>(`/forms/${id}`, { method: "PUT", body: JSON.stringify(data), token: getToken() });
}

export async function listSubmissions(formId: string, page = 1, pageSize = 20): Promise<FormSubmissionListResponse> {
  return apiClient<FormSubmissionListResponse>(`/forms/${formId}/submissions?page=${page}&page_size=${pageSize}`, { token: getToken() });
}

export async function getPublicForm(slug: string): Promise<{ id: string; title: string; description: string | null; schema: FormSchema }> {
  return apiClient(`/public/forms/${slug}`);
}

export async function submitPublicForm(slug: string, data: Record<string, unknown>): Promise<{ message: string; id: string }> {
  return apiClient(`/public/forms/${slug}/submit`, { method: "POST", body: JSON.stringify({ data }) });
}

// ── Hooks ──────────────────────────────────────────────────────

export function useForms(params: { status?: string; search?: string } = {}) {
  return useQuery({ queryKey: ["forms", params], queryFn: () => listForms(params) });
}

export function useForm(id: string) {
  return useQuery({ queryKey: ["form", id], queryFn: () => getForm(id), enabled: !!id });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: FormCreateInput) => createForm(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }) });
}

export function useUpdateForm(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: FormUpdateInput) => updateForm(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["forms"] }); qc.invalidateQueries({ queryKey: ["form", id] }); } });
}

export function useFormSubmissions(formId: string, page = 1) {
  return useQuery({ queryKey: ["form-submissions", formId, page], queryFn: () => listSubmissions(formId, page), enabled: !!formId });
}

export function usePublicForm(slug: string) {
  return useQuery({ queryKey: ["public-form", slug], queryFn: () => getPublicForm(slug), enabled: !!slug });
}

export function useSubmitPublicForm(slug: string) {
  return useMutation({ mutationFn: (data: Record<string, unknown>) => submitPublicForm(slug, data) });
}
