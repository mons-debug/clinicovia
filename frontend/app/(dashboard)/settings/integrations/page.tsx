"use client";

import { useState } from "react";
import {
  Plug,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  BarChart3,
  Tag,
  Target,
  Zap,
  Ghost,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import {
  useIntegrations,
  useUpsertIntegration,
  useDeleteIntegration,
  useMappings,
  useBulkUpdateMappings,
  useResetMappings,
  PLATFORM_CONFIG,
  type EventMapping,
} from "@/lib/api/tracking";

export default function IntegrationsPage() {
  const { data, isLoading } = useIntegrations();
  const integrations = data?.integrations || [];
  const upsertMutation = useUpsertIntegration();
  const deleteMutation = useDeleteIntegration();

  const [editPlatform, setEditPlatform] = useState<string | null>(null);

  const PLATFORM_ICONS: Record<string, typeof Plug> = {
    meta: Target,
    google_ads: Zap,
    ga4: BarChart3,
    gtm: Tag,
    snapchat: Ghost,
    tiktok: Music,
  };

  const platforms = Object.entries(PLATFORM_CONFIG);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Connect your ad platforms to track conversions from WhatsApp and pipeline activity
        </p>
      </div>

      {/* Platform cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map(([key, config]) => {
            const integration = integrations.find((i) => i.platform === key);
            const isConnected = integration?.is_enabled && integration?.has_credentials;

            return (
              <div
                key={key}
                className="rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${config.color}15` }}
                    >
                      {(() => { const Icon = PLATFORM_ICONS[key] || Plug; return <Icon className="h-5 w-5" style={{ color: config.color }} />; })()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{config.label}</h3>
                      <p className="text-[10px] text-text-muted">
                        {config.fields.length} credential{config.fields.length > 1 ? "s" : ""} required
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isConnected
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-gray-400"}`} />
                    {isConnected ? "Active" : "Not Connected"}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setEditPlatform(key)}
                    className="flex-1 rounded-lg border border-border bg-white py-2 text-center text-xs font-medium text-text-primary transition-colors hover:bg-gray-50"
                  >
                    {isConnected ? "Edit" : "Connect"}
                  </button>
                  {isConnected && (
                    <button
                      onClick={async () => {
                        try {
                          await deleteMutation.mutateAsync(key);
                          toast.success(`${config.label} disconnected`);
                        } catch {
                          toast.error("Failed to disconnect");
                        }
                      }}
                      className="rounded-lg border border-border bg-white p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editPlatform && (
        <PlatformEditModal
          platform={editPlatform}
          config={PLATFORM_CONFIG[editPlatform]}
          onClose={() => setEditPlatform(null)}
        />
      )}

      {/* Event Mappings Section */}
      <EventMappingsSection />
    </div>
  );
}

function PlatformEditModal({
  platform,
  config,
  onClose,
}: {
  platform: string;
  config: (typeof PLATFORM_CONFIG)[string];
  onClose: () => void;
}) {
  const upsertMutation = useUpsertIntegration();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    const hasValues = config.fields.some((f) => credentials[f.key]?.trim());
    if (!hasValues) {
      toast.error("Please fill in at least one credential field");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        platform,
        data: { is_enabled: enabled, credentials },
      });
      toast.success(`${config.label} saved`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${config.color}15` }}>
              <Plug className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">{config.label}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">{field.label}</label>
              <div className="relative">
                <input
                  type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                  placeholder={`Enter ${field.label}`}
                  className="w-full rounded-lg border border-border bg-white py-2.5 px-3 pr-10 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showSecrets[field.key] })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-gray-300"}`}
            >
              <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className="text-xs font-medium text-text-primary">Enable tracking</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            {upsertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EventMappingsSection() {
  const { data, isLoading } = useMappings();
  const mappings = data?.mappings || [];
  const bulkUpdate = useBulkUpdateMappings();
  const resetMut = useResetMappings();
  const [editMappings, setEditMappings] = useState<EventMapping[] | null>(null);

  const activeMappings = editMappings || mappings;

  const handleFieldChange = (idx: number, field: keyof EventMapping, value: string | boolean) => {
    const updated = [...activeMappings];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditMappings(updated);
  };

  const handleSave = async () => {
    if (!editMappings) return;
    try {
      await bulkUpdate.mutateAsync(
        editMappings.map((m) => ({
          pipeline_stage: m.pipeline_stage,
          event_name: m.event_name,
          include_value: m.include_value,
          is_active: m.is_active,
        }))
      );
      setEditMappings(null);
      toast.success("Event mappings saved");
    } catch {
      toast.error("Failed to save mappings");
    }
  };

  const handleReset = async () => {
    try {
      await resetMut.mutateAsync();
      setEditMappings(null);
      toast.success("Mappings reset to defaults");
    } catch {
      toast.error("Failed to reset");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Event Mappings</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Map pipeline stages to conversion event names sent to ad platforms
          </p>
        </div>
        <div className="flex gap-2">
          {editMappings && (
            <button
              onClick={handleSave}
              disabled={bulkUpdate.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              {bulkUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
          )}
          <button
            onClick={handleReset}
            disabled={resetMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-50"
          >
            <RefreshCw className={`h-3 w-3 ${resetMut.isPending ? "animate-spin" : ""}`} />
            Reset
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Pipeline Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Event Name</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Include Value</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeMappings.map((m, idx) => (
                <tr key={m.id || idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{m.pipeline_stage}</td>
                  <td className="px-4 py-2.5">
                    <input
                      value={m.event_name}
                      onChange={(e) => handleFieldChange(idx, "event_name", e.target.value)}
                      className="w-full rounded border border-border bg-white px-2 py-1 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.include_value}
                      onChange={(e) => handleFieldChange(idx, "include_value", e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary-light focus:ring-primary-light"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.is_active}
                      onChange={(e) => handleFieldChange(idx, "is_active", e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary-light focus:ring-primary-light"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
