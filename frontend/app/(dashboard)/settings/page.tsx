"use client";

import Link from "next/link";
import {
  Building2,
  Users,
  MessageSquare,
  Kanban,
  Plug,
  Bot,
  Bell,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
}

const settingCards: SettingCard[] = [
  {
    title: "Clinic Profile",
    description: "Manage your clinic info, logo, and branding",
    href: "/settings/clinic",
    icon: Building2,
    iconColor: "var(--primary)",
    iconBgColor: "#E0F2FE",
  },
  {
    title: "Team Management",
    description: "Invite members, assign roles and permissions",
    href: "/settings/team",
    icon: Users,
    iconColor: "#3EC8A0",
    iconBgColor: "#ECFDF5",
  },
  {
    title: "WhatsApp Connection",
    description: "Connect WhatsApp, scan QR code",
    href: "/settings/whatsapp",
    icon: MessageSquare,
    iconColor: "#22C55E",
    iconBgColor: "#F0FDF4",
  },
  {
    title: "Pipeline Config",
    description: "Customize pipeline stages and settings",
    href: "/settings/pipeline",
    icon: Kanban,
    iconColor: "#8B5CF6",
    iconBgColor: "#F5F3FF",
  },
  {
    title: "Integrations",
    description: "Connect pixels, ad platforms, and APIs",
    href: "/settings/integrations",
    icon: Plug,
    iconColor: "#F59E0B",
    iconBgColor: "#FFFBEB",
  },
  {
    title: "AI Configuration",
    description: "Configure AI agent behavior and knowledge",
    href: "/settings/ai-config",
    icon: Bot,
    iconColor: "var(--primary)",
    iconBgColor: "#E0F2FE",
  },
  {
    title: "Notifications",
    description: "Manage notification preferences",
    href: "/settings/notifications",
    icon: Bell,
    iconColor: "#EF4444",
    iconBgColor: "#FEF2F2",
  },
  {
    title: "Billing",
    description: "Manage subscription and payments",
    href: "/settings/billing",
    icon: CreditCard,
    iconColor: "var(--primary)",
    iconBgColor: "#E0F2FE",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your clinic configuration, team, integrations, and preferences.
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: card.iconBgColor }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: card.iconColor }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {card.title}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
