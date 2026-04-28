"use client";

import { useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useForm as useFormData, useFormSubmissions } from "@/lib/api/forms";

export default function FormSubmissionsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: form } = useFormData(id);
  const { data, isLoading, isError, error } = useFormSubmissions(id, page);

  const submissions = data?.submissions ?? [];
  const total = data?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const fields = form?.schema?.fields ?? [];
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f.label]));

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-text-muted" /><span className="ml-2 text-sm text-text-secondary">Loading...</span></div>;

  if (isError) return (
    <div className="space-y-6">
      <Link href={`/forms/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load"}</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href={`/forms/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Form
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Submissions</h1>
        <p className="mt-0.5 text-sm text-text-secondary">{form?.title} - {total} total submissions</p>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <p className="text-sm text-text-secondary">No submissions yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary w-8"></th>
                  {fields.slice(0, 5).map((f) => (
                    <th key={f.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{f.label}</th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub) => (
                  <>
                    <tr key={sub.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}>
                      <td className="px-4 py-3">
                        {expandedId === sub.id ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                      </td>
                      {fields.slice(0, 5).map((f) => (
                        <td key={f.id} className="px-4 py-3 text-text-primary max-w-[200px] truncate">
                          {String(sub.data[f.id] ?? "--")}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-text-secondary text-xs tabular-nums">
                        {new Date(sub.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                    {expandedId === sub.id && (
                      <tr key={`${sub.id}-detail`}>
                        <td colSpan={fields.slice(0, 5).length + 2} className="bg-gray-50 px-6 py-4">
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(sub.data).map(([fieldId, value]) => (
                              <div key={fieldId}>
                                <p className="text-xs text-text-muted">{fieldMap[fieldId] || fieldId}</p>
                                <p className="mt-0.5 text-sm text-text-primary">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                          {sub.patient_id && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <Link href={`/patients/${sub.patient_id}`} className="text-xs font-medium hover:underline" style={{ color: "var(--primary-light)" }}>
                                View linked patient
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-text-secondary">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">Prev</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-gray-100 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
