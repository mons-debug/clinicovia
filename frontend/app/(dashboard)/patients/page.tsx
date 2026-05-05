"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import {
  Plus,
  Download,
  Phone,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  MessageSquare,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { WalkInDialog } from "@/components/queue/walk-in-dialog";
import { LEAD_SOURCES } from "@/lib/constants";
import {
  usePatients,
  useDeletePatient,
  type Patient,
  type ListPatientsParams,
} from "@/lib/api/patients";

const columnHelper = createColumnHelper<Patient>();

const sourceColorMap: Record<string, string> = {
  whatsapp: "bg-emerald-50 text-emerald-700",
  instagram: "bg-pink-50 text-pink-700",
  google_ads: "bg-amber-50 text-amber-700",
  website: "bg-blue-50 text-blue-700",
  referral: "bg-purple-50 text-purple-700",
  walk_in: "bg-gray-100 text-gray-600",
  phone: "bg-sky-50 text-sky-700",
  facebook: "bg-blue-50 text-blue-700",
  tiktok: "bg-gray-100 text-gray-700",
  snapchat: "bg-yellow-50 text-yellow-700",
};

export default function PatientsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  // Lifecycle tab — read from ?tab= so dashboard KPI links land on the
  // right view by default
  const [tab, setTab] = useState<"all" | "leads" | "patients" | "active">(() => {
    if (typeof window === "undefined") return "all";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "leads" || t === "patients" || t === "active" ? t : "all";
  });

  // Debounce search
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceTimer[0]) clearTimeout(debounceTimer[0]);
      debounceTimer[0] = setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, 300);
    },
    [debounceTimer]
  );

  const params: ListPatientsParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      tab,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [page, pageSize, debouncedSearch, statusFilter, tab, sortBy, sortDir]
  );

  const { data, isLoading, isError, error } = usePatients(params);
  const deleteMutation = useDeletePatient();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Patient ${deleteTarget.first_name} ${deleteTarget.last_name} deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete patient");
    }
  };

  const handleSort = useCallback((columnId: string) => {
    setSortBy((prev) => {
      if (prev === columnId) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return columnId;
    });
    setPage(1);
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "patient",
        header: "Patient",
        cell: ({ row }) => {
          const p = row.original;
          const initials = `${p.first_name[0]}${p.last_name[0]}`;
          return (
            <Link href={`/patients/${p.id}`} className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#0D4F6C" }}>
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary group-hover:text-primary-light transition-colors">
                  {p.first_name} {p.last_name}
                </p>
                {p.email && <p className="text-xs text-text-muted">{p.email}</p>}
              </div>
            </Link>
          );
        },
      }),
      columnHelper.accessor("phone", {
        header: "Phone",
        cell: (info) => <span className="text-sm tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("lead_source", {
        header: "Source",
        cell: (info) => {
          const src = info.getValue();
          if (!src) return <span className="text-xs text-text-muted">--</span>;
          const label = LEAD_SOURCES.find((s) => s.value === src)?.label || src;
          const colorClass = sourceColorMap[src] || "bg-gray-100 text-gray-600";
          return (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {label}
            </span>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const s = info.getValue();
          return <StatusBadge status={s.charAt(0).toUpperCase() + s.slice(1)} variant={getStatusVariant(s)} dot />;
        },
      }),
      columnHelper.accessor("lead_score", {
        header: "Score",
        cell: (info) => {
          const score = info.getValue();
          const color = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-text-muted";
          return <span className={`text-sm font-semibold ${color}`}>{score}</span>;
        },
      }),
      columnHelper.accessor("total_spent", {
        header: "Spent",
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className="text-sm font-medium text-text-primary">
              {val > 0 ? `$${val.toLocaleString()}` : "--"}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (!tags.length) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.tag}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/patients/${row.original.id}`}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
              title="View"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setDeleteTarget(row.original)}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Patients</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {total} total patients
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <WalkInDialog triggerLabel="Nouveau patient" />
        </div>
      </div>

      {/* Lifecycle tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {([
          { key: "all", label: "Tous" },
          { key: "leads", label: "Leads WhatsApp" },
          { key: "patients", label: "Patients" },
          { key: "active", label: "Actifs" },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Rechercher par nom, e-mail, téléphone…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-xl border border-border bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          <span className="ml-2 text-sm text-text-secondary">Loading patients...</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : "Failed to load patients"}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && patients.length === 0 && !debouncedSearch && statusFilter === "all" && (
        <div className="rounded-xl border border-border bg-white p-6">
          <EmptyState
            icon={UserPlus}
            title="No patients yet"
            description="Start adding patients to manage your clinic's growth."
            action={{ label: "Add First Patient", onClick: () => {} }}
          />
        </div>
      )}

      {/* No results for search/filter */}
      {!isLoading && !isError && patients.length === 0 && (debouncedSearch || statusFilter !== "all") && (
        <div className="rounded-xl border border-border bg-white p-8 text-center">
          <p className="text-sm text-text-secondary">No patients match your filters.</p>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !isError && patients.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80">
                  {columns.map((col, idx) => (
                    <th
                      key={col.id ?? ("accessorKey" in col ? String(col.accessorKey) : idx)}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                    >
                      {"accessorKey" in col ? (
                        <button
                          className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-text-primary"
                          onClick={() => handleSort(String((col as { accessorKey: string }).accessorKey))}
                        >
                          {typeof col.header === "string" ? col.header : ""}
                          {sortBy === (col as { accessorKey: string }).accessorKey && (
                            <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                          )}
                        </button>
                      ) : (
                        typeof col.header === "string" ? col.header : ""
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((patient) => (
                  <tr key={patient.id} className="transition-colors hover:bg-gray-50/50">
                    {columns.map((col, idx) => (
                      <td key={col.id ?? ("accessorKey" in col ? String(col.accessorKey) : idx)} className="px-4 py-3 text-text-primary">
                        {col.cell
                          ? (col.cell as (info: { row: { original: Patient }; getValue: () => unknown }) => React.ReactNode)({
                              row: { original: patient },
                              getValue: () =>
                                "accessorKey" in col
                                  ? patient[
                                      (col as { accessorKey: string }).accessorKey as keyof Patient
                                    ]
                                  : undefined,
                            })
                          : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-text-secondary">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40"
                >
                  First
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 text-xs font-medium text-text-primary">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-text-primary">Delete Patient</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong>?
              This action will remove the patient from your active list.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
