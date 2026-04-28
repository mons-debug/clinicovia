"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { useAgent } from "@/lib/api/ai-agents";

export default function AgentDetailPage(props: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(props.params);
  const { data: agent, isLoading, isError } = useAgent(agentId);

  if (isLoading || !agent) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load agent.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/ai-agents"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to agents
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">
            {agent.display_name}
          </h1>
          <p className="text-sm text-text-secondary">
            {agent.role_description || agent.functional_type.replace(/_/g, " ")}
          </p>
        </div>
        <Link
          href={`/ai-agents/${agent.id}/config`}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" />
          Configure
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <InfoCard label="Status" value={agent.is_active ? "Active" : "Inactive"} />
        <InfoCard label="Provider" value={`${agent.ai_provider} · ${agent.ai_model}`} />
        <InfoCard label="Language" value={agent.language.toUpperCase()} />
        <InfoCard
          label="Confidence threshold"
          value={`${agent.confidence_threshold}%`}
        />
        <InfoCard
          label="Rate limit"
          value={`${agent.rate_limit_messages} msgs/day/lead`}
        />
        <InfoCard
          label="Follow-up cadence"
          value={`${agent.max_followup_attempts} attempts · ${agent.followup_delay_minutes}m delay`}
        />
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-text-primary">
          Activity
        </h2>
        <p className="text-xs text-text-muted">
          Detailed activity log and recent qualification results will appear on the
          Orchestration Dashboard.
        </p>
        <Link
          href="/analytics/agents"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: "var(--primary-light)" }}
        >
          Open orchestration dashboard →
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
