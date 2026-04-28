import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface TrackingIntegration {
  id: string;
  platform: string;
  is_enabled: boolean;
  has_credentials: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackingIntegrationDetail {
  id: string;
  platform: string;
  is_enabled: boolean;
  credential_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationListResponse {
  integrations: TrackingIntegration[];
}

export interface EventMapping {
  id: string;
  pipeline_stage: string;
  event_name: string;
  include_value: boolean;
  is_active: boolean;
}

export interface EventMappingListResponse {
  mappings: EventMapping[];
}

export interface ConversionEvent {
  id: string;
  platform: string;
  event_name: string;
  event_id: string;
  trigger_type: string;
  trigger_id: string | null;
  patient_id: string | null;
  value: number | null;
  currency: string;
  status: string;
  error_message: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
}

export interface ConversionEventListResponse {
  events: ConversionEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface ConversionStatsResponse {
  total_events: number;
  by_platform: Record<string, { sent: number; failed: number }>;
  by_event_name: Record<string, number>;
  by_status: Record<string, number>;
  total_value: number;
  currency: string;
}

export interface ListEventsParams {
  platform?: string;
  status?: string;
  event_name?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// Platform credential field definitions
export const PLATFORM_CONFIG: Record<string, { label: string; fields: { key: string; label: string; secret: boolean }[]; color: string }> = {
  meta: {
    label: "Meta (Facebook)",
    color: "#1877F2",
    fields: [
      { key: "pixel_id", label: "Pixel ID", secret: false },
      { key: "access_token", label: "Conversions API Token", secret: true },
    ],
  },
  google_ads: {
    label: "Google Ads",
    color: "#4285F4",
    fields: [
      { key: "conversion_id", label: "Conversion ID (AW-XXXXXXXXX)", secret: false },
      { key: "conversion_label", label: "Conversion Label", secret: false },
    ],
  },
  ga4: {
    label: "Google Analytics 4",
    color: "#E37400",
    fields: [
      { key: "measurement_id", label: "Measurement ID (G-XXXXXX)", secret: false },
      { key: "api_secret", label: "API Secret", secret: true },
    ],
  },
  gtm: {
    label: "Google Tag Manager",
    color: "#4285F4",
    fields: [
      { key: "container_id", label: "Container ID (GTM-XXXXXX)", secret: false },
    ],
  },
  snapchat: {
    label: "Snapchat",
    color: "#FFFC00",
    fields: [
      { key: "pixel_id", label: "Pixel ID", secret: false },
      { key: "capi_token", label: "CAPI Token (v2)", secret: true },
    ],
  },
  tiktok: {
    label: "TikTok",
    color: "#000000",
    fields: [
      { key: "pixel_id", label: "Pixel ID", secret: false },
      { key: "events_api_token", label: "Events API Token (v2)", secret: true },
    ],
  },
};

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listIntegrations(): Promise<IntegrationListResponse> {
  return apiClient<IntegrationListResponse>("/tracking/integrations", { token: getToken() });
}

export async function getIntegration(platform: string): Promise<TrackingIntegrationDetail> {
  return apiClient<TrackingIntegrationDetail>(`/tracking/integrations/${platform}`, { token: getToken() });
}

export async function upsertIntegration(platform: string, data: { is_enabled: boolean; credentials: Record<string, string> }): Promise<TrackingIntegrationDetail> {
  return apiClient<TrackingIntegrationDetail>(`/tracking/integrations/${platform}`, {
    method: "PUT",
    body: JSON.stringify(data),
    token: getToken(),
  });
}

export async function deleteIntegration(platform: string): Promise<void> {
  await apiClient<void>(`/tracking/integrations/${platform}`, { method: "DELETE", token: getToken() });
}

export async function listMappings(): Promise<EventMappingListResponse> {
  return apiClient<EventMappingListResponse>("/tracking/mappings", { token: getToken() });
}

export async function bulkUpdateMappings(mappings: { pipeline_stage: string; event_name: string; include_value: boolean; is_active: boolean }[]): Promise<EventMappingListResponse> {
  return apiClient<EventMappingListResponse>("/tracking/mappings", {
    method: "PUT",
    body: JSON.stringify({ mappings }),
    token: getToken(),
  });
}

export async function resetMappings(): Promise<EventMappingListResponse> {
  return apiClient<EventMappingListResponse>("/tracking/mappings/reset", { method: "POST", token: getToken() });
}

export async function listEvents(params: ListEventsParams = {}): Promise<ConversionEventListResponse> {
  const sp = new URLSearchParams();
  if (params.platform) sp.set("platform", params.platform);
  if (params.status) sp.set("status", params.status);
  if (params.event_name) sp.set("event_name", params.event_name);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.page) sp.set("page", String(params.page));
  if (params.page_size) sp.set("page_size", String(params.page_size));
  const qs = sp.toString();
  return apiClient<ConversionEventListResponse>(`/tracking/events${qs ? `?${qs}` : ""}`, { token: getToken() });
}

export async function getEventStats(params: { date_from?: string; date_to?: string } = {}): Promise<ConversionStatsResponse> {
  const sp = new URLSearchParams();
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  const qs = sp.toString();
  return apiClient<ConversionStatsResponse>(`/tracking/events/stats${qs ? `?${qs}` : ""}`, { token: getToken() });
}

// ── React Query Hooks ──────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ["tracking-integrations"],
    queryFn: listIntegrations,
  });
}

export function useIntegration(platform: string) {
  return useQuery({
    queryKey: ["tracking-integration", platform],
    queryFn: () => getIntegration(platform),
    enabled: !!platform,
  });
}

export function useUpsertIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platform, data }: { platform: string; data: { is_enabled: boolean; credentials: Record<string, string> } }) =>
      upsertIntegration(platform, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-integration"] });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => deleteIntegration(platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-integrations"] });
    },
  });
}

export function useMappings() {
  return useQuery({
    queryKey: ["tracking-mappings"],
    queryFn: listMappings,
  });
}

export function useBulkUpdateMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateMappings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-mappings"] });
    },
  });
}

export function useResetMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetMappings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-mappings"] });
    },
  });
}

export function useConversionEvents(params: ListEventsParams = {}) {
  return useQuery({
    queryKey: ["tracking-events", params],
    queryFn: () => listEvents(params),
  });
}

export function useConversionStats(params: { date_from?: string; date_to?: string } = {}) {
  return useQuery({
    queryKey: ["tracking-stats", params],
    queryFn: () => getEventStats(params),
  });
}
