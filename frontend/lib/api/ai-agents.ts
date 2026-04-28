import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export type AIProvider = "openai" | "google_gemini";

export type AgentLanguage = "en" | "ar";

export type AgentTone = "professional" | "friendly" | "formal";

export interface AgentStats {
  conversations_today: number;
  messages_sent_today: number;
  avg_response_time_ms: number;
  success_rate: number;
}

export interface AgentListItem {
  id: string;
  persona_id: string;
  functional_type: string;
  display_name: string;
  role_description: string;
  ai_provider: AIProvider;
  ai_model: string;
  is_active: boolean;
  language: AgentLanguage;
  tone: AgentTone;
  confidence_threshold: number;
  max_followup_attempts: number;
  followup_delay_minutes: number;
  reactivation_delay_hours: number;
  rate_limit_messages: number;
  stats: AgentStats;
}

export interface AgentListResponse {
  agents: AgentListItem[];
}

export interface AgentDetail {
  id: string;
  persona_id: string;
  functional_type: string;
  display_name: string;
  role_description: string;
  ai_provider: AIProvider;
  ai_model: string;
  is_active: boolean;
  language: AgentLanguage;
  tone: AgentTone;
  system_prompt: string | null;
  manual_context: string | null;
  memory_notes: string | null;
  skill_instructions: string | null;
  confidence_threshold: number;
  max_followup_attempts: number;
  followup_delay_minutes: number;
  reactivation_delay_hours: number;
  rate_limit_messages: number;
}

export interface AgentUpdatePayload {
  is_active?: boolean;
  ai_provider?: AIProvider;
  ai_model?: string;
  language?: AgentLanguage;
  tone?: AgentTone;
  system_prompt?: string | null;
  manual_context?: string | null;
  memory_notes?: string | null;
  skill_instructions?: string | null;
  confidence_threshold?: number;
  max_followup_attempts?: number;
  followup_delay_minutes?: number;
  reactivation_delay_hours?: number;
  rate_limit_messages?: number;
}

export interface AgentTestResult {
  qualification: {
    score: number | null;
    intent: string | null;
    service: string | null;
    urgency: string | null;
  } | null;
  generated_response: string | null;
  confidence: number | null;
  ai_provider: string;
  ai_model: string;
  token_count: { input: number; output: number };
}

export interface ProviderStatus {
  provider: AIProvider;
  is_configured: boolean;
  is_active: boolean;
}

export interface ProviderListResponse {
  providers: ProviderStatus[];
}

export interface ProviderCredentialResponse {
  provider: AIProvider;
  is_configured: boolean;
  is_active: boolean;
  updated_at: string | null;
}

// ── API functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

export async function listAgents(): Promise<AgentListResponse> {
  return apiClient<AgentListResponse>("/ai-agents", { token: getToken() });
}

export async function getAgent(agentId: string): Promise<AgentDetail> {
  return apiClient<AgentDetail>(`/ai-agents/${agentId}`, { token: getToken() });
}

export async function updateAgent(
  agentId: string,
  payload: AgentUpdatePayload,
): Promise<AgentDetail> {
  return apiClient<AgentDetail>(`/ai-agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token: getToken(),
  });
}

export async function testAgent(
  agentId: string,
  testMessage: string,
  language?: AgentLanguage,
): Promise<AgentTestResult> {
  return apiClient<AgentTestResult>(`/ai-agents/${agentId}/test`, {
    method: "POST",
    body: JSON.stringify({ test_message: testMessage, language }),
    token: getToken(),
  });
}

export async function listProviders(): Promise<ProviderListResponse> {
  return apiClient<ProviderListResponse>("/ai-agents/providers", {
    token: getToken(),
  });
}

export async function setProviderCredential(
  provider: AIProvider,
  apiKey: string,
  isActive = true,
): Promise<ProviderCredentialResponse> {
  return apiClient<ProviderCredentialResponse>(
    `/ai-agents/providers/${provider}`,
    {
      method: "PUT",
      body: JSON.stringify({ api_key: apiKey, is_active: isActive }),
      token: getToken(),
    },
  );
}

export async function takeoverConversation(
  conversationId: string,
): Promise<{
  conversation_id: string;
  handled_by: string;
  handled_by_user: string | null;
  takeover_at: string | null;
}> {
  return apiClient(`/ai-agents/conversations/${conversationId}/takeover`, {
    method: "POST",
    token: getToken(),
  });
}

export async function releaseConversation(
  conversationId: string,
): Promise<{
  conversation_id: string;
  handled_by: string;
  released_at: string;
}> {
  return apiClient(`/ai-agents/conversations/${conversationId}/release`, {
    method: "POST",
    token: getToken(),
  });
}

// ── Per-conversation agent toggles ─────────────────────────────

export interface ConversationAgentEntry {
  persona_id: string;
  persona_name: string;
  functional_type: string;
  is_active_clinic: boolean;
  is_enabled_conversation: boolean;
}

export interface ConversationAgentsResponse {
  conversation_id: string;
  inherits_clinic_defaults: boolean;
  enabled_agents: string[] | null;
  agents: ConversationAgentEntry[];
}

export async function getConversationAgents(
  conversationId: string,
): Promise<ConversationAgentsResponse> {
  return apiClient(`/ai-agents/conversations/${conversationId}/agents`, {
    method: "GET",
    token: getToken(),
  });
}

export async function setConversationAgents(
  conversationId: string,
  enabledAgents: string[] | null,
): Promise<ConversationAgentsResponse> {
  return apiClient(`/ai-agents/conversations/${conversationId}/agents`, {
    method: "PATCH",
    body: JSON.stringify({ enabled_agents: enabledAgents }),
    token: getToken(),
  });
}

// ── React Query hooks ──────────────────────────────────────────

export function useAgents() {
  return useQuery({
    queryKey: ["ai-agents"],
    queryFn: listAgents,
    refetchInterval: 30000,
  });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ["ai-agent", agentId],
    queryFn: () => getAgent(agentId),
    enabled: !!agentId,
  });
}

export function useUpdateAgent(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentUpdatePayload) => updateAgent(agentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["ai-agent", agentId] });
    },
  });
}

export function useTestAgent(agentId: string) {
  return useMutation({
    mutationFn: ({
      testMessage,
      language,
    }: {
      testMessage: string;
      language?: AgentLanguage;
    }) => testAgent(agentId, testMessage, language),
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ["ai-providers"],
    queryFn: listProviders,
  });
}

export function useSetProviderCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      apiKey,
      isActive,
    }: {
      provider: AIProvider;
      apiKey: string;
      isActive?: boolean;
    }) => setProviderCredential(provider, apiKey, isActive ?? true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });
}

// ── Dashboard ──────────────────────────────────────────────────

export type DashboardPeriod = "today" | "week" | "month";

export interface DashboardStats {
  period: DashboardPeriod;
  leads_qualified: number;
  messages_sent: number;
  conversations_active: number;
  appointments_booked: number;
  followups_sent: number;
  escalated_to_human: number;
  workflows_completed: number;
  workflows_failed: number;
  avg_response_time_ms: number;
  conversion_rate: number;
}

export async function getDashboardStats(
  period: DashboardPeriod = "today",
): Promise<DashboardStats> {
  return apiClient<DashboardStats>(
    `/ai-agents/dashboard/stats?period=${period}`,
    { token: getToken() },
  );
}

export function useDashboardStats(period: DashboardPeriod = "today") {
  return useQuery({
    queryKey: ["ai-dashboard-stats", period],
    queryFn: () => getDashboardStats(period),
    refetchInterval: 30000,
  });
}

export interface ActivityItem {
  id: string;
  event_type: string;
  agent_persona: string | null;
  agent_display_name: string | null;
  patient_name: string | null;
  patient_id: string | null;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityListResponse {
  total: number;
  items: ActivityItem[];
}

export async function getDashboardActivity(params: {
  skip?: number;
  limit?: number;
  agentId?: string;
  eventType?: string;
} = {}): Promise<ActivityListResponse> {
  const q = new URLSearchParams();
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.agentId) q.set("agent_id", params.agentId);
  if (params.eventType) q.set("event_type", params.eventType);
  const qs = q.toString();
  return apiClient<ActivityListResponse>(
    `/ai-agents/dashboard/activity${qs ? `?${qs}` : ""}`,
    { token: getToken() },
  );
}

export function useDashboardActivity(params: {
  skip?: number;
  limit?: number;
  agentId?: string;
  eventType?: string;
} = {}) {
  return useQuery({
    queryKey: ["ai-dashboard-activity", params],
    queryFn: () => getDashboardActivity(params),
    refetchInterval: 15000,
  });
}

export interface WorkflowItem {
  id: string;
  trigger_type: string;
  goal: string;
  status: string;
  patient_name: string | null;
  patient_id: string | null;
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface WorkflowListResponse {
  total: number;
  items: WorkflowItem[];
}

export async function getDashboardWorkflows(params: {
  skip?: number;
  limit?: number;
  status?: string;
  triggerType?: string;
  patientId?: string;
} = {}): Promise<WorkflowListResponse> {
  const q = new URLSearchParams();
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.triggerType) q.set("trigger_type", params.triggerType);
  if (params.patientId) q.set("patient_id", params.patientId);
  const qs = q.toString();
  return apiClient<WorkflowListResponse>(
    `/ai-agents/dashboard/workflows${qs ? `?${qs}` : ""}`,
    { token: getToken() },
  );
}

export function useDashboardWorkflows(params: {
  skip?: number;
  limit?: number;
  status?: string;
  triggerType?: string;
  patientId?: string;
} = {}) {
  return useQuery({
    queryKey: ["ai-dashboard-workflows", params],
    queryFn: () => getDashboardWorkflows(params),
    refetchInterval: 20000,
  });
}

// ── Conversations ──────────────────────────────────────────────

export interface AIConversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
  handled_by: "ai" | "human" | "paused";
  handled_by_user_id: string | null;
  human_takeover_at: string | null;
  ai_opt_out: boolean;
  lead_score: number | null;
  lead_intent: string | null;
  lead_service: string | null;
  patient_id: string | null;
  patient_name: string | null;
}

export interface AIConversationListResponse {
  total: number;
  items: AIConversation[];
}

export async function listAIConversations(params: {
  skip?: number;
  limit?: number;
  handledBy?: "ai" | "human" | "paused";
} = {}): Promise<AIConversationListResponse> {
  const q = new URLSearchParams();
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.handledBy) q.set("handled_by", params.handledBy);
  const qs = q.toString();
  return apiClient<AIConversationListResponse>(
    `/ai-agents/conversations${qs ? `?${qs}` : ""}`,
    { token: getToken() },
  );
}

export function useAIConversations(params: {
  skip?: number;
  limit?: number;
  handledBy?: "ai" | "human" | "paused";
} = {}) {
  return useQuery({
    queryKey: ["ai-conversations", params],
    queryFn: () => listAIConversations(params),
    refetchInterval: 15000,
  });
}

export function useTakeoverConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => takeoverConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}

export function useReleaseConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => releaseConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}

export function useConversationAgents(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-agents", conversationId],
    queryFn: () => getConversationAgents(conversationId!),
    enabled: !!conversationId,
  });
}

export function useSetConversationAgents(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabledAgents: string[] | null) =>
      setConversationAgents(conversationId, enabledAgents),
    onSuccess: (data) => {
      queryClient.setQueryData(["conversation-agents", conversationId], data);
    },
  });
}

// ── Knowledge base ─────────────────────────────────────────────

export type KBEntryType =
  | "system_prompt"
  | "response_template"
  | "service_info"
  | "faq"
  | "objection_handler"
  | "custom_context";

export interface KBEntry {
  id: string;
  agent_config_id: string | null;
  entry_type: KBEntryType;
  title: string;
  content: string;
  language: AgentLanguage;
  service_type: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface KBListResponse {
  total: number;
  items: KBEntry[];
}

export interface KBCreatePayload {
  agent_config_id?: string | null;
  entry_type: KBEntryType;
  title: string;
  content: string;
  language?: AgentLanguage;
  service_type?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface KBUpdatePayload {
  agent_config_id?: string | null;
  entry_type?: KBEntryType;
  title?: string;
  content?: string;
  language?: AgentLanguage;
  service_type?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function listKnowledgeBase(params: {
  agentId?: string;
  entryType?: KBEntryType;
  serviceType?: string;
  language?: AgentLanguage;
  skip?: number;
  limit?: number;
} = {}): Promise<KBListResponse> {
  const q = new URLSearchParams();
  if (params.agentId) q.set("agent_id", params.agentId);
  if (params.entryType) q.set("entry_type", params.entryType);
  if (params.serviceType) q.set("service_type", params.serviceType);
  if (params.language) q.set("language", params.language);
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiClient<KBListResponse>(
    `/ai-agents/knowledge-base${qs ? `?${qs}` : ""}`,
    { token: getToken() },
  );
}

export async function createKnowledgeEntry(
  payload: KBCreatePayload,
): Promise<KBEntry> {
  return apiClient<KBEntry>("/ai-agents/knowledge-base", {
    method: "POST",
    body: JSON.stringify(payload),
    token: getToken(),
  });
}

export async function updateKnowledgeEntry(
  entryId: string,
  payload: KBUpdatePayload,
): Promise<KBEntry> {
  return apiClient<KBEntry>(`/ai-agents/knowledge-base/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token: getToken(),
  });
}

export async function deleteKnowledgeEntry(entryId: string): Promise<void> {
  return apiClient<void>(`/ai-agents/knowledge-base/${entryId}`, {
    method: "DELETE",
    token: getToken(),
  });
}

export function useKnowledgeBase(params: {
  agentId?: string;
  entryType?: KBEntryType;
  serviceType?: string;
  language?: AgentLanguage;
} = {}) {
  return useQuery({
    queryKey: ["ai-knowledge-base", params],
    queryFn: () => listKnowledgeBase(params),
  });
}

export function useCreateKnowledgeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KBCreatePayload) => createKnowledgeEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    },
  });
}

export function useUpdateKnowledgeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      payload,
    }: {
      entryId: string;
      payload: KBUpdatePayload;
    }) => updateKnowledgeEntry(entryId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    },
  });
}

export function useDeleteKnowledgeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deleteKnowledgeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    },
  });
}
