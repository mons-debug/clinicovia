"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function KpiCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "#3B82F6",
  iconBgColor = "#EFF6FF",
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBgColor }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        {change && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              changeType === "up"
                ? "bg-emerald-50 text-emerald-700"
                : changeType === "down"
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-100 text-text-secondary"
            }`}
          >
            {changeType === "up" && <TrendingUp className="h-3 w-3" />}
            {changeType === "down" && <TrendingDown className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
