"use client";

import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle,
  DollarSign,
  GitBranch,
  Heart,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Network,
  Route,
  ShieldCheck,
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAgents, useUpdateAgent, type AgentListItem } from "@/lib/api/ai-agents";

type SyncStatus = "orchestrated" | "supporting" | "planned";

interface PersonaMeta {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
  stage: string;
  tasks: string[];
  syncStatus: SyncStatus;
}

const PERSONA_ORDER = ["rafiq", "layla", "omar", "sara", "noor", "dr-ai", "zain", "salma"];

const PERSONA_META: Record<string, PersonaMeta> = {
  rafiq: {
    icon: Route,
    color: "#14B8A6",
    bgColor: "#F0FDFA",
    description: "Routes inbound WhatsApp messages to the right specialist or human queue.",
    stage: "Router",
    tasks: ["message_routed", "human_escalation", "no_reply_skip"],
    syncStatus: "orchestrated",
  },
  layla: {
    icon: MessageSquare,
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    description: "Scores leads and writes qualification data back to CRM context.",
    stage: "Qualification",
    tasks: ["qualify_lead", "lead_scored", "crm_sync"],
    syncStatus: "orchestrated",
  },
  omar: {
    icon: DollarSign,
    color: "#10B981",
    bgColor: "#ECFDF5",
    description: "Generates and sends sales replies for pricing, objections, and booking intent.",
    stage: "Sales Reply",
    tasks: ["generate_response", "send_message", "rate_limit"],
    syncStatus: "orchestrated",
  },
  sara: {
    icon: Calendar,
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
    description: "Handles appointment intent, rescheduling, confirmations, reminders, and no-shows.",
    stage: "Appointments",
    tasks: ["reschedule_appointment", "send_reminder", "send_message"],
    syncStatus: "orchestrated",
  },
  noor: {
    icon: Heart,
    color: "#EC4899",
    bgColor: "#FDF2F8",
    description: "Re-engages quiet leads and continues follow-up conversations.",
    stage: "Follow-up",
    tasks: ["check_reply", "schedule_followup", "send_message"],
    syncStatus: "orchestrated",
  },
  "dr-ai": {
    icon: Stethoscope,
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    description: "Clinical-safe personalization layer for procedure-aware context.",
    stage: "Personalization",
    tasks: ["safe_context", "procedure_tone", "human_escalation"],
    syncStatus: "supporting",
  },
  zain: {
    icon: Megaphone,
    color: "#EF4444",
    bgColor: "#FEF2F2",
    description: "Links won deals and conversion events to marketing source context.",
    stage: "Attribution",
    tasks: ["attribute_conversion", "source_confidence", "event_log"],
    syncStatus: "orchestrated",
  },
  salma: {
    icon: TrendingDown,
    color: "#6366F1",
    bgColor: "#EEF2FF",
    description: "Detects funnel drop-offs and flags recovery opportunities.",
    stage: "Drop-off",
    tasks: ["detect_dropoff", "recovery_signal", "planned"],
    syncStatus: "planned",
  },
};

function metaFor(agent: AgentListItem): PersonaMeta {
  return (
    PERSONA_META[agent.persona_id] ?? {
      icon: Bot,
      color: "#6B7280",
      bgColor: "#F3F4F6",
      description: agent.role_description || "AI agent",
      stage: agent.functional_type.replace(/_/g, " "),
      tasks: [agent.functional_type.replace(/_/g, " ")],
      syncStatus: "supporting",
    }
  );
}

function formatResponseTime(ms: number): string {
  if (!ms) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function syncLabel(status: SyncStatus) {
  if (status === "orchestrated") return "Orchestrated";
  if (status === "supporting") return "Context layer";
  return "Planned";
}

export default function AIAgentsPage() {
  const { data, isLoading, isError, error } = useAgents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load agents: {(error as Error)?.message || "unknown error"}
      </div>
    );
  }

  const agents = [...(data?.agents ?? [])].sort((a, b) => {
    const aIndex = PERSONA_ORDER.indexOf(a.persona_id);
    const bIndex = PERSONA_ORDER.indexOf(b.persona_id);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
  const activeCount = agents.filter((a) => a.is_active).length;
  const orchestratedActive = agents.filter((a) => a.is_active && metaFor(a).syncStatus === "orchestrated").length;
  const totalConversations = agents.reduce((s, a) => s + (a.stats?.conversations_today ?? 0), 0);
  const totalMessages = agents.reduce((s, a) => s + (a.stats?.messages_sent_today ?? 0), 0);
  const avgResponseMs =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + (a.stats?.avg_response_time_ms ?? 0), 0) / agents.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Orchestration</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {activeCount} active agents, {orchestratedActive} wired into workflows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ai-agents/conversations"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
          >
            <MessageSquare className="h-4 w-4" />
            Conversations
          </Link>
          <Link
            href="/analytics/agents"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            <Activity className="h-4 w-4" />
            Performance
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <TopStat label="Orchestrated" value={`${orchestratedActive}/${agents.length}`} icon={Network} color="#14B8A6" />
        <TopStat label="Conversations" value={totalConversations.toLocaleString()} icon={MessageCircle} color="#3B82F6" />
        <TopStat label="Messages" value={totalMessages.toLocaleString()} icon={TrendingUp} color="#10B981" />
        <TopStat label="Avg Response" value={formatResponseTime(avgResponseMs)} icon={Zap} color="#F59E0B" />
      </div>

      <OrchestrationMap agents={agents} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function TopStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-lg font-bold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function OrchestrationMap({ agents }: { agents: AgentListItem[] }) {
  const byPersona = new Map(agents.map((agent) => [agent.persona_id, agent]));
  const steps = [
    { title: "Intake Router", personas: ["rafiq"], icon: Route },
    { title: "Lead Understanding", personas: ["layla", "dr-ai"], icon: GitBranch },
    { title: "Specialist Response", personas: ["omar", "sara", "noor"], icon: MessageSquare },
    { title: "Growth Intelligence", personas: ["zain", "salma"], icon: ShieldCheck },
  ];

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Workflow Map</h2>
          <p className="mt-0.5 text-xs text-text-muted">WhatsApp inbound to router to task chain to send or human handoff</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-700">
          Live orchestration
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                  <Icon className="h-4 w-4 text-text-secondary" />
                </div>
                <p className="text-xs font-semibold text-text-primary">{step.title}</p>
              </div>
              <div className="mt-3 space-y-2">
                {step.personas.map((persona) => {
                  const agent = byPersona.get(persona);
                  const meta = agent ? metaFor(agent) : PERSONA_META[persona];
                  return (
                    <div key={persona} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-text-secondary">{agent?.display_name ?? meta.stage}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          agent?.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-text-muted"
                        }`}
                      >
                        {agent?.is_active ? "Active" : "Off"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentListItem }) {
  const meta = metaFor(agent);
  const Icon = meta.icon;
  const updateMutation = useUpdateAgent(agent.id);

  const toggle = () => {
    updateMutation.mutate({ is_active: !agent.is_active });
  };

  return (
    <div className={`rounded-lg border bg-white p-5 transition-shadow hover:shadow-sm ${agent.is_active ? "border-border" : "border-border opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: meta.bgColor }}>
            <Icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-text-primary">{agent.display_name}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  meta.syncStatus === "orchestrated"
                    ? "bg-emerald-50 text-emerald-700"
                    : meta.syncStatus === "supporting"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-text-muted"
                }`}
              >
                {syncLabel(meta.syncStatus)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{meta.stage}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={updateMutation.isPending}
          className="transition-colors disabled:opacity-50"
          aria-label={agent.is_active ? "Disable agent" : "Enable agent"}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          ) : agent.is_active ? (
            <ToggleRight className="h-6 w-6" style={{ color: "#10B981" }} />
          ) : (
            <ToggleLeft className="h-6 w-6 text-gray-300" />
          )}
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-secondary">{meta.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {meta.tasks.map((task) => (
          <span key={task} className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-medium text-text-secondary">
            {task.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatBox label="Conversations" value={(agent.stats?.conversations_today ?? 0).toString()} />
        <StatBox label="Messages" value={(agent.stats?.messages_sent_today ?? 0).toString()} />
        <StatBox label="Threshold" value={`${agent.confidence_threshold}%`} />
        <StatBox label="Rate Limit" value={`${agent.rate_limit_messages}/day`} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          {agent.is_active ? (
            <>
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-600">Active</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[10px] font-medium text-text-muted">Inactive</span>
            </>
          )}
        </div>
        <Link
          href={`/ai-agents/${agent.id}/config`}
          className="flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--primary-light)" }}
        >
          Configure <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="text-sm font-bold text-text-primary">{value}</p>
    </div>
  );
}
