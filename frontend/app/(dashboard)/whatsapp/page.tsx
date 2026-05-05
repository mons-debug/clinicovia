"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  MoreVertical,
  User,
  CheckCheck,
  MessageSquare,
  MapPin,
  Mail,
  Star,
  Loader2,
  Calendar,
  Briefcase,
  Settings,
  ArrowRight,
  Reply,
  Forward,
  X,
  Image as ImageIcon,
  FileText,
  Play,
  Mic,
  Plus,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { NumberSelector } from "@/components/whatsapp/number-selector";
import {
  useWhatsAppSessions,
  useConversations,
  useMessages,
  useSendMessage,
  useMarkRead,
  useTeamMembers,
  useAssignConversation,
  startConversation,
  type Conversation,
  type Message,
} from "@/lib/api/whatsapp";
import { usePatients, usePatient } from "@/lib/api/patients";
import { useAppointments } from "@/lib/api/appointments";
import { useDeals } from "@/lib/api/deals";
import {
  useConversationAgents,
  useSetConversationAgents,
} from "@/lib/api/ai-agents";
import { Sparkles } from "lucide-react";

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function formatMessageTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Play,
  audio: Mic,
};

export default function WhatsAppInboxPage() {
  const searchParams = useSearchParams();
  const deepLinkConvId = searchParams.get("conversation");

  const { data: sessionsData } = useWhatsAppSessions();
  const sessions = sessionsData?.sessions || [];
  const connectedSessions = sessions.filter((s) => s.status === "connected");

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(deepLinkConvId);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showInfo, setShowInfo] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: convsData, isLoading: convsLoading } = useConversations({
    session_id: selectedSessionId || undefined,
  });
  const conversations = convsData?.conversations || [];
  const filteredConversations = conversations.filter((c) =>
    c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_phone.includes(searchQuery),
  );

  const activeConv = conversations.find((c) => c.id === selectedConvId);
  const { data: messagesData } = useMessages(selectedConvId || "");
  const messages = messagesData?.messages || [];
  const sendMutation = useSendMessage(selectedConvId || "");
  const markReadMutation = useMarkRead(selectedConvId || "");

  // Patient search for new chat
  const { data: patientsData } = usePatients({
    search: patientSearch,
    page_size: 10,
  });
  const patients = patientsData?.patients || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedConvId]);

  useEffect(() => {
    if (selectedConvId && activeConv && activeConv.unread_count > 0) {
      markReadMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvId]);

  useEffect(() => {
    setShowEmojiPicker(false);
    setReplyTo(null);
    setForwardMsg(null);
  }, [selectedConvId]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConvId) return;
    const text = messageInput.trim();
    const replyId = replyTo?.id;
    setMessageInput("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    try {
      await sendMutation.mutateAsync({ text, replyToId: replyId });
    } catch {
      setMessageInput(text);
    }
  };

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessageInput((prev) => prev + emoji.native);
    inputRef.current?.focus();
  }, []);

  const handleForward = (msg: Message, targetConvId: string) => {
    setSelectedConvId(targetConvId);
    setMessageInput(msg.content);
    setForwardMsg(null);
  };

  const handleStartChat = async (patientPhone: string, patientName: string) => {
    const session = connectedSessions[0];
    if (!session) {
      toast.error("No WhatsApp number connected");
      return;
    }
    try {
      const phone = patientPhone.replace(/\D/g, "");
      const jid = `${phone}@s.whatsapp.net`;
      const conv = await startConversation(session.id, jid, patientName);
      setSelectedConvId(conv.id);
      setShowNewChat(false);
      setPatientSearch("");
    } catch {
      toast.error("Failed to start conversation");
    }
  };

  // No connected sessions
  if (connectedSessions.length === 0 && sessions.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-xl border border-border bg-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#F0FDF4" }}>
            <MessageSquare className="h-7 w-7" style={{ color: "#22C55E" }} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-text-primary">No WhatsApp numbers connected</h3>
          <p className="mt-1 text-xs text-text-secondary">Connect a WhatsApp number in settings to start receiving messages</p>
          <Link href="/settings/whatsapp" className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary-light)" }}>
            <Settings className="h-4 w-4" />
            Go to Settings
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-xl border border-border bg-white">
      {/* Left Panel — Conversation List */}
      <div className="flex w-[320px] shrink-0 flex-col border-r border-border">
        <NumberSelector sessions={sessions} selectedId={selectedSessionId} onChange={setSelectedSessionId} />

        {/* Search + New Chat button */}
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-gray-50 py-2 pl-10 pr-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className={`shrink-0 rounded-lg p-2 transition-colors ${showNewChat ? "bg-primary-lighter/20 text-primary-light" : "text-text-secondary hover:bg-gray-100"}`}
              title="New chat"
            >
              <UserPlus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* New Chat — Patient Search Panel */}
        {showNewChat && (
          <div className="border-b border-border bg-gray-50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Start new conversation</p>
            <input
              type="text"
              placeholder="Search patient by name or phone..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-white py-2 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              autoFocus
            />
            {patientSearch.length >= 2 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {patients.length === 0 ? (
                  <p className="py-3 text-center text-xs text-text-muted">No patients found</p>
                ) : (
                  patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleStartChat(
                        `${p.phone_country_code}${p.phone}`,
                        `${p.first_name} ${p.last_name}`,
                      )}
                      className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: "var(--primary)" }}
                      >
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{p.first_name} {p.last_name}</p>
                        <p className="text-[10px] text-text-muted">{p.phone_country_code}{p.phone}</p>
                      </div>
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-2 text-xs text-text-secondary">No conversations yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                <Plus className="h-3 w-3" />
                New Chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                  selectedConvId === conv.id ? "bg-primary-lighter/20" : "hover:bg-gray-50"
                }`}
              >
                <div className="relative">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {getInitials(conv.contact_name)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-sm ${conv.unread_count > 0 ? "font-semibold" : "font-medium"} text-text-primary`}>
                      {conv.contact_name}
                    </p>
                    <span className="shrink-0 text-[10px] text-text-muted">{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-text-secondary">{conv.last_message || "No messages"}</p>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#25D366" }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Center Panel — Chat */}
      <div className="flex flex-1 flex-col">
        {activeConv ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                  {getInitials(activeConv.contact_name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{activeConv.contact_name}</p>
                  <p className="text-[10px] text-text-muted">+{activeConv.contact_phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100">
                  <Phone className="h-4 w-4" />
                </button>
                <button onClick={() => setShowInfo(!showInfo)} className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100">
                  <User className="h-4 w-4" />
                </button>
                <button className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[#F0F2F5] p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-text-muted">No messages yet — send the first message</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === "inbound";
                  const TypeIcon = msg.type !== "text" ? TYPE_ICONS[msg.type] : null;

                  return (
                    <div key={msg.id} className={`group flex ${isInbound ? "justify-start" : "justify-end"}`}>
                      <div className="relative max-w-[70%]">
                        <div className={`absolute top-0 ${isInbound ? "-right-16" : "-left-16"} hidden items-center gap-0.5 group-hover:flex`}>
                          <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600" title="Reply">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setForwardMsg(msg)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600" title="Forward">
                            <Forward className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className={`rounded-xl px-3.5 py-2.5 ${isInbound ? "bg-white text-text-primary" : "bg-blue-500 text-white"}`}>
                          {msg.reply_to && (
                            <div className={`mb-2 rounded-lg border-l-2 px-2.5 py-1.5 text-[11px] ${isInbound ? "border-blue-400 bg-gray-50 text-text-secondary" : "border-blue-200 bg-blue-600/40 text-blue-100"}`}>
                              <p className="truncate">{msg.reply_to.content}</p>
                            </div>
                          )}
                          {msg.type === "image" && msg.media_url && <img src={msg.media_url} alt="Image" className="mb-1.5 max-h-48 rounded-lg object-cover" />}
                          {msg.type === "video" && msg.media_url && <video src={msg.media_url} controls className="mb-1.5 max-h-48 rounded-lg" />}
                          {msg.type !== "text" && !msg.media_url && TypeIcon && (
                            <div className={`mb-1.5 flex items-center gap-1.5 rounded-lg p-2 ${isInbound ? "bg-gray-50" : "bg-blue-600/30"}`}>
                              <TypeIcon className="h-4 w-4" />
                              <span className="text-xs capitalize">{msg.type}</span>
                            </div>
                          )}
                          {msg.content && <p className="whitespace-pre-line text-sm">{msg.content}</p>}
                          <div className={`mt-1 flex items-center justify-end gap-1 ${isInbound ? "text-text-muted" : "text-blue-200"}`}>
                            <span className="text-[10px]">{formatMessageTime(msg.timestamp)}</span>
                            {!isInbound && <CheckCheck className="h-3 w-3" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply bar */}
            {replyTo && (
              <div className="flex items-center gap-3 border-t border-border bg-gray-50 px-4 py-2">
                <Reply className="h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-blue-500">
                    Replying to {replyTo.direction === "inbound" ? activeConv?.contact_name : "yourself"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="shrink-0 rounded p-1 text-text-muted hover:bg-gray-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="border-t border-border">
                <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" maxFrequentRows={1} perLine={8} />
              </div>
            )}

            {/* Message input */}
            <div className="border-t border-border bg-white p-3">
              <div className="flex items-center gap-2">
                <button className="shrink-0 rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-gray-50 px-4 py-2.5 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && messageInput.trim()) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`shrink-0 rounded-lg p-2 transition-colors ${showEmojiPicker ? "bg-gray-100 text-primary-light" : "text-text-secondary hover:bg-gray-100"}`}
                >
                  <Smile className="h-5 w-5" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#25D366" }}
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">Select a conversation to start</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel — Patient Info */}
      {showInfo && activeConv && <PatientInfoPanel conversation={activeConv} />}

      {/* Forward modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-border bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Forward message</h3>
              <button onClick={() => setForwardMsg(null)} className="rounded p-1 text-text-muted hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-text-secondary line-clamp-3">{forwardMsg.content}</p>
            </div>
            <p className="mt-3 text-xs font-medium text-text-muted">Select conversation:</p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {conversations.filter((c) => c.id !== selectedConvId).map((conv) => (
                <button key={conv.id} onClick={() => handleForward(forwardMsg, conv.id)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-gray-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                    {getInitials(conv.contact_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">{conv.contact_name}</p>
                    <p className="truncate text-[10px] text-text-muted">+{conv.contact_phone}</p>
                  </div>
                </button>
              ))}
              {conversations.filter((c) => c.id !== selectedConvId).length === 0 && (
                <p className="py-4 text-center text-xs text-text-muted">No other conversations</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIControlPanel({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useConversationAgents(conversationId);
  const setAgents = useSetConversationAgents(conversationId);

  if (isLoading || !data) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">AI Control</p>
        <p className="mt-1.5 text-[10px] text-text-muted">Loading…</p>
      </div>
    );
  }

  if (data.agents.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-text-muted" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">AI Control</p>
        </div>
        <p className="mt-1.5 text-[10px] text-text-muted">No agents configured for this clinic.</p>
      </div>
    );
  }

  const toggle = (personaId: string, turnOn: boolean) => {
    // Build next allowlist. If inheriting defaults, initialize from the
    // current effective set so the toggle doesn't silently flip others.
    const current = data.enabled_agents ?? data.agents
      .filter((a) => a.is_active_clinic)
      .map((a) => a.persona_id);
    let next = current.filter((p) => p !== personaId);
    if (turnOn) next = [...next, personaId];
    setAgents.mutate(next);
  };

  const resetToDefaults = () => setAgents.mutate(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-text-muted" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">AI Control</p>
        </div>
        {!data.inherits_clinic_defaults && (
          <button
            onClick={resetToDefaults}
            disabled={setAgents.isPending}
            className="text-[10px] font-medium text-primary-light hover:underline disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-text-muted">
        {data.inherits_clinic_defaults
          ? "Using clinic defaults"
          : "Custom for this chat"}
      </p>
      <div className="mt-1.5 space-y-1.5">
        {data.agents.map((a) => {
          const disabledAtClinic = !a.is_active_clinic;
          return (
            <div
              key={a.persona_id}
              className="flex items-center justify-between rounded-lg border border-border px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary">{a.persona_name}</p>
                <p className="truncate text-[10px] text-text-muted">
                  {a.functional_type.replace(/_/g, " ")}
                </p>
                {disabledAtClinic && (
                  <p className="text-[10px] text-amber-600">Off at clinic level</p>
                )}
              </div>
              <button
                role="switch"
                aria-checked={a.is_enabled_conversation}
                aria-label={`${a.persona_name} ${a.is_enabled_conversation ? "enabled" : "disabled"}`}
                disabled={disabledAtClinic || setAgents.isPending}
                onClick={() => toggle(a.persona_id, !a.is_enabled_conversation)}
                className={`relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.is_enabled_conversation ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    a.is_enabled_conversation ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamAssignmentPanel({ conversation }: { conversation: Conversation }) {
  const { data, isLoading } = useTeamMembers();
  const assignConversation = useAssignConversation(conversation.id);
  const members = data?.members ?? [];
  const assignedMember = members.find((member) => member.id === conversation.handled_by_user_id);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <UserCheck className="h-3 w-3 text-text-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Team Assignment</p>
      </div>
      <div className="mt-1.5">
        <select
          value={conversation.handled_by_user_id ?? ""}
          disabled={isLoading || assignConversation.isPending}
          onChange={(event) => assignConversation.mutate(event.target.value || null)}
          className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text-primary focus:border-primary-light focus:outline-none disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.role.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[10px] text-text-muted">
        {conversation.handled_by === "human"
          ? assignedMember
            ? `Human queue: ${assignedMember.name}`
            : "Human queue"
          : "AI is handling this chat"}
      </p>
    </div>
  );
}

function PatientInfoPanel({ conversation }: { conversation: Conversation }) {
  const { data: patient } = usePatient(conversation.patient_id || "");

  const today = new Date().toISOString().split("T")[0];
  const { data: aptsData } = useAppointments(
    { patient_search: patient?.phone, date_from: today, page_size: 3 },
    { enabled: !!patient },
  );
  const appointments = aptsData?.appointments || [];

  const { data: dealsData } = useDeals(
    { patient_id: patient?.id },
    { enabled: !!patient },
  );
  const deals = dealsData?.deals?.slice(0, 2) || [];

  return (
    <div className="w-[280px] shrink-0 overflow-y-auto border-l border-border p-4">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
          {getInitials(conversation.contact_name)}
        </div>
        <h3 className="mt-3 text-sm font-bold text-text-primary">
          {patient ? `${patient.first_name} ${patient.last_name}` : conversation.contact_name}
        </h3>
        <p className="text-xs text-text-muted">+{conversation.contact_phone}</p>
      </div>

      <div className="mt-6 space-y-4">
        <TeamAssignmentPanel conversation={conversation} />
        <AIControlPanel conversationId={conversation.id} />
        {patient ? (
          <>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Status</p>
              <div className="mt-1"><StatusBadge status={patient.status} dot /></div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Details</p>
              <div className="mt-1.5 space-y-2">
                {patient.email && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Mail className="h-3.5 w-3.5 text-text-muted" />{patient.email}
                  </div>
                )}
                {(patient.city || patient.country) && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <MapPin className="h-3.5 w-3.5 text-text-muted" />{[patient.city, patient.country].filter(Boolean).join(", ")}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Star className="h-3.5 w-3.5 text-text-muted" />Lead Score: {patient.lead_score}
                </div>
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Appointments</p>
                <Link href={`/appointments/new?patient_id=${patient.id}`} className="text-[10px] font-medium text-primary-light hover:underline">
                  Book
                </Link>
              </div>
              {appointments.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="rounded-lg border border-border p-2">
                      <p className="text-xs font-medium text-text-primary">{apt.treatment}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-muted">
                        <Calendar className="h-3 w-3" />
                        {new Date(apt.appointment_date).toLocaleDateString()} {apt.start_time?.slice(0, 5)}
                      </div>
                      {apt.doctor_name && (
                        <p className="text-[10px] text-text-muted">{apt.doctor_name}</p>
                      )}
                      <StatusBadge status={apt.status} dot />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-text-muted">No upcoming appointments</p>
              )}
            </div>

            {/* Active Deals */}
            {deals.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Deals</p>
                <div className="mt-1.5 space-y-1.5">
                  {deals.map((deal) => (
                    <div key={deal.id} className="rounded-lg border border-border p-2">
                      <p className="text-xs font-medium text-text-primary">{deal.title}</p>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">{deal.pipeline_stage}</span>
                        {deal.value > 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {deal.currency} {deal.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patient.tags && patient.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Tags</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {patient.tags.map((tag) => (
                    <span key={tag.id} className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">{tag.tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <Link href={`/patients/${patient.id}`} className="block w-full rounded-lg border border-border bg-white py-2 text-center text-xs font-medium text-text-primary transition-colors hover:bg-gray-50">
                View Full Profile
              </Link>
              <Link
                href={`/appointments/new?patient_id=${patient.id}`}
                className="block w-full rounded-lg py-2 text-center text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                Book Appointment
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-xs text-text-muted">
              {conversation.patient_id ? "Loading patient info..." : "Not linked to a patient"}
            </p>
            {!conversation.patient_id && (
              <p className="mt-1 text-[10px] text-text-muted">Link this contact to a patient in the system</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
