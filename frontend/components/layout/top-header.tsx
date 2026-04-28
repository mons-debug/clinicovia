"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Plus, Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";

function getBreadcrumb(pathname: string): { title: string; breadcrumb: string } {
  const segments = pathname.split("/").filter(Boolean);
  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    patients: "Patients",
    pipeline: "Pipeline",
    whatsapp: "WhatsApp",
    "ai-agents": "AI Agents",
    forms: "Forms",
    campaigns: "Campaigns",
    appointments: "Appointments",
    analytics: "Analytics",
    settings: "Settings",
    admin: "Admin",
  };

  const first = segments[0] || "dashboard";
  const title = titles[first] || first.charAt(0).toUpperCase() + first.slice(1);
  const breadcrumb = ["Home", ...segments.map((s) => titles[s] || s)].join(" / ");

  return { title, breadcrumb };
}

export function TopHeader() {
  const pathname = usePathname();
  const { title, breadcrumb } = getBreadcrumb(pathname);
  const { setSidebarMobileOpen } = useUIStore();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-6">
      {/* Left — Title + Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary lg:hidden"
          onClick={() => setSidebarMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-text-primary">{title}</h1>
          <p className="text-xs text-text-muted">{breadcrumb}</p>
        </div>
      </div>

      {/* Center — Search */}
      <div className="hidden md:flex max-w-sm flex-1 mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search patients, conversations..."
            className="w-full rounded-lg border border-border bg-gray-50 py-2 pl-10 pr-12 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "var(--danger)" }}>
            3
          </span>
        </button>

        {/* Quick Add */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* User Avatar */}
        <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)" }}>
          {user?.firstName?.[0] || "U"}
          {user?.lastName?.[0] || ""}
        </div>
      </div>
    </header>
  );
}
