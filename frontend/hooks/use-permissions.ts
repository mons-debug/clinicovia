"use client";

import { useAuthStore } from "@/stores/auth-store";
import { ROLES, type Role } from "@/lib/constants";

type Action = "read" | "create" | "edit" | "delete" | "full";
type Module =
  | "dashboard"
  | "patients"
  | "queue"
  | "calendar"
  | "invoices"
  | "plans"
  | "pipeline"
  | "whatsapp"
  | "ai_agents"
  | "campaigns"
  | "doctors"
  | "appointments"
  | "tracking"
  | "analytics"
  | "forms"
  | "settings"
  | "team"
  | "billing"
  | "admin"
  | "doctor_services";

// Permission matrix: role -> module -> allowed actions
const PERMISSION_MATRIX: Record<Role, Partial<Record<Module, Action[]>>> = {
  [ROLES.SUPER_ADMIN]: {
    dashboard: ["full"],
    patients: ["full"],
    queue: ["full"],
    calendar: ["full"],
    invoices: ["full"],
    plans: ["full"],
    pipeline: ["full"],
    whatsapp: ["full"],
    ai_agents: ["full"],
    campaigns: ["full"],
    doctors: ["full"],
    appointments: ["full"],
    tracking: ["full"],
    analytics: ["full"],
    forms: ["full"],
    settings: ["full"],
    team: ["full"],
    billing: ["full"],
    admin: ["full"],
  },
  [ROLES.CLINIC_OWNER]: {
    dashboard: ["full"],
    patients: ["full"],
    queue: ["full"],
    calendar: ["full"],
    invoices: ["full"],
    plans: ["full"],
    pipeline: ["full"],
    whatsapp: ["full"],
    ai_agents: ["full"],
    campaigns: ["full"],
    doctors: ["full"],
    appointments: ["full"],
    tracking: ["full"],
    analytics: ["full"],
    forms: ["full"],
    settings: ["full"],
    team: ["full"],
    billing: ["full"],
  },
  [ROLES.MANAGER]: {
    dashboard: ["full"],
    patients: ["full"],
    queue: ["full"],
    calendar: ["full"],
    invoices: ["full"],
    plans: ["full"],
    pipeline: ["full"],
    whatsapp: ["full"],
    ai_agents: ["full"],
    campaigns: ["full"],
    doctors: ["full"],
    appointments: ["full"],
    tracking: ["full"],
    analytics: ["full"],
    forms: ["full"],
    settings: ["read", "edit"],
    team: ["read"],
  },
  [ROLES.RECEPTIONIST]: {
    // Front-desk view: queue, calendar, patients, invoices.
    // Hide: pipeline, whatsapp inbox, ai_agents, campaigns, forms,
    // doctors, analytics, ai_agents — pure operations only.
    dashboard: ["read"],
    patients: ["read", "create"],
    queue: ["full"],
    calendar: ["read", "edit"],
    invoices: ["read", "create", "edit"],
    appointments: ["full"],
  },
  [ROLES.SALES_AGENT]: {
    dashboard: ["read"],
    patients: ["read", "edit"],
    pipeline: ["read", "create", "edit"],
    whatsapp: ["read", "create", "edit"],
    analytics: ["read"],
    forms: ["read"],
  },
  [ROLES.MARKETING_MANAGER]: {
    dashboard: ["read"],
    patients: ["read"],
    campaigns: ["full"],
    analytics: ["read"],
    forms: ["full"],
  },
  [ROLES.DOCTOR]: {
    dashboard: ["read"],
    patients: ["read", "create", "edit"],
    queue: ["full"],
    calendar: ["read", "edit"],
    plans: ["full"],
    appointments: ["read", "create", "edit"],
    doctors: ["read"],
    settings: ["read"],
    analytics: ["read"],
    doctor_services: ["full"],
  },
};

export function usePermissions() {
  const { currentRole, user } = useAuthStore();

  const can = (action: Action, module: Module): boolean => {
    if (!currentRole) return false;
    if (user?.isSuperAdmin) return true;

    const permissions = PERMISSION_MATRIX[currentRole]?.[module];
    if (!permissions) return false;
    if (permissions.includes("full")) return true;
    return permissions.includes(action);
  };

  const canAccessModule = (module: Module): boolean => {
    if (!currentRole) return false;
    if (user?.isSuperAdmin) return true;
    return !!PERMISSION_MATRIX[currentRole]?.[module];
  };

  return { can, canAccessModule, currentRole };
}
