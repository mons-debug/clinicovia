"use client";

import { useState } from "react";
import {
  Loader2,
  MessageSquare,
  Bot,
  User as UserIcon,
  Hand,
  Play,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  useAIConversations,
  useTakeoverConversation,
  useReleaseConversation,
  type AIConversation,
} from "@/lib/api/ai-agents";
import { useAssignConversation, useTeamMembers, type TeamMember } from "@/lib/api/whatsapp";

type HandledByFilter = "all" | "ai" | "human" | "paused";

const FILTERS: { value: HandledByFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI handled" },
  { value: "human", label: "Human takeover" },
  { value: "paused", label: "Paused" },
];

export default function AgentConversationsPage() {
  const [filter, setFilter] = useState<HandledByFilter>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useAIConversations({
    handledBy: filter === "all" ? undefined : filter,
    limit: 100,
  });
  const { data: teamData } = useTeamMembers();
  const members = teamData?.members ?? [];

  const conversations = (data?.items ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.contact_name.toLowerCase().includes(q) ||
      c.contact_phone.toLowerCase().includes(q) ||
      (c.patient_name ?? "").toLowerCase().includes(q) ||
      (c.lead_intent ?? "").toLowerCase().includes(q) ||
      (c.lead_service ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Agent Conversations
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Monitor AI-handled conversations and take over when needed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary">
            {data?.total ?? 0} total
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary-light text-white"
                  : "border border-border bg-white text-text-secondary hover:bg-gray-50"
              }`}
              style={
                filter === f.value
                  ? { backgroundColor: "var(--primary-light)" }
                  : undefined
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, intent..."
            className="w-full rounded-lg border border-border bg-white pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-light focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Failed to load conversations: {(error as Error)?.message}
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No conversations match this filter
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Inbound WhatsApp messages will appear here once agents are active.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} members={members} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  members,
}: {
  conversation: AIConversation;
  members: TeamMember[];
}) {
  const takeover = useTakeoverConversation();
  const release = useReleaseConversation();
  const assign = useAssignConversation(conversation.id);
  const assignedMember = members.find((member) => member.id === conversation.handled_by_user_id);

  const isHuman = conversation.handled_by === "human";
  const isPaused = conversation.handled_by === "paused";

  const formatTime = (iso: string | null) => {
    if (!iso) return "--";
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: isHuman ? "#EEF2FF" : isPaused ? "#FEF3C7" : "#ECFDF5",
        }}
      >
        {isHuman ? (
          <UserIcon className="h-5 w-5" style={{ color: "#6366F1" }} />
        ) : isPaused ? (
          <AlertCircle className="h-5 w-5" style={{ color: "#D97706" }} />
        ) : (
          <Bot className="h-5 w-5" style={{ color: "#10B981" }} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-text-primary">
            {conversation.patient_name ||
              conversation.contact_name ||
              conversation.contact_phone}
          </p>
          {conversation.unread_count > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {conversation.unread_count}
            </span>
          )}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: isHuman
                ? "#EEF2FF"
                : isPaused
                  ? "#FEF3C7"
                  : "#ECFDF5",
              color: isHuman ? "#4F46E5" : isPaused ? "#92400E" : "#047857",
            }}
          >
            {conversation.handled_by.toUpperCase()}
          </span>
          {conversation.ai_opt_out && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              OPT-OUT
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {conversation.last_message || "(no messages yet)"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
          <span>{conversation.contact_phone}</span>
          <span>•</span>
          <span>{formatTime(conversation.last_message_at)}</span>
          {conversation.lead_score != null && (
            <>
              <span>•</span>
              <span>
                Score:{" "}
                <strong className="text-text-primary">
                  {conversation.lead_score}
                </strong>
              </span>
            </>
          )}
          {conversation.lead_intent && (
            <>
              <span>•</span>
              <span>Intent: {conversation.lead_intent}</span>
            </>
          )}
          {conversation.lead_service && (
            <>
              <span>•</span>
              <span>Service: {conversation.lead_service}</span>
            </>
          )}
          {assignedMember && (
            <>
              <span>•</span>
              <span>Assigned: {assignedMember.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={conversation.handled_by_user_id ?? ""}
          onChange={(event) => assign.mutate(event.target.value || null)}
          disabled={assign.isPending}
          className="h-8 w-40 rounded-lg border border-border bg-white px-2 text-xs text-text-primary focus:border-primary-light focus:outline-none disabled:opacity-50"
          title="Assign team member"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        {isHuman ? (
          <button
            onClick={() => release.mutate(conversation.id)}
            disabled={release.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {release.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Release to AI
          </button>
        ) : (
          <button
            onClick={() => takeover.mutate(conversation.id)}
            disabled={takeover.isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            {takeover.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Hand className="h-3.5 w-3.5" />
            )}
            Take over
          </button>
        )}
      </div>
    </div>
  );
}
