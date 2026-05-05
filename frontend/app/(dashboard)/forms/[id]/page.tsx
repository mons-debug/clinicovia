"use client";

import Link from "next/link";
import { use } from "react";
import { useState } from "react";
import { ArrowLeft, Pencil, Eye, Link2, ExternalLink, Loader2, AlertCircle, ClipboardList, Code2, Copy, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { useForm } from "@/lib/api/forms";

export default function FormDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: form, isLoading, isError, error } = useForm(id);
  const [embedHeight, setEmbedHeight] = useState("600");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const copyLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Form link copied");
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-text-muted" /><span className="ml-2 text-sm text-text-secondary">Loading...</span></div>;

  if (isError || !form) return (
    <div className="space-y-6">
      <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{error instanceof Error ? error.message : "Form not found"}</p></div>
    </div>
  );

  const formFields = form.schema?.fields ?? [];
  const formSettings = Object.assign({
    formBackground: "#ffffff",
    labelColor: "#1E293B",
    borderRadius: "8",
    showBranding: true,
    submitButtonText: "Submit",
    submitButtonColor: "#3EC8A0",
  }, form.schema?.settings ?? {});
  const fieldCount = formFields.length;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Forms
      </Link>

      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-text-primary">{form.title}</h1>
              <StatusBadge status={form.status.charAt(0).toUpperCase() + form.status.slice(1)} variant={getStatusVariant(form.status)} dot />
            </div>
            {form.description && <p className="mt-2 text-sm text-text-secondary">{form.description}</p>}
          </div>
          <div className="flex gap-2">
            <Link href={`/forms/${id}/edit`} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <Link href={`/forms/${id}/submissions`} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
              <Eye className="h-4 w-4" /> Submissions
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Status", value: form.status.charAt(0).toUpperCase() + form.status.slice(1) },
            { label: "Fields", value: String(fieldCount) },
            { label: "Submissions", value: String(form.submission_count) },
            { label: "Created", value: new Date(form.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-text-muted">{s.label}</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Public URL */}
      {(form.status === "active" || form.status === "draft") && (
        <div className="rounded-xl border border-border bg-white p-5">
          {form.status === "draft" && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-700">This form is in Draft mode. Set it to Active to make the public link work.</p>
            </div>
          )}
          <h3 className="text-base font-semibold text-text-primary">Public Link</h3>
          <div className="mt-3 flex items-center gap-3">
            <code className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-text-secondary">{publicUrl}</code>
            <button onClick={copyLink} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
              <Link2 className="h-4 w-4" /> Copy
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary-light)" }}>
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          </div>
        </div>
      )}

      {/* Embed Code */}
      {(form.status === "active" || form.status === "draft") && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-text-muted" />
              <h3 className="text-base font-semibold text-text-primary">Embed Code</h3>
            </div>
          </div>
          <p className="mt-1 text-xs text-text-secondary">Copy and paste this code into your website to embed the form.</p>

          {/* Embed height control */}
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs font-medium text-text-primary">Height:</label>
            <input
              type="number"
              value={embedHeight}
              onChange={(e) => setEmbedHeight(e.target.value)}
              min="300"
              max="2000"
              className="w-20 rounded-lg border border-border px-2 py-1 text-sm focus:border-primary-light focus:outline-none"
            />
            <span className="text-xs text-text-muted">px</span>
          </div>

          {/* iframe embed */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary">iframe Embed</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`<iframe src="${publicUrl}" width="100%" height="${embedHeight}" frameborder="0" style="border:none;border-radius:12px;"></iframe>`);
                  toast.success("iframe code copied");
                }}
                className="flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: "var(--primary-light)" }}
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="rounded-lg bg-gray-900 p-3 text-xs text-green-400 overflow-x-auto">
              {`<iframe src="${publicUrl}" width="100%" height="${embedHeight}" frameborder="0" style="border:none;border-radius:12px;"></iframe>`}
            </pre>
          </div>

          {/* Script embed */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary">Script Embed (auto-resize)</span>
              <button
                onClick={() => {
                  const scriptCode = `<div id="clinicovia-form-${form.slug}"></div>\n<script>\n(function(){var d=document,f=d.getElementById("clinicovia-form-${form.slug}"),i=d.createElement("iframe");i.src="${publicUrl}";i.style="width:100%;border:none;border-radius:12px;";i.height="${embedHeight}";f.appendChild(i);})()\n</script>`;
                  navigator.clipboard.writeText(scriptCode);
                  toast.success("Script code copied");
                }}
                className="flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: "var(--primary-light)" }}
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="rounded-lg bg-gray-900 p-3 text-xs text-green-400 overflow-x-auto">
              {`<div id="clinicovia-form-${form.slug}"></div>\n<script>\n(function(){\n  var d=document,\n      f=d.getElementById("clinicovia-form-${form.slug}"),\n      i=d.createElement("iframe");\n  i.src="${publicUrl}";\n  i.style="width:100%;border:none;border-radius:12px;";\n  i.height="${embedHeight}";\n  f.appendChild(i);\n})()\n</script>`}
            </pre>
          </div>

          {/* Direct link */}
          <div className="mt-4">
            <span className="text-xs font-medium text-text-secondary">Direct Link</span>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-text-secondary break-all">{publicUrl}</code>
              <button onClick={copyLink} className="shrink-0 rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-gray-50">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Preview (inline — works for Draft and Active) */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Preview</h3>
          <div className="flex rounded-lg border border-border">
            <button
              onClick={() => setPreviewDevice("desktop")}
              className={`px-2.5 py-1 ${previewDevice === "desktop" ? "bg-gray-100 text-text-primary" : "text-text-muted"}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewDevice("mobile")}
              className={`px-2.5 py-1 ${previewDevice === "mobile" ? "bg-gray-100 text-text-primary" : "text-text-muted"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className={`mt-4 mx-auto ${previewDevice === "mobile" ? "max-w-[375px]" : "max-w-full"}`}>
          <div
            className="rounded-xl border border-border overflow-hidden p-8"
            style={{ backgroundColor: formSettings.formBackground || "#ffffff" }}
          >
            <h2 className="text-2xl font-bold" style={{ color: formSettings.labelColor || "#1E293B" }}>{form.title}</h2>
            {form.description && <p className="mt-2 text-sm text-text-secondary">{form.description}</p>}
            <div className="mt-6 space-y-5">
              {formFields.map((field) => {
                const labelColor = formSettings.labelColor || "#1E293B";
                const radius = formSettings.borderRadius || "8";

                if (field.type === "heading") return <h3 key={field.id} className="text-lg font-semibold" style={{ color: labelColor }}>{field.label}</h3>;
                if (field.type === "paragraph") return <p key={field.id} className="text-sm text-text-secondary">{field.label}</p>;
                if (field.type === "button") {
                  const bc = (field.validation as Record<string, string>)?.buttonColor || "#3EC8A0";
                  const bs = (field.validation as Record<string, string>)?.buttonStyle || "filled";
                  const bz = (field.validation as Record<string, string>)?.buttonSize || "full";
                  return (
                    <div key={field.id} className={bz === "half" ? "max-w-[50%]" : bz === "auto" ? "inline-block" : ""}>
                      <button disabled className="px-6 py-3 text-sm font-semibold" style={{
                        width: bz === "full" ? "100%" : bz === "half" ? "100%" : "auto",
                        backgroundColor: bs === "outline" ? "transparent" : bc,
                        color: bs === "outline" ? bc : "#fff",
                        border: `2px solid ${bc}`,
                        borderRadius: bs === "rounded" ? "9999px" : `${radius}px`,
                      }}>{field.label}</button>
                    </div>
                  );
                }

                return (
                  <div key={field.id}>
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: labelColor }}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea placeholder={field.placeholder} rows={3} className="w-full border border-border bg-white px-3 py-2.5 text-sm resize-none" style={{ borderRadius: `${radius}px` }} readOnly />
                    ) : field.type === "select" ? (
                      <select className="w-full border border-border bg-white px-3 py-2.5 text-sm" style={{ borderRadius: `${radius}px` }} disabled>
                        <option>{field.placeholder || "Select..."}</option>
                        {(field.options || []).map((o: { label: string; value: string }) => <option key={o.value}>{o.label}</option>)}
                      </select>
                    ) : field.type === "radio" ? (
                      <div className="space-y-2 mt-1">{(field.options || []).map((o: { label: string; value: string }) => <label key={o.value} className="flex items-center gap-2 text-sm"><input type="radio" disabled /> {o.label}</label>)}</div>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled /> {field.label}</label>
                    ) : (field.type === "checkbox_group" || field.type === "multi_select") ? (
                      <div className="space-y-2 mt-1">{(field.options || []).map((o: { label: string; value: string }) => <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled /> {o.label}</label>)}</div>
                    ) : field.type === "file" ? (
                      <div className="w-full border-2 border-dashed border-border px-3 py-6 text-center text-sm text-text-muted" style={{ borderRadius: `${radius}px` }}>Click or drag to upload</div>
                    ) : (
                      <input type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"} placeholder={field.placeholder} className="w-full border border-border bg-white px-3 py-2.5 text-sm" style={{ borderRadius: `${radius}px` }} readOnly />
                    )}
                    {field.helpText && <p className="mt-1 text-xs text-text-muted">{field.helpText}</p>}
                  </div>
                );
              })}
            </div>
            {formSettings.showBranding !== false && (
              <p className="mt-6 text-center text-[10px] text-text-muted">Powered by Clinicovia</p>
            )}
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-base font-semibold text-text-primary">Fields ({fieldCount})</h3>
        <div className="mt-4 space-y-2">
          {(form.schema?.fields ?? []).map((field, i) => (
            <div key={field.id || i} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text-muted">{i + 1}</span>
                <span className="text-sm font-medium text-text-primary">{field.label}</span>
                {field.required && <span className="text-xs text-red-500">Required</span>}
              </div>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-secondary">{field.type}</span>
            </div>
          ))}
          {fieldCount === 0 && <p className="text-sm text-text-muted">No fields configured.</p>}
        </div>
      </div>
    </div>
  );
}
