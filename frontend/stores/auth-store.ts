import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/constants";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  isVerified: boolean;
  isSuperAdmin: boolean;
  specialty?: string | null;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  logoUrl?: string;
}

interface Membership {
  clinicId: string;
  role: Role;
  clinic: Clinic;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentClinic: Clinic | null;
  currentRole: Role | null;
  memberships: Membership[];

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string, memberships: Membership[]) => void;
  setCurrentClinic: (clinic: Clinic, role: Role) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Dev defaults — will be removed once real auth is connected
const DEV_USER: User = {
  id: "dev-user-001",
  email: "admin@clinicovia.com",
  firstName: "Ahmad",
  lastName: "Al-Rashid",
  isVerified: true,
  isSuperAdmin: true,
};

const DEV_CLINIC: Clinic = {
  id: "dev-clinic-001",
  name: "Dubai Aesthetic Clinic",
  slug: "dubai-aesthetic",
  plan: "professional",
  status: "active",
};

const DEV_ROLE: Role = "clinic_owner";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentClinic: null,
      currentRole: null,
      memberships: [],

      setAuth: (user, accessToken, refreshToken, memberships) => {
        const firstMembership = memberships[0];
        set({
          user,
          accessToken,
          refreshToken,
          memberships,
          currentClinic: firstMembership?.clinic || null,
          currentRole: firstMembership?.role || null,
        });
      },

      setCurrentClinic: (clinic, role) => {
        set({ currentClinic: clinic, currentRole: role });
      },

      updateTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentClinic: null,
          currentRole: null,
          memberships: [],
        });
      },

      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: "clinicovia-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentClinic: state.currentClinic,
        currentRole: state.currentRole,
        memberships: state.memberships,
      }),
    }
  )
);
