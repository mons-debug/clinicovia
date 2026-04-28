"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  useKnowledgeBase,
  useCreateKnowledgeEntry,
  useUpdateKnowledgeEntry,
  useDeleteKnowledgeEntry,
  useAgents,
  type KBEntry,
  type KBEntryType,
  type AgentLanguage,
} from "@/lib/api/ai-agents";

const ENTRY_TYPES: { value: KBEntryType; label: string }[] = [
  { value: "system_prompt", label: "System Prompt" },
  { value: "response_template", label: "Response Template" },
  { value: "service_info", label: "Service Info" },
  { value: "faq", label: "FAQ" },
  { value: "objection_handler", label: "Objection Handler" },
  { value: "custom_context", label: "Custom Context" },
];

const ENTRY_TYPE_LABEL: Record<KBEntryType, string> = Object.fromEntries(
  ENTRY_TYPES.map((t) => [t.value, t.label]),
) as Record<KBEntryType, string>;

interface FormState {
  id?: string;
  agent_config_id: string | null;
  entry_type: KBEntryType;
  title: string;
  content: string;
  language: AgentLanguage;
  service_type: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: FormState = {
  agent_config_id: null,
  entry_type: "faq",
  title: "",
  content: "",
  language: "en",
  service_type: "",
  is_active: true,
  sort_order: 0,
};

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<KBEntryType | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: kbData, isLoading, isError, error } = useKnowledgeBase({
    entryType: typeFilter === "all" ? undefined : typeFilter,
    agentId: agentFilter === "all" ? undefined : agentFilter,
  });
  const { data: agentsData } = useAgents();
  const createMutation = useCreateKnowledgeEntry();
  const updateMutation = useUpdateKnowledgeEntry();
  const deleteMutation = useDeleteKnowledgeEntry();

  const agents = agentsData?.agents ?? [];
  const agentsById = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents],
  );

  const entries = (kbData?.items ?? []).filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      (e.service_type ?? "").toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (entry: KBEntry) => {
    setForm({
      id: entry.id,
      agent_config_id: entry.agent_config_id,
      entry_type: entry.entry_type,
      title: entry.title,
      content: entry.content,
      language: entry.language,
      service_type: entry.service_type ?? "",
      is_active: entry.is_active,
      sort_order: entry.sort_order,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      agent_config_id: form.agent_config_id,
      entry_type: form.entry_type,
      title: form.title.trim(),
      content: form.content.trim(),
      language: form.language,
      service_type: form.service_type.trim() || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    try {
      if (form.id) {
        await updateMutation.mutateAsync({ entryId: form.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      // error shown inline on button
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this knowledge entry?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Context, FAQs, and templates that agents use to respond
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" />
          Add Entry
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as KBEntryType | "all")}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary-light focus:outline-none"
        >
          <option value="all">All types</option>
          {ENTRY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary-light focus:outline-none"
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </select>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries..."
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
          Failed to load knowledge base: {(error as Error)?.message}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No knowledge entries yet
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Add FAQs, service info, and response templates to train your agents.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full">
            <thead className="border-b border-border bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Lang
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                      {entry.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                      {entry.content}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {ENTRY_TYPE_LABEL[entry.entry_type]}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {entry.agent_config_id
                      ? agentsById[entry.agent_config_id]?.display_name ?? "—"
                      : "All"}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {entry.service_type || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-text-secondary">
                    {entry.language}
                  </td>
                  <td className="px-4 py-3">
                    {entry.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <XCircle className="h-3.5 w-3.5" />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(entry)}
                        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {form.id ? "Edit Entry" : "New Knowledge Entry"}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Content that agents will use when generating responses
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-text-muted hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                  Title
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  placeholder="e.g. Hair transplant initial response"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                    Entry type
                  </label>
                  <select
                    value={form.entry_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        entry_type: e.target.value as KBEntryType,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  >
                    {ENTRY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                    Agent (optional)
                  </label>
                  <select
                    value={form.agent_config_id ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        agent_config_id: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  >
                    <option value="">All agents</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                  Content
                </label>
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  placeholder="Write the knowledge, template, or instruction..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                    Language
                  </label>
                  <select
                    value={form.language}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        language: e.target.value as AgentLanguage,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                    Service type
                  </label>
                  <input
                    value={form.service_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, service_type: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                    placeholder="e.g. hair_transplant"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                    Sort order
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sort_order: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Active — agents will use this entry
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {form.id ? "Save changes" : "Create entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
