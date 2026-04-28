"use client";

import { useAuthStore } from "@/stores/auth-store";
import { ROLES, type Role } from "@/lib/constants";

type Action = "read" | "create" | "edit" | "delete" | "full";
type Module =
  | "dashboard"
  | "patients"
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
  | "admin";

// Permission matrix: role -> module -> allowed actions
const PERMISSION_MATRIX: Record<Role, Partial<Record<Module, Action[]>>> = {
  [ROLES.SUPER_ADMIN]: {
    dashboard: ["full"],
    patients: ["full"],
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
    dashboard: ["read"],
    patients: ["read", "create"],
    pipeline: ["read"],
    whatsapp: ["read", "create"],
    appointments: ["full"],
    forms: ["read"],
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
    patients: ["read"],
    appointments: ["read", "edit"],
    analytics: ["read"],
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
