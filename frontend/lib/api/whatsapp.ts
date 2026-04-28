import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export interface WhatsAppSession {
  id: string;
  label: string;
  phone_number: string | null;
  status: "connecting" | "qr" | "connected" | "disconnected";
  connected_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSessionListResponse {
  sessions: WhatsAppSession[];
}

export interface Conversation {
  id: string;
  session_id: string;
  jid: string;
  patient_id: string | null;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
  handled_by: "ai" | "human" | "paused";
  handled_by_user_id: string | null;
  human_takeover_at: string | null;
  ai_opt_out: boolean;
  lead_score: number | null;
  lead_intent: string | null;
  lead_service: string | null;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

export interface ReplyTo {
  id: string;
  content: string;
  direction: "inbound" | "outbound";
  type: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "document" | "audio" | "video";
  content: string;
  media_url: string | null;
  status: "sent" | "delivered" | "read";
  reply_to_id: string | null;
  reply_to: ReplyTo | null;
  timestamp: string;
}

export interface MessageListResponse {
  messages: Message[];
}

export interface ListConversationsParams {
  session_id?: string;
  patient_id?: string;
  assigned_user_id?: string;
  handled_by?: "ai" | "human" | "paused";
  page?: number;
  page_size?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export interface TeamMemberListResponse {
  members: TeamMember[];
}

export const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3002";

// ── API Functions ──────────────────────────────────────────────

function getToken() {
  return useAuthStore.getState().accessToken || undefined;
}

// Sessions

export async function listSessions(): Promise<WhatsAppSessionListResponse> {
  return apiClient<WhatsAppSessionListResponse>("/whatsapp/sessions", {
    token: getToken(),
  });
}

export async function createSession(
  label: string,
): Promise<WhatsAppSession> {
  return apiClient<WhatsAppSession>("/whatsapp/sessions", {
    method: "POST",
    body: JSON.stringify({ label }),
    token: getToken(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await apiClient<void>(`/whatsapp/sessions/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}

export async function reconnectSession(
  id: string,
): Promise<WhatsAppSession> {
  return apiClient<WhatsAppSession>(`/whatsapp/sessions/${id}/reconnect`, {
    method: "POST",
    token: getToken(),
  });
}

// Conversations

export async function listConversations(
  params: ListConversationsParams = {},
): Promise<ConversationListResponse> {
  const searchParams = new URLSearchParams();
  if (params.session_id) searchParams.set("session_id", params.session_id);
  if (params.patient_id) searchParams.set("patient_id", params.patient_id);
  if (params.assigned_user_id)
    searchParams.set("assigned_user_id", params.assigned_user_id);
  if (params.handled_by) searchParams.set("handled_by", params.handled_by);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size)
    searchParams.set("page_size", String(params.page_size));

  const qs = searchParams.toString();
  return apiClient<ConversationListResponse>(
    `/whatsapp/conversations${qs ? `?${qs}` : ""}`,
    { token: getToken() },
  );
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiClient<Conversation>(`/whatsapp/conversations/${id}`, {
    token: getToken(),
  });
}

export async function listMessages(
  conversationId: string,
  limit = 50,
): Promise<MessageListResponse> {
  return apiClient<MessageListResponse>(
    `/whatsapp/conversations/${conversationId}/messages?limit=${limit}`,
    { token: getToken() },
  );
}

export async function sendMessage(
  conversationId: string,
  text: string,
  replyToId?: string,
): Promise<Message> {
  return apiClient<Message>(
    `/whatsapp/conversations/${conversationId}/send`,
    {
      method: "POST",
      body: JSON.stringify({ text, reply_to_id: replyToId || null }),
      token: getToken(),
    },
  );
}

export async function markRead(conversationId: string): Promise<void> {
  await apiClient<void>(`/whatsapp/conversations/${conversationId}/read`, {
    method: "POST",
    token: getToken(),
  });
}

export async function linkPatient(
  conversationId: string,
  patientId: string,
): Promise<Conversation> {
  return apiClient<Conversation>(
    `/whatsapp/conversations/${conversationId}/link-patient`,
    {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId }),
      token: getToken(),
    },
  );
}

export async function startConversation(
  sessionId: string,
  jid: string,
  contactName?: string,
): Promise<Conversation> {
  return apiClient<Conversation>("/whatsapp/conversations/start", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      jid,
      contact_name: contactName || "",
    }),
    token: getToken(),
  });
}

export async function checkWhatsAppNumber(
  phone: string,
): Promise<{ exists: boolean; jid: string | null }> {
  return apiClient<{ exists: boolean; jid: string | null }>(
    "/whatsapp/check-number",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
      token: getToken(),
    },
  );
}

export async function listTeamMembers(): Promise<TeamMemberListResponse> {
  return apiClient<TeamMemberListResponse>("/whatsapp/team-members", {
    token: getToken(),
  });
}

export async function assignConversation(
  conversationId: string,
  assignedUserId: string | null,
): Promise<Conversation> {
  return apiClient<Conversation>(
    `/whatsapp/conversations/${conversationId}/assignment`,
    {
      method: "PATCH",
      body: JSON.stringify({ assigned_user_id: assignedUserId }),
      token: getToken(),
    },
  );
}

// ── React Query Hooks ──────────────────────────────────────────

export function useWhatsAppSessions() {
  return useQuery({
    queryKey: ["whatsapp-sessions"],
    queryFn: listSessions,
    refetchInterval: 10000,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["whatsapp-team-members"],
    queryFn: listTeamMembers,
    staleTime: 60000,
  });
}

export function useCreateWhatsAppSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => createSession(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
  });
}

export function useDeleteWhatsAppSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
  });
}

export function useReconnectWhatsAppSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reconnectSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
  });
}

export function useConversations(params: ListConversationsParams = {}) {
  return useQuery({
    queryKey: ["whatsapp-conversations", params],
    queryFn: () => listConversations(params),
    refetchInterval: 5000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["whatsapp-conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ["whatsapp-messages", conversationId],
    queryFn: () => listMessages(conversationId),
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, replyToId }: { text: string; replyToId?: string }) =>
      sendMessage(conversationId, text, replyToId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-messages", conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ai-conversations"],
      });
    },
  });
}

export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversations"],
      });
    },
  });
}

export function useLinkPatient(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => linkPatient(conversationId, patientId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversation", conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversations"],
      });
    },
  });
}

export function useAssignConversation(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignedUserId: string | null) =>
      assignConversation(conversationId, assignedUserId),
    onSuccess: (conversation) => {
      queryClient.setQueryData(["whatsapp-conversation", conversationId], conversation);
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ai-conversations"],
      });
    },
  });
}
