"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  useDashboardStats,
  useDashboardActivity,
  useDashboardWorkflows,
  type DashboardPeriod,
  type ActivityItem,
  type WorkflowItem,
} from "@/lib/api/ai-agents";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function AgentAnalyticsPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const statsQuery = useDashboardStats(period);
  const activityQuery = useDashboardActivity({ limit: 20 });
  const workflowsQuery = useDashboardWorkflows({ limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Orchestration Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            AI agent activity, workflows, and conversion performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.value
                  ? "text-white"
                  : "border border-border bg-white text-text-secondary hover:bg-gray-50"
              }`}
              style={
                period === p.value
                  ? { backgroundColor: "var(--primary-light)" }
                  : undefined
              }
            >
              {p.label}
            </button>
          ))}
          <Link
            href="/ai-agents/conversations"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-gray-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Conversations
          </Link>
        </div>
      </div>

      <StatsGrid query={statsQuery} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-white">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-bold text-text-primary">
                Live Activity
              </h2>
            </div>
            <span className="text-[11px] text-text-muted">
              {activityQuery.data?.total ?? 0} events
            </span>
          </header>
          <ActivityFeed query={activityQuery} />
        </section>

        <section className="rounded-xl border border-border bg-white">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-bold text-text-primary">Workflows</h2>
            </div>
            <span className="text-[11px] text-text-muted">
              {workflowsQuery.data?.total ?? 0} total
            </span>
          </header>
          <WorkflowList query={workflowsQuery} />
        </section>
      </div>
    </div>
  );
}

// ── Stats ──

interface StatConfig {
  key: keyof NonNullable<ReturnType<typeof useDashboardStats>["data"]>;
  label: string;
  icon: LucideIcon;
  color: string;
  format?: (v: number) => string;
}

const STAT_CARDS: StatConfig[] = [
  {
    key: "leads_qualified",
    label: "Leads Qualified",
    icon: Target,
    color: "#3B82F6",
  },
  {
    key: "messages_sent",
    label: "Messages Sent",
    icon: MessageSquare,
    color: "#10B981",
  },
  {
    key: "conversations_active",
    label: "Active Conversations",
    icon: Users,
    color: "#8B5CF6",
  },
  {
    key: "appointments_booked",
    label: "Appointments Booked",
    icon: CheckCircle2,
    color: "#F59E0B",
  },
  {
    key: "followups_sent",
    label: "Follow-Ups Sent",
    icon: RefreshCcw,
    color: "#EC4899",
  },
  {
    key: "escalated_to_human",
    label: "Escalated to Human",
    icon: Users,
    color: "#EF4444",
  },
  {
    key: "workflows_completed",
    label: "Workflows Completed",
    icon: TrendingUp,
    color: "#059669",
  },
  {
    key: "conversion_rate",
    label: "Conversion Rate",
    icon: Zap,
    color: "#6366F1",
    format: (v) => `${Math.round(v * 100)}%`,
  },
];

function StatsGrid({
  query,
}: {
  query: ReturnType<typeof useDashboardStats>;
}) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-white py-16">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Failed to load stats: {(query.error as Error)?.message}
      </div>
    );
  }
  const stats = query.data;
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STAT_CARDS.map((s) => {
        const raw = stats[s.key] as number;
        const value = s.format ? s.format(raw) : raw.toLocaleString();
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className="rounded-xl border border-border bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${s.color}15` }}
              >
                <Icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="mt-3 text-xl font-bold text-text-primary">{value}</p>
            <p className="text-[11px] text-text-muted">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity ──

function ActivityFeed({
  query,
}: {
  query: ReturnType<typeof useDashboardActivity>;
}) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="p-5 text-sm text-red-600">
        {(query.error as Error)?.message}
      </div>
    );
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <Activity className="mx-auto h-8 w-8 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">No activity yet</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString();
}

const EVENT_LABEL: Record<string, string> = {
  lead_scored: "Lead qualified",
  message_generated: "Message generated",
  message_sent: "Message sent",
  followup_scheduled: "Follow-up scheduled",
  followup_sent: "Follow-up sent",
  reactivation_sent: "Reactivation sent",
  reminder_sent: "Reminder sent",
  appointment_rescheduled: "Appointment rescheduled",
  human_takeover: "Human takeover",
  human_release: "Released to AI",
  opt_out_detected: "Opt-out detected",
  escalated_to_human: "Escalated to human",
  task_failed: "Task failed",
  attribution_linked: "Attribution linked",
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const label = EVENT_LABEL[item.event_type] ?? item.event_type;
  const preview =
    (item.event_data?.message_preview as string | undefined) ??
    (item.event_data?.preview as string | undefined) ??
    null;

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <Bot className="h-4 w-4 text-text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-text-primary">{label}</p>
          {item.agent_display_name && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-text-secondary">
              {item.agent_display_name}
            </span>
          )}
          {item.patient_name && (
            <span className="text-[10px] text-text-muted">
              → {item.patient_name}
            </span>
          )}
        </div>
        {preview && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
            {preview}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-text-muted">
        <Clock className="mr-1 inline h-3 w-3" />
        {formatRelative(item.created_at)}
      </span>
    </li>
  );
}

// ── Workflows ──

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#F3F4F6", color: "#6B7280" },
  running: { bg: "#EFF6FF", color: "#3B82F6" },
  completed: { bg: "#ECFDF5", color: "#059669" },
  failed: { bg: "#FEF2F2", color: "#DC2626" },
  paused: { bg: "#FFFBEB", color: "#D97706" },
  cancelled: { bg: "#F3F4F6", color: "#6B7280" },
};

function WorkflowList({
  query,
}: {
  query: ReturnType<typeof useDashboardWorkflows>;
}) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="p-5 text-sm text-red-600">
        {(query.error as Error)?.message}
      </div>
    );
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <RefreshCcw className="mx-auto h-8 w-8 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">No workflows yet</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((wf) => (
        <WorkflowRow key={wf.id} workflow={wf} />
      ))}
    </ul>
  );
}

function WorkflowRow({ workflow }: { workflow: WorkflowItem }) {
  const style = STATUS_STYLE[workflow.status] ?? STATUS_STYLE.pending;
  const duration =
    workflow.duration_ms != null
      ? workflow.duration_ms < 1000
        ? `${workflow.duration_ms}ms`
        : `${(workflow.duration_ms / 1000).toFixed(1)}s`
      : "--";

  return (
    <li className="px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-text-primary">
              {workflow.trigger_type.replace(/_/g, " ")}
            </p>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {workflow.status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {workflow.patient_name ? `${workflow.patient_name} • ` : ""}
            {workflow.goal}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold text-text-primary">
            {workflow.tasks_completed}/{workflow.tasks_total}
          </p>
          <p className="text-[10px] text-text-muted">
            {workflow.tasks_failed > 0 && (
              <span className="mr-1 inline-flex items-center gap-0.5 text-red-500">
                <XCircle className="h-3 w-3" />
                {workflow.tasks_failed}
              </span>
            )}
            {duration}
          </p>
        </div>
      </div>
    </li>
  );
}
