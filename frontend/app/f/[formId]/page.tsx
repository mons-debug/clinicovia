"use client";

import { use, useState, useEffect, FormEvent } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { PixelScripts, fireClientConversion } from "@/components/tracking/pixel-scripts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COUNTRY_CODES = [
  { code: "+971", label: "UAE (+971)" },
  { code: "+966", label: "SA (+966)" },
  { code: "+974", label: "QA (+974)" },
  { code: "+973", label: "BH (+973)" },
  { code: "+968", label: "OM (+968)" },
  { code: "+965", label: "KW (+965)" },
  { code: "+962", label: "JO (+962)" },
  { code: "+961", label: "LB (+961)" },
  { code: "+20", label: "EG (+20)" },
  { code: "+212", label: "MA (+212)" },
  { code: "+91", label: "IN (+91)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+1", label: "US (+1)" },
];

type FieldOption = string | { label: string; value: string };

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: FieldOption[];
  validation?: Record<string, unknown>;
}

interface FormSchema {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  settings: {
    submitButtonText?: string;
    submitButtonColor?: string;
    successMessage?: string;
  };
}

export default function PublicFormPage(props: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = use(props.params);

  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pixels, setPixels] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchForm() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/public/forms/${formId}`
        );
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        // The API returns { id, title, description, schema: { fields, settings } }
        // We store the inner schema object which has .fields and .settings
        const formSchema = data.schema || data;
        // Also store title/description from the outer object
        formSchema.title = data.title || formSchema.title;
        formSchema.description = data.description || formSchema.description;
        setSchema(formSchema);

        // Initialize default country codes for phone/whatsapp fields
        const initialCodes: Record<string, string> = {};
        for (const field of (formSchema.fields || [])) {
          if (field.type === "phone" || field.type === "whatsapp") {
            initialCodes[field.id] = "+971";
          }
        }
        setCountryCodes(initialCodes);

        // Load tracking pixels for this clinic
        if (data.clinic_id) {
          try {
            const pixelRes = await fetch(`${API_BASE_URL}/api/v1/tracking/public/pixels/${data.clinic_id}`);
            if (pixelRes.ok) {
              const pixelData = await pixelRes.json();
              setPixels(pixelData.pixels || {});
            }
          } catch {
            // Pixels are non-critical
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchForm();
  }, [formId]);

  function setValue(fieldId: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  function toggleMultiValue(fieldId: string, option: string) {
    setFormData((prev) => {
      const current = (prev[fieldId] as string[]) || [];
      if (current.includes(option)) {
        return { ...prev, [fieldId]: current.filter((v) => v !== option) };
      }
      return { ...prev, [fieldId]: [...current, option] };
    });
  }

  function validate(): boolean {
    if (!schema) return false;
    const newErrors: Record<string, string> = {};

    for (const field of schema.fields) {
      if (field.type === "heading" || field.type === "paragraph" || field.type === "button") continue;

      const value = formData[field.id];

      if (field.required) {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newErrors[field.id] = "This field is required";
          continue;
        }
      }

      if (field.type === "email" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value as string)) {
          newErrors[field.id] = "Please enter a valid email address";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || !schema) return;

    // Prepend country codes to phone/whatsapp values
    const submitData = { ...formData };
    for (const field of schema.fields) {
      if (
        (field.type === "phone" || field.type === "whatsapp") &&
        submitData[field.id]
      ) {
        const code = countryCodes[field.id] || "+971";
        submitData[field.id] = `${code}${submitData[field.id]}`;
      }
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/public/forms/${formId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: submitData }),
        }
      );
      if (!res.ok) {
        throw new Error("Submission failed");
      }
      setSubmitted(true);
      // Fire client-side conversion pixels
      fireClientConversion(pixels);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // --- Not Found ---
  if (notFound || !schema) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h1 className="text-xl font-semibold text-gray-700">
            This form is not available
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            The form you are looking for may have been removed or is no longer
            active.
          </p>
        </div>
      </div>
    );
  }

  // --- Submitted ---
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-semibold text-gray-800">
            {schema.settings.successMessage || "Thank you for your submission!"}
          </h2>
          <p className="mt-4 text-xs text-gray-400">Powered by Clinicovia</p>
        </div>
      </div>
    );
  }

  const submitBtnColor = schema.settings.submitButtonColor || "#2563eb";
  const submitBtnText = schema.settings.submitButtonText || "Submit";

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12">
      {/* Inject tracking pixels */}
      {Object.keys(pixels).length > 0 && <PixelScripts pixels={pixels} />}

      <div className="w-full max-w-2xl">
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{schema.title}</h1>
          {schema.description && (
            <p className="mt-2 text-sm text-gray-500">{schema.description}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
            {schema.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={formData[field.id]}
                countryCode={countryCodes[field.id]}
                error={errors[field.id]}
                onChange={(val) => setValue(field.id, val)}
                onToggleMulti={(opt) => toggleMultiValue(field.id, opt)}
                onCountryCodeChange={(code) =>
                  setCountryCodes((prev) => ({ ...prev, [field.id]: code }))
                }
              />
            ))}

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: submitBtnColor }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                submitBtnText
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by Clinicovia
        </p>
      </div>
    </div>
  );
}

// --- Field Renderer ---

function FieldRenderer({
  field,
  value,
  countryCode,
  error,
  onChange,
  onToggleMulti,
  onCountryCodeChange,
}: {
  field: FormField;
  value: unknown;
  countryCode?: string;
  error?: string;
  onChange: (val: unknown) => void;
  onToggleMulti: (opt: string) => void;
  onCountryCodeChange: (code: string) => void;
}) {
  const inputClasses =
    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";
  const errorInputClasses =
    "w-full rounded-lg border border-red-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none";

  const classes = error ? errorInputClasses : inputClasses;

  // --- Heading ---
  if (field.type === "heading") {
    return (
      <h2 className="text-lg font-semibold text-gray-800">{field.label}</h2>
    );
  }

  // --- Paragraph ---
  if (field.type === "paragraph") {
    return <p className="text-sm text-gray-600">{field.label}</p>;
  }

  // --- Button ---
  if (field.type === "button") {
    const btnColor = (field.validation as Record<string, string>)?.buttonColor || "#3EC8A0";
    const btnStyle = (field.validation as Record<string, string>)?.buttonStyle || "filled";
    const btnSize = (field.validation as Record<string, string>)?.buttonSize || "full";
    return (
      <div className={btnSize === "half" ? "max-w-[50%]" : btnSize === "auto" ? "inline-block" : ""}>
        <button
          type="submit"
          className="px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            width: btnSize === "full" ? "100%" : btnSize === "half" ? "100%" : "auto",
            backgroundColor: btnStyle === "outline" ? "transparent" : btnColor,
            color: btnStyle === "outline" ? btnColor : "#ffffff",
            border: `2px solid ${btnColor}`,
            borderRadius: btnStyle === "rounded" ? "9999px" : "8px",
          }}
        >
          {field.label}
        </button>
      </div>
    );
  }

  const label = (
    <label className="mb-1.5 block text-sm font-medium text-gray-700">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const helpText = field.helpText ? (
    <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
  ) : null;

  const errorText = error ? (
    <p className="mt-1 text-xs text-red-500">{error}</p>
  ) : null;

  // --- Text ---
  if (field.type === "text") {
    return (
      <div>
        {label}
        <input
          type="text"
          className={classes}
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Textarea ---
  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea
          className={classes}
          rows={4}
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Email ---
  if (field.type === "email") {
    return (
      <div>
        {label}
        <input
          type="email"
          className={classes}
          placeholder={field.placeholder || "email@example.com"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Phone / WhatsApp ---
  if (field.type === "phone" || field.type === "whatsapp") {
    return (
      <div>
        {label}
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            value={countryCode || "+971"}
            onChange={(e) => onCountryCodeChange(e.target.value)}
          >
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code}>
                {cc.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            className={classes}
            placeholder={field.placeholder || "5XXXXXXXX"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Number ---
  if (field.type === "number") {
    return (
      <div>
        {label}
        <input
          type="number"
          className={classes}
          placeholder={field.placeholder}
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Date ---
  if (field.type === "date") {
    return (
      <div>
        {label}
        <input
          type="date"
          className={classes}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Time ---
  if (field.type === "time") {
    return (
      <div>
        {label}
        <input
          type="time"
          className={classes}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Select ---
  if (field.type === "select") {
    return (
      <div>
        {label}
        <select
          className={classes}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {field.options?.map((opt) => (
            <option key={typeof opt === "object" ? opt.value : opt} value={typeof opt === "object" ? opt.value : opt}>
              {typeof opt === "object" ? opt.label : opt}
            </option>
          ))}
        </select>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Multi Select ---
  if (field.type === "multi_select") {
    const selected = (value as string[]) || [];
    return (
      <div>
        {label}
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={typeof opt === "object" ? opt.value : opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selected.includes(typeof opt === "object" ? opt.value : opt)}
                onChange={() => onToggleMulti(typeof opt === "object" ? opt.value : opt)}
              />
              {typeof opt === "object" ? opt.label : opt}
            </label>
          ))}
        </div>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Checkbox ---
  if (field.type === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Checkbox Group ---
  if (field.type === "checkbox_group") {
    const selected = (value as string[]) || [];
    return (
      <div>
        {label}
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={typeof opt === "object" ? opt.value : opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selected.includes(typeof opt === "object" ? opt.value : opt)}
                onChange={() => onToggleMulti(typeof opt === "object" ? opt.value : opt)}
              />
              {typeof opt === "object" ? opt.label : opt}
            </label>
          ))}
        </div>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Radio ---
  if (field.type === "radio") {
    return (
      <div>
        {label}
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={typeof opt === "object" ? opt.value : opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={field.id}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={value === (typeof opt === "object" ? opt.value : opt)}
                onChange={() => onChange(typeof opt === "object" ? opt.value : opt)}
              />
              {typeof opt === "object" ? opt.label : opt}
            </label>
          ))}
        </div>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- File (disabled) ---
  if (field.type === "file") {
    return (
      <div>
        {label}
        <input
          type="file"
          className={classes}
          disabled
        />
        <p className="mt-1 text-xs text-gray-400">File upload coming soon</p>
        {helpText}
        {errorText}
      </div>
    );
  }

  // --- Fallback ---
  return null;
}
