"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  MessageSquare,
  Server,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Clinics", href: "/admin/clinics", icon: Building2 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "WhatsApp Health", href: "/admin/whatsapp-health", icon: MessageSquare },
  { label: "System Health", href: "/admin/system", icon: Server },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-border bg-white">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Shield className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <div>
            <p className="text-sm font-bold text-text-primary">Clinicovia Admin</p>
            <p className="text-[10px] text-text-muted">Super Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {ADMIN_NAV.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-lighter/30 text-primary"
                        : "text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Back to app */}
        <div className="border-t border-border p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-gray-50 hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-[240px] flex-1">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
