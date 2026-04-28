"use client";

type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  dot?: boolean;
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-gray-100 text-text-secondary",
  purple: "bg-purple-50 text-purple-700",
};

const dotColors: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-gray-400",
  purple: "bg-purple-500",
};

export function StatusBadge({ status, variant = "neutral", dot = false }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {status}
    </span>
  );
}

/**
 * Utility to auto-map common status strings to variants.
 */
export function getStatusVariant(status: string): StatusVariant {
  const lower = status.toLowerCase();
  if (["active", "confirmed", "completed", "paid", "connected", "checked in"].includes(lower))
    return "success";
  if (["pending", "scheduled", "trial", "in progress"].includes(lower))
    return "warning";
  if (["cancelled", "failed", "suspended", "churned", "overdue"].includes(lower))
    return "danger";
  if (["new", "open", "booked"].includes(lower))
    return "info";
  if (["ai", "automated", "bot"].includes(lower))
    return "purple";
  return "neutral";
}
