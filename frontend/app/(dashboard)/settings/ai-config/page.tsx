"use client";

import { useState } from "react";
import {
  Loader2,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Save,
} from "lucide-react";
import {
  useProviders,
  useSetProviderCredential,
  type AIProvider,
  type ProviderStatus,
} from "@/lib/api/ai-agents";

const PROVIDER_LABELS: Record<AIProvider, { name: string; help: string }> = {
  openai: {
    name: "OpenAI (ChatGPT)",
    help: "Enter an API key from platform.openai.com. Supports GPT-4o, GPT-4o-mini, GPT-4.1.",
  },
  google_gemini: {
    name: "Google Gemini",
    help: "Enter an API key from aistudio.google.com. Supports Gemini 2.5 Flash/Pro.",
  },
};

export default function AIConfigurationPage() {
  const { data, isLoading, isError } = useProviders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load AI providers.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">AI Configuration</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Configure API keys for the AI providers that power your agents. Keys are
          encrypted at rest.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {data.providers.map((p) => (
          <ProviderCard key={p.provider} provider={p} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const label = PROVIDER_LABELS[provider.provider];
  const setCredential = useSetProviderCredential();
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(provider.is_active);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await setCredential.mutateAsync({
      provider: provider.provider,
      apiKey,
      isActive,
    });
    setApiKey("");
    setSavedAt(new Date());
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <KeyRound className="h-5 w-5 text-text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">{label.name}</h3>
            <p className="text-xs text-text-muted">{label.help}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {provider.is_configured ? (
            <>
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-medium text-emerald-600">
                Configured
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[11px] font-medium text-text-muted">
                Not set
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">
            {provider.is_configured
              ? "Replace API key"
              : "API key"}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="rounded-lg border border-border px-3 py-2 text-sm font-mono"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (available for agents to use)
        </label>

        <button
          onClick={handleSave}
          disabled={setCredential.isPending || !apiKey.trim()}
          translate="no"
          className="notranslate flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            {setCredential.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </span>
          <span>Save</span>
        </button>

        {savedAt && (
          <p className="text-[11px] text-emerald-600">
            Saved {savedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
