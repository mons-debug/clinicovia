import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface DealResponse {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  pipeline_stage: string;
  stage_order: number;
  title: string;
  value: number;
  currency: string;
  treatment: string | null;
  temperature: "hot" | "warm" | "cold";
  assigned_to: string | null;
  notes: string | null;
  is_won: boolean;
  is_lost: boolean;
  lost_reason: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
}

export interface DealActivityResponse {
  id: string;
  action: string;
  description: string;
  from_stage: string | null;
  to_stage: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface DealDetailResponse extends DealResponse {
  patient_email: string | null;
  activities: DealActivityResponse[];
}

export interface StageSummary {
  count: number;
  value: number;
}

export interface DealSummary {
  total_value: number;
  total_deals: number;
  by_stage: Record<string, StageSummary>;
}

export interface DealListResponse {
  deals: DealResponse[];
  summary: DealSummary;
}

export interface DealCreateInput {
  patient_id: string;
  title: string;
  value?: number;
  currency?: string;
  treatment?: string | null;
  temperature?: string;
  assigned_to?: string | null;
  notes?: string | null;
}

export interface DealUpdateInput {
  title?: string;
  value?: number;
  treatment?: string | null;
  temperature?: string;
  assigned_to?: string | null;
  notes?: string | null;
}

export interface ListDealsParams {
  search?: string;
  stage?: string;
  temperature?: string;
  assigned_to?: string;
  patient_id?: string;
  include_closed?: boolean;
  sort_by?: string;
  sort_dir?: string;
}

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listDeals(params: ListDealsParams = {}): Promise<DealListResponse> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.stage) searchParams.set("stage", params.stage);
  if (params.temperature) searchParams.set("temperature", params.temperature);
  if (params.assigned_to) searchParams.set("assigned_to", params.assigned_to);
  if (params.patient_id) searchParams.set("patient_id", params.patient_id);
  if (params.include_closed) searchParams.set("include_closed", "true");
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_dir) searchParams.set("sort_dir", params.sort_dir);

  const qs = searchParams.toString();
  return apiClient<DealListResponse>(`/deals${qs ? `?${qs}` : ""}`, {
    token: getToken(),
  });
}

export async function getDeal(id: string): Promise<DealDetailResponse> {
  return apiClient<DealDetailResponse>(`/deals/${id}`, { token: getToken() });
}

export async function createDeal(data: DealCreateInput): Promise<DealResponse> {
  return apiClient<DealResponse>("/deals", {
    method: "POST",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function updateDeal(id: string, data: DealUpdateInput): Promise<DealResponse> {
  return apiClient<DealResponse>(`/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function moveDealStage(id: string, stage: string): Promise<DealResponse> {
  return apiClient<DealResponse>(`/deals/${id}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage }),
    token: getToken(),
  });
}

export async function markDealWon(id: string): Promise<DealResponse> {
  return apiClient<DealResponse>(`/deals/${id}/won`, {
    method: "POST",
    token: getToken(),
  });
}

export async function markDealLost(id: string, reason: string): Promise<DealResponse> {
  return apiClient<DealResponse>(`/deals/${id}/lost`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    token: getToken(),
  });
}

// ── React Query Hooks ──────────────────────────────────────────

export function useDeals(params: ListDealsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["deals", params],
    queryFn: () => listDeals(params),
    enabled: options?.enabled,
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: () => getDeal(id),
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DealCreateInput) => createDeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUpdateDeal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DealUpdateInput) => updateDeal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal", id] });
    },
  });
}

export function useMoveDealStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => moveDealStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useMarkDealWon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markDealWon(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal", id] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useMarkDealLost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => markDealLost(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal", id] });
    },
  });
}
