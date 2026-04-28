"use client";

import { Loader2, Mail, UserCheck, Users } from "lucide-react";
import { useTeamMembers } from "@/lib/api/whatsapp";

export default function TeamManagementPage() {
  const { data, isLoading, isError } = useTeamMembers();
  const members = data?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Team Management</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Active clinic members available for WhatsApp conversation assignment.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-white py-16">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Failed to load team members.
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <Users className="mx-auto h-9 w-9 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">No active team members</p>
          <p className="mt-1 text-xs text-text-muted">Invite staff to start assigning conversations.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{member.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-muted">
                    <Mail className="h-3 w-3" />
                    {member.email}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium uppercase text-text-secondary">
                {member.role.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
