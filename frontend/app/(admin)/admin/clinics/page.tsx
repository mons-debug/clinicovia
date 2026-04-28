"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import {
  Download,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";

interface AdminClinic {
  id: string;
  name: string;
  ownerName: string;
  plan: string;
  status: string;
  mrr: number;
  patients: number;
  waStatus: "connected" | "disconnected";
  messagestoday: number;
  signupDate: string;
  country: string;
}

const MOCK_CLINICS: AdminClinic[] = [
  { id: "1", name: "Dubai Aesthetic Clinic", ownerName: "Dr. Sarah Al-Mahmoud", plan: "Professional", status: "Active", mrr: 1000, patients: 1247, waStatus: "connected", messagestoday: 87, signupDate: "2025-08-15", country: "UAE" },
  { id: "2", name: "Riyadh Dental Center", ownerName: "Dr. Ahmad Khalil", plan: "Growth", status: "Active", mrr: 500, patients: 456, waStatus: "connected", messagestoday: 34, signupDate: "2025-11-20", country: "KSA" },
  { id: "3", name: "Cairo Skin Care", ownerName: "Dr. Noor Hassan", plan: "Growth", status: "Active", mrr: 500, patients: 312, waStatus: "disconnected", messagestoday: 0, signupDate: "2026-01-10", country: "Egypt" },
  { id: "4", name: "Istanbul Hair Clinic", ownerName: "Dr. Emre Yilmaz", plan: "Enterprise", status: "Active", mrr: 2000, patients: 2103, waStatus: "connected", messagestoday: 156, signupDate: "2025-06-05", country: "Turkey" },
  { id: "5", name: "Doha Wellness Center", ownerName: "Dr. Layla Al-Thani", plan: "Trial", status: "Trial", mrr: 0, patients: 23, waStatus: "connected", messagestoday: 5, signupDate: "2026-03-15", country: "Qatar" },
  { id: "6", name: "Kuwait Beauty Hub", ownerName: "Dr. Fatima Al-Sabah", plan: "Growth", status: "Suspended", mrr: 0, patients: 189, waStatus: "disconnected", messagestoday: 0, signupDate: "2025-10-01", country: "Kuwait" },
];

const columnHelper = createColumnHelper<AdminClinic>();

export default function ClinicsManagementPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredData = useMemo(() => {
    if (statusFilter === "all") return MOCK_CLINICS;
    return MOCK_CLINICS.filter((c) => c.status.toLowerCase() === statusFilter);
  }, [statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "clinic",
        header: "Clinic",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <Link href={`/admin/clinics/${c.id}`} className="group">
              <p className="text-sm font-medium text-text-primary group-hover:text-primary-light transition-colors">{c.name}</p>
              <p className="text-xs text-text-muted">{c.ownerName} &middot; {c.country}</p>
            </Link>
          );
        },
      }),
      columnHelper.accessor("plan", {
        header: "Plan",
        cell: (info) => (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} variant={getStatusVariant(info.getValue())} dot />,
      }),
      columnHelper.accessor("mrr", {
        header: "MRR",
        cell: (info) => <span className="text-sm font-medium">{info.getValue() > 0 ? `$${info.getValue()}` : "--"}</span>,
      }),
      columnHelper.accessor("patients", {
        header: "Patients",
        cell: (info) => <span className="text-sm">{info.getValue().toLocaleString()}</span>,
      }),
      columnHelper.accessor("waStatus", {
        header: "WhatsApp",
        cell: (info) => {
          const connected = info.getValue() === "connected";
          return (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-red-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
              {connected ? "Connected" : "Down"}
            </span>
          );
        },
      }),
      columnHelper.accessor("messagestoday", {
        header: "Msgs Today",
        cell: (info) => <span className="text-sm tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Link href={`/admin/clinics/${row.original.id}`} className="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-primary">
              <Eye className="h-4 w-4" />
            </Link>
            <button className="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-primary">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Clinics</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{MOCK_CLINICS.length} registered clinics</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {["all", "active", "trial", "suspended"].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              statusFilter === f ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filteredData} searchPlaceholder="Search clinics..." pageSize={10} />
    </div>
  );
}
