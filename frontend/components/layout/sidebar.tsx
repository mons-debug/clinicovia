"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserCog,
  Kanban,
  Plus,
  MessageSquare,
  Radio,
  FileStack,
  Sparkles,
  Bot,
  BrainCircuit,
  BookOpen,
  MessageCircle,
  FileText,
  FilePlus,
  ClipboardList,
  Megaphone,
  PlusCircle,
  Stethoscope,
  Calendar,
  CalendarPlus,
  List,
  BarChart2,
  DollarSign,
  TrendingUp,
  PieChart,
  Cpu,
  Globe,
  Settings,
  Building2,
  UserCog2,
  Plug,
  Bell,
  CreditCard,
  Workflow,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

interface SubItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
  badge?: number;
  dotColor?: string;
  children?: SubItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    label: "Patients",
    href: "/patients",
    icon: Users,
    module: "patients",
    children: [
      { label: "All Patients", href: "/patients", icon: Users },
      { label: "Add Patient", href: "/patients/new", icon: UserPlus },
    ],
  },
  {
    label: "Salle d'attente",
    href: "/queue",
    icon: ClipboardList,
    module: "queue",
  },
  {
    label: "Calendrier",
    href: "/calendar",
    icon: Calendar,
    module: "calendar",
  },
  {
    label: "Factures",
    href: "/invoices",
    icon: FileText,
    module: "invoices",
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    module: "pipeline",
    children: [
      { label: "Board", href: "/pipeline", icon: Kanban },
      { label: "New Deal", href: "/pipeline/deals/new", icon: Plus },
    ],
  },
  {
    label: "WhatsApp",
    href: "/whatsapp",
    icon: MessageSquare,
    module: "whatsapp",
    dotColor: "#25D366",
    children: [
      { label: "Inbox", href: "/whatsapp", icon: MessageSquare },
      { label: "Broadcast", href: "/whatsapp/broadcast", icon: Radio },
      { label: "Templates", href: "/whatsapp/templates", icon: FileStack },
    ],
  },
  {
    label: "AI Agents",
    href: "/ai-agents",
    icon: Sparkles,
    module: "ai_agents",
    children: [
      { label: "All Agents", href: "/ai-agents", icon: Bot },
      { label: "Conversations", href: "/ai-agents/conversations", icon: MessageCircle },
      { label: "Knowledge Base", href: "/ai-agents/knowledge-base", icon: BookOpen },
    ],
  },
  {
    label: "Forms",
    href: "/forms",
    icon: FileText,
    module: "forms",
    children: [
      { label: "All Forms", href: "/forms", icon: ClipboardList },
      { label: "Create Form", href: "/forms/new", icon: FilePlus },
    ],
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
    module: "campaigns",
    children: [
      { label: "All Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "New Campaign", href: "/campaigns/new", icon: PlusCircle },
    ],
  },
  {
    label: "Doctors",
    href: "/doctors",
    icon: Stethoscope,
    module: "doctors",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart2,
    module: "analytics",
    children: [
      { label: "Overview", href: "/analytics", icon: BarChart2 },
      { label: "Revenue", href: "/analytics/revenue", icon: DollarSign },
      { label: "Conversions", href: "/analytics/conversions", icon: TrendingUp },
      { label: "Sources", href: "/analytics/sources", icon: Globe },
      { label: "Campaigns", href: "/analytics/campaigns", icon: PieChart },
      { label: "AI Agents", href: "/analytics/agents", icon: Cpu },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    module: "settings",
    children: [
      { label: "General", href: "/settings", icon: Settings },
      { label: "Clinic Profile", href: "/settings/clinic", icon: Building2 },
      { label: "Team", href: "/settings/team", icon: UserCog2 },
      { label: "WhatsApp", href: "/settings/whatsapp", icon: MessageSquare },
      { label: "Pipeline", href: "/settings/pipeline", icon: Workflow },
      { label: "Integrations", href: "/settings/integrations", icon: Plug },
      { label: "AI Config", href: "/settings/ai-config", icon: BrainCircuit },
      { label: "Notifications", href: "/settings/notifications", icon: Bell },
      { label: "Billing", href: "/settings/billing", icon: CreditCard },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const router = useRouter();
  const { user, currentClinic, currentRole, logout } = useAuthStore();
  const { canAccessModule } = usePermissions();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Track which groups are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Auto-expand the group that contains the current path
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      if (group.children) {
        const isActive = pathname === group.href || pathname.startsWith(group.href + "/");
        if (isActive) initial[group.label] = true;
      }
    }
    return initial;
  });

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredGroups = NAV_GROUPS.filter((item) =>
    canAccessModule(item.module as Parameters<typeof canAccessModule>[0])
  );

  const isGroupActive = (group: NavGroup) =>
    pathname === group.href || pathname.startsWith(group.href + "/");

  const isSubActive = (href: string) => pathname === href;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
        sidebarCollapsed ? "w-[68px]" : "w-[264px]"
      )}
      style={{ backgroundColor: "#0D4F6C" }}
    >
      {/* Logo / Clinic Name */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          className={cn(
            "flex shrink-0 items-center overflow-hidden",
            sidebarCollapsed ? "h-9 w-9 justify-start" : "w-36"
          )}
          title="Clinicovia dashboard"
        >
          <Image
            src="/whitelogo.webp"
            alt="Clinicovia"
            width={144}
            height={36}
            priority
            className="h-auto max-h-9 w-36 max-w-none object-contain object-left"
          />
        </Link>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs text-white/50">
              {currentClinic?.name || "Dashboard"}
            </p>
            <p className="truncate text-[10px] text-white/35">
              {currentRole?.replace("_", " ") || "Dashboard"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <ul className="space-y-0.5">
          {filteredGroups.map((group) => {
            const active = isGroupActive(group);
            const Icon = group.icon;
            const hasChildren = group.children && group.children.length > 0;
            const isExpanded = expanded[group.label] ?? false;

            return (
              <li key={group.label}>
                {/* Group header */}
                {hasChildren && !sidebarCollapsed ? (
                  <button
                    onClick={() => toggleExpand(group.label)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/60 hover:bg-white/6 hover:text-white"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon className="h-[18px] w-[18px]" />
                      {group.dotColor && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0D4F6C]"
                          style={{ backgroundColor: group.dotColor }}
                        />
                      )}
                    </div>
                    <span className="flex-1 text-left">{group.label}</span>
                    {group.badge && (
                      <span className="mr-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                        {group.badge}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                ) : (
                  <Link
                    href={group.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/60 hover:bg-white/6 hover:text-white"
                    )}
                    title={sidebarCollapsed ? group.label : undefined}
                  >
                    <div className="relative shrink-0">
                      <Icon className="h-[18px] w-[18px]" />
                      {group.dotColor && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0D4F6C]"
                          style={{ backgroundColor: group.dotColor }}
                        />
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{group.label}</span>
                        {group.badge && (
                          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                            {group.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )}

                {/* Sub-items (expanded dropdown) */}
                {hasChildren && !sidebarCollapsed && isExpanded && (
                  <ul className="mt-0.5 space-y-0.5 pb-1">
                    {group.children!.map((sub) => {
                      const SubIcon = sub.icon;
                      const subActive = isSubActive(sub.href);

                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg py-1.5 pl-10 pr-3 text-[13px] font-medium transition-all",
                              subActive
                                ? "bg-white/10 text-white"
                                : "text-white/45 hover:bg-white/5 hover:text-white/80"
                            )}
                          >
                            <SubIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{sub.label}</span>
                            {subActive && (
                              <span
                                className="ml-auto h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: "#3EC8A0" }}
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {/* Admin link — only for super admins */}
        {user?.isSuperAdmin && !sidebarCollapsed && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              Admin
            </p>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                pathname.startsWith("/admin")
                  ? "bg-white/12 text-white"
                  : "text-white/60 hover:bg-white/6 hover:text-white"
              )}
            >
              <Shield className="h-[18px] w-[18px]" />
              <span>Super Admin</span>
            </Link>
          </div>
        )}
        {user?.isSuperAdmin && sidebarCollapsed && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <Link
              href="/admin"
              className={cn(
                "flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all",
                pathname.startsWith("/admin")
                  ? "bg-white/12 text-white"
                  : "text-white/60 hover:bg-white/6 hover:text-white"
              )}
              title="Super Admin"
            >
              <Shield className="h-[18px] w-[18px]" />
            </Link>
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-white/10 p-3">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-white/50 capitalize">
                {currentRole?.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1 text-white/40 transition-colors hover:text-white"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center rounded-md p-2 text-white/40 transition-colors hover:text-white"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#0D4F6C] text-white shadow-md transition-colors hover:bg-[#0a3f57]"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
