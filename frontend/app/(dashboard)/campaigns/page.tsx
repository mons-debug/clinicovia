"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Megaphone,
  Send,
  CheckCheck,
  Eye,
  MessageSquare,
  Calendar,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Mail,
} from "lucide-react";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";

interface Campaign {
  id: string;
  name: string;
  type: "WhatsApp" | "SMS" | "Email";
  status: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  scheduledAt: string | null;
  createdAt: string;
}

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    name: "Ramadan Special",
    type: "WhatsApp",
    status: "Completed",
    sent: 1200,
    delivered: 1150,
    read: 980,
    replied: 145,
    scheduledAt: null,
    createdAt: "2026-03-01T08:00:00Z",
  },
  {
    id: "2",
    name: "Summer Glow Package",
    type: "WhatsApp",
    status: "Active",
    sent: 850,
    delivered: 820,
    read: 610,
    replied: 89,
    scheduledAt: null,
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "3",
    name: "Follow-up Campaign",
    type: "SMS",
    status: "Active",
    sent: 430,
    delivered: 415,
    read: 320,
    replied: 52,
    scheduledAt: null,
    createdAt: "2026-03-25T14:00:00Z",
  },
  {
    id: "4",
    name: "New Patient Welcome",
    type: "Email",
    status: "Scheduled",
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    scheduledAt: "2026-04-10T09:00:00Z",
    createdAt: "2026-04-01T11:00:00Z",
  },
  {
    id: "5",
    name: "VIP Exclusive",
    type: "WhatsApp",
    status: "Draft",
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    scheduledAt: null,
    createdAt: "2026-04-05T16:00:00Z",
  },
];

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  WhatsApp: { bg: "bg-emerald-50", text: "text-emerald-700" },
  SMS: { bg: "bg-blue-50", text: "text-blue-700" },
  Email: { bg: "bg-amber-50", text: "text-amber-700" },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  WhatsApp: MessageSquare,
  SMS: Send,
  Email: Mail,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
}

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Draft" },
];

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState("all");

  const filteredCampaigns = useMemo(() => {
    if (activeTab === "all") return MOCK_CAMPAIGNS;
    return MOCK_CAMPAIGNS.filter(
      (c) => c.status.toLowerCase() === activeTab
    );
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Campaigns</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Send targeted messages to your patients via WhatsApp, SMS, or email.
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Tab Filter */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCampaigns.map((campaign) => {
          const deliveryRate =
            campaign.sent > 0
              ? Math.round((campaign.delivered / campaign.sent) * 100)
              : 0;
          const typeStyle = TYPE_STYLES[campaign.type];
          const TypeIcon = TYPE_ICONS[campaign.type];

          return (
            <div
              key={campaign.id}
              className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Top: name + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    {campaign.name}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${typeStyle.bg} ${typeStyle.text}`}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {campaign.type}
                    </span>
                    <StatusBadge
                      status={campaign.status}
                      variant={getStatusVariant(campaign.status)}
                      dot
                    />
                  </div>
                </div>
                <button className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Stats Row */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: "Sent", value: campaign.sent, icon: Send },
                  { label: "Delivered", value: campaign.delivered, icon: CheckCheck },
                  { label: "Read", value: campaign.read, icon: Eye },
                  { label: "Replied", value: campaign.replied, icon: MessageSquare },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <stat.icon className="mx-auto h-3.5 w-3.5 text-text-muted" />
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {formatNumber(stat.value)}
                    </p>
                    <p className="text-[10px] text-text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Delivery Rate</span>
                  <span className="font-medium text-text-primary">
                    {campaign.sent > 0 ? `${deliveryRate}%` : "--"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${deliveryRate}%`,
                      backgroundColor: "var(--primary-light)",
                    }}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-border" />

              {/* Footer: date + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  {campaign.scheduledAt ? (
                    <span>Scheduled {formatDate(campaign.scheduledAt)}</span>
                  ) : (
                    <span>Created {formatDate(campaign.createdAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
