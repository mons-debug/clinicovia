"use client";

import { useState } from "react";
import { DollarSign, UserPlus, TrendingUp, Target } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";

const dateRanges = ["This Month", "Last 30 Days", "Last 90 Days"] as const;

const revenueData = [
  { month: "Nov", value: 32000 },
  { month: "Dec", value: 36000 },
  { month: "Jan", value: 29000 },
  { month: "Feb", value: 41000 },
  { month: "Mar", value: 44000 },
  { month: "Apr", value: 48320 },
];

const leadSources = [
  { name: "WhatsApp", pct: 35, color: "var(--primary)" },
  { name: "Instagram", pct: 25, color: "#3EC8A0" },
  { name: "Google Ads", pct: 20, color: "#60A5FA" },
  { name: "Referral", pct: 12, color: "#F59E0B" },
  { name: "Other", pct: 8, color: "#D1D5DB" },
];

const topTreatments = [
  { name: "Teeth Whitening", count: 48, revenue: "$14,400" },
  { name: "Dental Implants", count: 22, revenue: "$11,000" },
  { name: "Invisalign", count: 18, revenue: "$9,900" },
  { name: "Root Canal", count: 35, revenue: "$7,000" },
  { name: "Veneers", count: 12, revenue: "$6,020" },
];

const funnelStages = [
  { label: "Leads", value: 450 },
  { label: "Contacted", value: 320 },
  { label: "Qualified", value: 180 },
  { label: "Booked", value: 95 },
  { label: "Completed", value: 72 },
];

export default function AnalyticsPage() {
  const [activeRange, setActiveRange] = useState<string>("This Month");

  const maxRevenue = Math.max(...revenueData.map((d) => d.value));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <div className="flex rounded-lg border border-border bg-white p-1">
          {dateRanges.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeRange === range
                  ? "text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              style={
                activeRange === range
                  ? { backgroundColor: "var(--primary)" }
                  : undefined
              }
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value="$48,320"
          change="+12%"
          changeType="up"
          icon={DollarSign}
          iconColor="var(--primary)"
          iconBgColor="#E0F2FE"
        />
        <KpiCard
          label="New Patients"
          value={156}
          change="+23%"
          changeType="up"
          icon={UserPlus}
          iconColor="#3EC8A0"
          iconBgColor="#ECFDF5"
        />
        <KpiCard
          label="Conversion Rate"
          value="34%"
          change="+5%"
          changeType="up"
          icon={TrendingUp}
          iconColor="#F59E0B"
          iconBgColor="#FFFBEB"
        />
        <KpiCard
          label="Avg Deal Value"
          value="$2,450"
          change="+8%"
          changeType="up"
          icon={Target}
          iconColor="#8B5CF6"
          iconBgColor="#F5F3FF"
        />
      </div>

      {/* Revenue Trend */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Revenue Trend
          </h2>
          <span className="text-xs text-text-muted">
            Chart will be rendered with Recharts
          </span>
        </div>
        <div className="flex items-end gap-4" style={{ height: 200 }}>
          {revenueData.map((d) => (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">
                ${(d.value / 1000).toFixed(0)}k
              </span>
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${(d.value / maxRevenue) * 160}px`,
                  backgroundColor: "var(--primary)",
                  opacity: 0.7 + (d.value / maxRevenue) * 0.3,
                }}
              />
              <span className="text-xs text-text-muted">{d.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: Lead Sources + Top Treatments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Lead Sources */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            Lead Sources
          </h2>
          <div className="space-y-4">
            {leadSources.map((src) => (
              <div key={src.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{src.name}</span>
                  <span className="font-medium text-text-secondary">
                    {src.pct}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: `${src.pct}%`,
                      backgroundColor: src.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Treatments */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            Top Treatments
          </h2>
          <div className="space-y-0">
            <div className="grid grid-cols-3 border-b border-border pb-2 text-xs font-medium text-text-muted">
              <span>Treatment</span>
              <span className="text-center">Count</span>
              <span className="text-right">Revenue</span>
            </div>
            {topTreatments.map((t) => (
              <div
                key={t.name}
                className="grid grid-cols-3 border-b border-border py-3 last:border-b-0"
              >
                <span className="text-sm font-medium text-text-primary">
                  {t.name}
                </span>
                <span className="text-center text-sm text-text-secondary">
                  {t.count}
                </span>
                <span className="text-right text-sm font-medium text-text-primary">
                  {t.revenue}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          Conversion Funnel
        </h2>
        <div className="flex items-center gap-2">
          {funnelStages.map((stage, i) => {
            const widthPct = 20 + ((funnelStages.length - i) / funnelStages.length) * 80;
            const opacity = 0.5 + ((funnelStages.length - i) / funnelStages.length) * 0.5;
            return (
              <div key={stage.label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="flex w-full items-center justify-center rounded-lg py-4 text-white"
                  style={{
                    backgroundColor: "var(--primary)",
                    opacity,
                    width: `${widthPct}%`,
                    margin: "0 auto",
                  }}
                >
                  <span className="text-lg font-bold">{stage.value}</span>
                </div>
                <span className="text-xs font-medium text-text-secondary">
                  {stage.label}
                </span>
                {i < funnelStages.length - 1 && (
                  <span className="absolute" />
                )}
              </div>
            );
          })}
        </div>
        {/* Arrow connectors row */}
        <div className="mt-1 flex items-center justify-center gap-2 text-text-muted">
          {funnelStages.slice(0, -1).map((_, i) => (
            <div key={i} className="flex flex-1 justify-center text-xs text-text-muted">
              →
            </div>
          ))}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
