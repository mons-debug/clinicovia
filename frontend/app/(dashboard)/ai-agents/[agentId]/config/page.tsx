"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Play,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  useAgent,
  useUpdateAgent,
  useTestAgent,
  type AgentUpdatePayload,
  type AgentLanguage,
  type AgentTone,
  type AIProvider,
} from "@/lib/api/ai-agents";

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ["gpt-5.4-mini-2026-03-17", "gpt-5.4-2026-03-17"],
  google_gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
};

type FormState = AgentUpdatePayload;

export default function AgentConfigPage(props: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(props.params);
  const { data: agent, isLoading, isError } = useAgent(agentId);
  const updateMutation = useUpdateAgent(agentId);
  const testMutation = useTestAgent(agentId);

  const [form, setForm] = useState<FormState>({});
  const [testMessage, setTestMessage] = useState(
    "Hi, I want to know about hair transplant prices",
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (agent) {
      setForm({
        is_active: agent.is_active,
        ai_provider: agent.ai_provider,
        ai_model: agent.ai_model,
        language: agent.language,
        tone: agent.tone,
        system_prompt: agent.system_prompt ?? "",
        manual_context: agent.manual_context ?? "",
        memory_notes: agent.memory_notes ?? "",
        skill_instructions: agent.skill_instructions ?? "",
        confidence_threshold: agent.confidence_threshold,
        max_followup_attempts: agent.max_followup_attempts,
        followup_delay_minutes: agent.followup_delay_minutes,
        reactivation_delay_hours: agent.reactivation_delay_hours,
        rate_limit_messages: agent.rate_limit_messages,
      });
    }
  }, [agent]);

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
        Failed to load agent configuration.
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(form);
    setSavedAt(new Date());
  };

  const handleTest = () => {
    testMutation.mutate({ testMessage });
  };

  const availableModels = form.ai_provider
    ? PROVIDER_MODELS[form.ai_provider]
    : PROVIDER_MODELS.openai;

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
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </button>
      </div>

      {savedAt && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5" />
          Saved {savedAt.toLocaleTimeString()}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main config column */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="Provider">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    update("is_active", e.target.value === "active")
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <Field label="AI Provider">
                <select
                  value={form.ai_provider || "openai"}
                  onChange={(e) => {
                    const provider = e.target.value as AIProvider;
                    update("ai_provider", provider);
                    update("ai_model", PROVIDER_MODELS[provider][0]);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="google_gemini">Google Gemini</option>
                </select>
              </Field>
              <Field label="Model">
                <select
                  value={form.ai_model || ""}
                  onChange={(e) => update("ai_model", e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select
                  value={form.language || "en"}
                  onChange={(e) =>
                    update("language", e.target.value as AgentLanguage)
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </Field>
              <Field label="Tone">
                <select
                  value={form.tone || "professional"}
                  onChange={(e) =>
                    update("tone", e.target.value as AgentTone)
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Prompt">
            <Field label="System prompt (optional override)">
              <textarea
                value={form.system_prompt || ""}
                onChange={(e) => update("system_prompt", e.target.value)}
                placeholder="Leave blank to use the default prompt for this agent type."
                rows={6}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Manual context">
              <textarea
                value={form.manual_context || ""}
                onChange={(e) => update("manual_context", e.target.value)}
                placeholder="Clinic-specific context injected into every prompt (services, pricing, policies)."
                rows={4}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Memory notes">
              <textarea
                value={form.memory_notes || ""}
                onChange={(e) => update("memory_notes", e.target.value)}
                placeholder="Persistent notes to guide agent behavior."
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Skill instructions">
              <textarea
                value={form.skill_instructions || ""}
                onChange={(e) => update("skill_instructions", e.target.value)}
                placeholder="Specific behaviors, e.g. 'When pricing is asked, share ranges only.'"
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </Field>
          </Card>

          <Card title="Behavior limits">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Confidence threshold (0-100)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.confidence_threshold ?? 70}
                  onChange={(e) =>
                    update("confidence_threshold", Number(e.target.value))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Max follow-up attempts">
                <input
                  type="number"
                  min={0}
                  value={form.max_followup_attempts ?? 3}
                  onChange={(e) =>
                    update("max_followup_attempts", Number(e.target.value))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Follow-up delay (minutes)">
                <input
                  type="number"
                  min={1}
                  value={form.followup_delay_minutes ?? 30}
                  onChange={(e) =>
                    update("followup_delay_minutes", Number(e.target.value))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Reactivation delay (hours)">
                <input
                  type="number"
                  min={1}
                  value={form.reactivation_delay_hours ?? 24}
                  onChange={(e) =>
                    update("reactivation_delay_hours", Number(e.target.value))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Rate limit (messages/day/lead)">
                <input
                  type="number"
                  min={1}
                  value={form.rate_limit_messages ?? 10}
                  onChange={(e) =>
                    update("rate_limit_messages", Number(e.target.value))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* Sandbox column */}
        <div className="space-y-5">
          <Card title="Test agent">
            <p className="mb-3 text-xs text-text-muted">
              Send a sample lead message to preview the agent&apos;s response.
              No real messages are sent.
            </p>
            <Field label="Sample message">
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </Field>
            <button
              onClick={handleTest}
              disabled={testMutation.isPending || !testMessage.trim()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run test
            </button>

            {testMutation.data && (
              <div className="mt-4 space-y-3 text-xs">
                {testMutation.data.qualification && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="font-semibold text-text-primary">
                      Qualification
                    </p>
                    <p className="mt-1 text-text-secondary">
                      Score: {testMutation.data.qualification.score ?? "—"}/100
                    </p>
                    <p className="text-text-secondary">
                      Intent: {testMutation.data.qualification.intent ?? "—"}
                    </p>
                    <p className="text-text-secondary">
                      Service: {testMutation.data.qualification.service ?? "—"}
                    </p>
                    <p className="text-text-secondary">
                      Urgency: {testMutation.data.qualification.urgency ?? "—"}
                    </p>
                  </div>
                )}
                {testMutation.data.generated_response && (
                  <div className="rounded-lg border border-border bg-white p-3">
                    <p className="font-semibold text-text-primary">
                      Generated response
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                      {testMutation.data.generated_response}
                    </p>
                  </div>
                )}
                <p className="text-text-muted">
                  Provider: {testMutation.data.ai_provider} ·{" "}
                  {testMutation.data.ai_model} · tokens{" "}
                  {testMutation.data.token_count.input}/
                  {testMutation.data.token_count.output}
                  {testMutation.data.confidence != null &&
                    ` · confidence ${Math.round(testMutation.data.confidence * 100)}%`}
                </p>
              </div>
            )}

            {testMutation.isError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {(testMutation.error as Error)?.message ||
                    "Test run failed. Check that provider credentials are configured."}
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h2 className="mb-4 text-sm font-bold text-text-primary">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}
