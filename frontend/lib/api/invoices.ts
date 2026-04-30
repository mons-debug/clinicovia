import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ──────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "cancelled" | "refunded";
export type PaymentMethod = "cash" | "card" | "transfer" | "cheque" | "other";

export interface InvoiceLineItem {
  label: string;
  quantity: number;
  unit_price: number;
  total?: number;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  received_by: string | null;
  amount: number;
  method: PaymentMethod;
  kind: "payment" | "refund";
  reference: string | null;
  note: string | null;
  received_at: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  clinic_id: string;
  patient_id: string;
  plan_id: string | null;
  issued_by: string | null;
  number: string;
  issue_date: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  tva_rate: number;
  tva: number;
  total: number;
  total_paid: number;
  currency: string;
  status: InvoiceStatus;
  issued_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  payments: InvoicePayment[];
}

export interface InvoiceCreateInput {
  patient_id: string;
  plan_id?: string | null;
  issue_date?: string;
  line_items: { label: string; quantity: number; unit_price: number }[];
  discount?: number;
  tva_rate?: number;
  currency?: string;
  notes?: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────

export function useInvoices(params: { patientId?: string; status?: string } = {}) {
  const token = useAuthStore((s) => s.accessToken);
  const qs = new URLSearchParams();
  if (params.patientId) qs.set("patient_id", params.patientId);
  if (params.status) qs.set("status_filter", params.status);
  const url = qs.toString() ? `/invoices?${qs}` : "/invoices";
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () =>
      apiClient<{ invoices: Invoice[]; total: number }>(url, { token: token ?? undefined }),
  });
}

export function useInvoice(invoiceId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () =>
      apiClient<Invoice>(`/invoices/${invoiceId}`, { token: token ?? undefined }),
    enabled: !!invoiceId,
  });
}

export function useCreateInvoice() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceCreateInput) =>
      apiClient<Invoice>("/invoices", {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useIssueInvoice(invoiceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<Invoice>(`/invoices/${invoiceId}/issue`, {
        method: "POST",
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
    },
  });
}

export function useRecordPayment(invoiceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; method: PaymentMethod; reference?: string; note?: string }) =>
      apiClient<InvoicePayment>(`/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
    },
  });
}

export function useCancelInvoice(invoiceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      apiClient<Invoice>(`/invoices/${invoiceId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
    },
  });
}
