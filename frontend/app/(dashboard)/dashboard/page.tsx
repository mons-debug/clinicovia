"use client";

import { Card, Badge } from "flowbite-react";
import { Calendar, UserPlus, DollarSign, Clock, Plus, Activity } from "lucide-react";

// Mock data — will be replaced with API calls
const kpiData = [
  {
    label: "Today's Appointments",
    value: "14",
    change: "+3 vs yesterday",
    changeType: "up" as const,
    icon: Calendar,
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    label: "New Leads",
    value: "23",
    change: "+18%",
    changeType: "up" as const,
    icon: UserPlus,
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  {
    label: "Revenue (MTD)",
    value: "$48,320",
    change: "+12%",
    changeType: "up" as const,
    icon: DollarSign,
    color: "#059669",
    bgColor: "#ECFDF5",
  },
  {
    label: "Avg Response Time",
    value: "12s",
    change: "-8s faster",
    changeType: "up" as const,
    icon: Clock,
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
  {
    label: "Conversions Sent",
    value: "--",
    change: "View details",
    changeType: "up" as const,
    icon: Activity,
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
  },
];

const recentConversations = [
  { name: "Fatima Al-Rashid", message: "Thanks, can I book for next...", time: "2m", unread: 3 },
  { name: "Ahmad Hassan", message: "What's the cost for FUE?", time: "5m", unread: 1 },
  { name: "Maryam Al-Sayed", message: "I'd like to schedule a consult...", time: "12m", unread: 0 },
  { name: "Omar Khalil", message: "Is Dr. Sarah available tomorrow?", time: "1h", unread: 0 },
  { name: "Noor Ali", message: "Thank you for the information", time: "2h", unread: 0 },
];

const todayAppointments = [
  { time: "09:00", patient: "Fatima Al-Rashid", treatment: "Botox", doctor: "Dr. Sarah", status: "Confirmed" },
  { time: "10:00", patient: "Ahmad Hassan", treatment: "Consultation", doctor: "Dr. Ali", status: "Checked In" },
  { time: "11:30", patient: "Maryam Al-Sayed", treatment: "Laser", doctor: "Dr. Noor", status: "Pending" },
  { time: "14:00", patient: "Omar Khalil", treatment: "Hair Transplant", doctor: "Dr. Ahmad", status: "Confirmed" },
];

const quickActions = ["New Patient", "Book Appointment", "Start Campaign"];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome + Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Good morning, Dr. Ahmad</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Saturday, March 28, 2026</p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: kpi.bgColor }}
                >
                  <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: "#ECFDF5", color: "#10B981" }}
                >
                  {kpi.change}
                </span>
              </div>
              <p className="mt-4 text-sm text-text-secondary">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Row 2 — Pipeline + WhatsApp */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Pipeline Overview */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Pipeline Overview</h3>
            <span className="text-xs text-text-muted">This month</span>
          </div>
          <div className="mt-5 space-y-3">
            {[
              { stage: "New Lead", count: 34, value: "$45K", pct: 100 },
              { stage: "Contacted", count: 28, value: "$38K", pct: 82 },
              { stage: "Qualified", count: 15, value: "$28K", pct: 44 },
              { stage: "Booked", count: 12, value: "$22K", pct: 35 },
              { stage: "Completed", count: 8, value: "$18K", pct: 24 },
            ].map((item) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-text-secondary">
                  {item.stage}
                </span>
                <div className="flex-1">
                  <div className="h-7 rounded-lg bg-gray-100">
                    <div
                      className="flex h-full items-center justify-between rounded-lg px-3 text-xs font-semibold text-white transition-all"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: "#0D4F6C",
                        opacity: 0.55 + (item.pct / 100) * 0.45,
                      }}
                    >
                      <span>{item.count}</span>
                      <span>{item.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent WhatsApp */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Recent WhatsApp</h3>
            <a href="/whatsapp" className="text-xs font-medium transition-opacity hover:opacity-80" style={{ color: "var(--primary-light)" }}>
              View All
            </a>
          </div>
          <div className="mt-4 space-y-1">
            {recentConversations.map((conv) => (
              <div
                key={conv.name}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-gray-50"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: "#0D4F6C" }}
                >
                  {conv.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${conv.unread ? "font-semibold" : "font-medium"} text-text-primary`}>
                    {conv.name}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{conv.message}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-text-muted">{conv.time}</span>
                  {conv.unread > 0 && (
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — Today's Appointments */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Today&apos;s Appointments</h3>
          <span className="text-xs text-text-secondary">
            {todayAppointments.length} scheduled today
          </span>
        </div>
        <div className="mt-4 divide-y divide-border">
          {todayAppointments.map((apt, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                {apt.time}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{apt.patient}</p>
                <p className="text-xs text-text-secondary">
                  {apt.treatment} &middot; {apt.doctor}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  apt.status === "Confirmed"
                    ? "bg-blue-50 text-blue-700"
                    : apt.status === "Checked In"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {apt.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
