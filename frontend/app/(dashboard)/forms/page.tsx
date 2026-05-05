"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  ClipboardList,
  Eye,
  Pencil,
  Link2,
  CheckCircle,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { useForms } from "@/lib/api/forms";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FormsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => setDebouncedSearch(value), 300);
  }, [debounceRef]);

  const { data, isLoading, isError, error } = useForms({
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const forms = data?.forms ?? [];
  const stats = data?.stats;

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Form link copied to clipboard");
  };

  const statCards = [
    { label: "Total Forms", value: stats?.total ?? 0, icon: FileText, color: "var(--primary)", bg: "bg-sky-50" },
    { label: "Total Submissions", value: stats?.total_submissions ?? 0, icon: BarChart3, color: "#3EC8A0", bg: "bg-emerald-50" },
    { label: "Active Forms", value: stats?.active ?? 0, icon: CheckCircle, color: "#10B981", bg: "bg-green-50" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading forms...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load forms"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Forms</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Create and manage patient intake forms, surveys, and questionnaires.</p>
        </div>
        <Link
          href="/forms/new"
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" /> Create Form
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="text-xl font-bold text-text-primary">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {[
            { key: "", label: "All" },
            { key: "active", label: "Active" },
            { key: "draft", label: "Draft" },
            { key: "archived", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search forms..."
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      {/* Empty state */}
      {forms.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12">
          <ClipboardList className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">No forms yet</p>
          <p className="mt-1 text-xs text-text-secondary">Create your first form to start collecting data.</p>
          <Link href="/forms/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--primary-light)" }}>
            <Plus className="h-4 w-4" /> Create First Form
          </Link>
        </div>
      )}

      {/* Form Cards */}
      {forms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <div key={form.id} className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary leading-tight">{form.title}</h3>
                </div>
                <StatusBadge status={form.status.charAt(0).toUpperCase() + form.status.slice(1)} variant={getStatusVariant(form.status)} dot />
              </div>
              {form.description && (
                <p className="mt-3 text-xs text-text-secondary leading-relaxed line-clamp-2">{form.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{form.submission_count} submissions</span>
                <span>Created {formatDate(form.created_at)}</span>
              </div>
              <div className="my-4 border-t border-border" />
              <div className="flex items-center gap-2">
                <Link href={`/forms/${form.id}/submissions`} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-gray-50">
                  <Eye className="h-3.5 w-3.5" /> Submissions
                </Link>
                <Link href={`/forms/${form.id}/edit`} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-gray-50">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button onClick={() => copyLink(form.slug)} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-gray-50">
                  <Link2 className="h-3.5 w-3.5" /> Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
