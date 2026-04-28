"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  Filter,
} from "lucide-react";
import {
  useConversionEvents,
  useConversionStats,
  type ListEventsParams,
} from "@/lib/api/tracking";

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google_ads: "Google Ads",
  ga4: "GA4",
  gtm: "GTM",
  snapchat: "Snapchat",
  tiktok: "TikTok",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "#10B981",
  failed: "#EF4444",
  pending: "#F59E0B",
  retrying: "#3B82F6",
};

export default function ConversionAnalyticsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [page, setPage] = useState(1);

  const params: ListEventsParams = {
    page,
    page_size: 50,
    ...(platformFilter && { platform: platformFilter }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  };

  const { data: statsData } = useConversionStats({ date_from: dateFrom || undefined, date_to: dateTo || undefined });
  const { data: eventsData, isLoading } = useConversionEvents(params);

  const stats = statsData;
  const events = eventsData?.events || [];
  const total = eventsData?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Conversion Tracking</h1>
        <p className="mt-1 text-sm text-text-secondary">Monitor conversion events sent to your ad platforms</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500" /><span className="text-xs text-text-muted">Total Events</span></div>
            <p className="mt-2 text-2xl font-bold text-text-primary">{stats.total_events.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-xs text-text-muted">Sent</span></div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{(stats.by_status?.sent || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-400" /><span className="text-xs text-text-muted">Failed</span></div>
            <p className="mt-2 text-2xl font-bold text-red-500">{(stats.by_status?.failed || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-purple-500" /><span className="text-xs text-text-muted">Total Value</span></div>
            <p className="mt-2 text-2xl font-bold text-text-primary">{stats.currency} {Number(stats.total_value).toLocaleString()}</p>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.by_platform).length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-sm font-semibold text-text-primary">Events by Platform</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(stats.by_platform).map(([platform, counts]) => {
              const c = counts as { sent: number; failed: number };
              const t = c.sent + c.failed;
              const pct = t > 0 ? (c.sent / t) * 100 : 0;
              return (
                <div key={platform} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-text-secondary">{PLATFORM_LABELS[platform] || platform}</span>
                  <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-right text-xs text-text-muted">{c.sent} sent / {c.failed} fail</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats && Object.keys(stats.by_event_name).length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-sm font-semibold text-text-primary">Events by Type</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(stats.by_event_name).map(([name, count]) => (
              <div key={name} className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs font-medium text-text-primary">{name}</p>
                <p className="text-lg font-bold text-text-primary">{(count as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-text-muted" />
        <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs focus:border-primary-light focus:outline-none">
          <option value="">All Platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs focus:border-primary-light focus:outline-none" />
        <span className="text-xs text-text-muted">to</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs focus:border-primary-light focus:outline-none" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">No conversion events yet</p>
            <p className="mt-1 text-xs text-text-muted">Events appear when pipeline stages change or WhatsApp messages are received</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Platform</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Event</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Trigger</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-medium text-text-primary">{PLATFORM_LABELS[event.platform] || event.platform}</td>
                  <td className="px-4 py-2.5"><span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{event.event_name}</span></td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{event.trigger_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-xs text-text-primary">{event.value ? `${event.currency} ${Number(event.value).toLocaleString()}` : "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: STATUS_COLORS[event.status] || "#6B7280" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[event.status] || "#6B7280" }} />
                      {event.status}
                      {event.attempts > 1 && <span className="text-text-muted">({event.attempts}x)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(event.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(page + 1)} disabled={page * 50 >= total} className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
