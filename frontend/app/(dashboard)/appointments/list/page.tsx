"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, Search, Loader2, AlertCircle, Eye } from "lucide-react";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { useAppointments, useUpdateAppointmentStatus } from "@/lib/api/appointments";
import { toast } from "sonner";

export default function AppointmentsListPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef[0]) clearTimeout(debounceRef[0]);
      debounceRef[0] = setTimeout(() => { setDebouncedSearch(value); setPage(1); }, 300);
    },
    [debounceRef]
  );

  const { data, isLoading, isError, error } = useAppointments({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: statusFilter || undefined,
    patient_search: debouncedSearch || undefined,
    page,
    page_size: pageSize,
  });

  const statusMutation = useUpdateAppointmentStatus();
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: newStatus });
      toast.success("Status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const appointments = data?.appointments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const statuses = ["scheduled", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Appointments List</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{total} total</p>
        </div>
        <Link href="/appointments" className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
          <Calendar className="h-4 w-4" /> Calendar View
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search patient..." className="w-48 rounded-lg border border-border bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" placeholder="From" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" placeholder="To" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center rounded-xl border border-border bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" /><span className="ml-2 text-sm text-text-secondary">Loading...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load"}</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80">
                  {["Patient", "Treatment", "Doctor", "Date & Time", "Duration", "Status", "First Visit", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appointments.length > 0 ? appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#0D4F6C" }}>
                          {apt.patient_initials}
                        </div>
                        <span className="font-medium text-text-primary">{apt.patient_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{apt.treatment}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: apt.doctor_color }} />
                        <span className="text-text-secondary">{apt.doctor_name || "--"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary tabular-nums">{apt.appointment_date} {apt.start_time}-{apt.end_time}</td>
                    <td className="px-4 py-3 text-text-secondary">{apt.duration_minutes}min</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={apt.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} variant={getStatusVariant(apt.status)} dot />
                    </td>
                    <td className="px-4 py-3">
                      {apt.is_first_visit && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">First Visit</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/appointments/${apt.id}`} className="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-primary">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-text-secondary">No appointments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-text-secondary">Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page <= 1} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">First</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">Prev</button>
                <span className="px-2 text-xs font-medium text-text-primary">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">Next</button>
                <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">Last</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
