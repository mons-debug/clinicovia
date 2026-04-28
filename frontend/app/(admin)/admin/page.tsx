"use client";

import {
  Building2,
  Users,
  DollarSign,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { KpiCard } from "@/components/shared/kpi-card";

const RECENT_CLINICS = [
  { name: "Dubai Aesthetic Clinic", owner: "Dr. Sarah", plan: "Professional", status: "Active", mrr: 1000, date: "Mar 25" },
  { name: "Riyadh Dental Center", owner: "Dr. Ahmad", plan: "Growth", status: "Trial", mrr: 500, date: "Mar 23" },
  { name: "Cairo Skin Care", owner: "Dr. Noor", plan: "Growth", status: "Active", mrr: 500, date: "Mar 20" },
  { name: "Istanbul Hair Clinic", owner: "Dr. Emre", plan: "Enterprise", status: "Active", mrr: 2000, date: "Mar 18" },
  { name: "Doha Wellness Center", owner: "Dr. Layla", plan: "Trial", status: "Trial", mrr: 0, date: "Mar 15" },
];

const ALERTS = [
  { type: "warning", message: "2 WhatsApp containers disconnected", time: "5m ago" },
  { type: "error", message: "Payment failed for Cairo Skin Care", time: "1h ago" },
  { type: "info", message: "New clinic signup: Doha Wellness Center", time: "3h ago" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Platform overview and system health</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Clinics" value="47" change="+3 this month" changeType="up" icon={Building2} iconColor="#3B82F6" iconBgColor="#EFF6FF" />
        <KpiCard label="Total Users" value="312" change="+18" changeType="up" icon={Users} iconColor="#8B5CF6" iconBgColor="#F5F3FF" />
        <KpiCard label="MRR" value="$34,500" change="+12%" changeType="up" icon={DollarSign} iconColor="#10B981" iconBgColor="#ECFDF5" />
        <KpiCard label="Active WhatsApp" value="42/47" change="89%" changeType="neutral" icon={MessageSquare} iconColor="#25D366" iconBgColor="#ECFDF5" />
      </div>

      {/* Two columns: Recent clinics + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Clinics */}
        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Recent Clinics</h3>
            <Link href="/admin/clinics" className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: "var(--primary-light)" }}>
              View All
            </Link>
          </div>
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-xs font-semibold text-text-muted">Clinic</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted">Plan</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted">Status</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {RECENT_CLINICS.map((c) => (
                  <tr key={c.name} className="hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <p className="font-medium text-text-primary">{c.name}</p>
                      <p className="text-xs text-text-muted">{c.owner} &middot; {c.date}</p>
                    </td>
                    <td className="py-2.5">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-secondary">
                        {c.plan}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${c.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-text-primary">
                      {c.mrr > 0 ? `$${c.mrr}` : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-base font-semibold text-text-primary">System Alerts</h3>
          <div className="mt-4 space-y-3">
            {ALERTS.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                {alert.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                {alert.type === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                {alert.type === "info" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
                <div>
                  <p className="text-xs font-medium text-text-primary">{alert.message}</p>
                  <p className="text-[10px] text-text-muted">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* System health */}
          <div className="mt-5 space-y-2">
            <h4 className="text-xs font-semibold text-text-muted">System Health</h4>
            {[
              { name: "API Server", status: "healthy" },
              { name: "PostgreSQL", status: "healthy" },
              { name: "Redis", status: "healthy" },
              { name: "MongoDB", status: "healthy" },
              { name: "WhatsApp Bridge", status: "degraded" },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{svc.name}</span>
                <span className={`flex items-center gap-1 font-medium ${
                  svc.status === "healthy" ? "text-emerald-600" : "text-amber-600"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    svc.status === "healthy" ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
