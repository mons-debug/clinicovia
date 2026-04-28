"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  MapPin,
  FileText,
  Tag,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { COUNTRY_CODES, LEAD_SOURCES } from "@/lib/constants";
import { useCreatePatient } from "@/lib/api/patients";
import { checkWhatsAppNumber } from "@/lib/api/whatsapp";

const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneCountryCode: z.string(),
  phone: z.string().min(1, "Phone number is required"),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  leadSource: z.string().optional(),
  treatmentInterests: z.string().optional(),
  internalNotes: z.string().optional(),
  tags: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export default function AddPatientPage() {
  const router = useRouter();
  const createMutation = useCreatePatient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [waCheck, setWaCheck] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [waJid, setWaJid] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      phoneCountryCode: "+971",
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    setServerError(null);
    try {
      await createMutation.mutateAsync({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || null,
        phone: data.phone,
        phone_country_code: data.phoneCountryCode,
        gender: data.gender || null,
        date_of_birth: data.dateOfBirth || null,
        city: data.city || null,
        country: data.country || null,
        address: data.address || null,
        lead_source: data.leadSource || null,
        treatment_interests: data.treatmentInterests || null,
        internal_notes: data.internalNotes || null,
        tags: data.tags
          ? data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
      });
      toast.success("Patient created successfully!");
      router.push("/patients");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create patient";
      setServerError(message);
      toast.error(message);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";
  const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
  const errorClass = "mt-1 text-xs text-red-500";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-xl font-bold text-text-primary">Add New Patient</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Fill in the patient details below
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          {/* Server error */}
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Personal Information */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Personal Information
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input {...register("firstName")} placeholder="First name" className={inputClass} />
                {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input {...register("lastName")} placeholder="Last name" className={inputClass} />
                {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select {...register("gender")} className={inputClass}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input type="date" {...register("dateOfBirth")} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Contact
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Phone *</label>
                <div className="flex gap-2">
                  <select
                    {...register("phoneCountryCode")}
                    onChange={(e) => {
                      register("phoneCountryCode").onChange(e);
                      setWaCheck("idle");
                      setWaJid(null);
                    }}
                    className="w-[90px] shrink-0 rounded-lg border border-border bg-white py-2.5 px-2 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <div className="relative min-w-0 flex-1">
                    <input
                      {...register("phone")}
                      type="tel"
                      placeholder="50 123 4567"
                      onChange={(e) => {
                        register("phone").onChange(e);
                        setWaCheck("idle");
                        setWaJid(null);
                      }}
                      className={`w-full rounded-lg border bg-white py-2.5 px-3 pr-9 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 ${
                        waCheck === "valid"
                          ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-200"
                          : waCheck === "invalid"
                            ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                            : "border-border focus:border-primary-light focus:ring-primary-light"
                      }`}
                    />
                    {waCheck === "valid" && (
                      <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    )}
                    {waCheck === "invalid" && (
                      <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
                    )}
                    {waCheck === "checking" && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const code = watch("phoneCountryCode");
                      const phone = watch("phone");
                      if (!phone) {
                        toast.error("Enter a phone number first");
                        return;
                      }
                      const fullPhone = `${code}${phone}`.replace(/\D/g, "");
                      setWaCheck("checking");
                      try {
                        const result = await checkWhatsAppNumber(fullPhone);
                        if (result.exists) {
                          setWaCheck("valid");
                          setWaJid(result.jid);
                          toast.success("WhatsApp number verified");
                        } else {
                          setWaCheck("invalid");
                          setWaJid(null);
                          toast.error("This number is not on WhatsApp");
                        }
                      } catch {
                        setWaCheck("idle");
                        toast.error("Could not verify — no WhatsApp connected");
                      }
                    }}
                    disabled={waCheck === "checking"}
                    className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    {waCheck === "checking" ? "..." : "Verify"}
                  </button>
                </div>
                {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                {waCheck === "valid" && (
                  <p className="mt-1 text-xs text-emerald-600">This number is registered on WhatsApp</p>
                )}
                {waCheck === "invalid" && (
                  <p className="mt-1 text-xs text-red-500">This number is not registered on WhatsApp</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Email</label>
                <input {...register("email")} type="email" placeholder="patient@email.com" className={inputClass} />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Location
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Country</label>
                <select {...register("country")} className={inputClass}>
                  <option value="">Select country</option>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.country} value={c.country}>{c.country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input {...register("city")} placeholder="City" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <input {...register("address")} placeholder="Street address" className={inputClass} />
              </div>
            </div>
          </section>

          {/* Lead Information */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Lead Information
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Lead Source</label>
                <select {...register("leadSource")} className={inputClass}>
                  <option value="">Select source</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Treatment Interests</label>
                <input
                  {...register("treatmentInterests")}
                  placeholder="e.g. Botox, Fillers, Laser"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tags</label>
                <input
                  {...register("tags")}
                  placeholder="Comma-separated tags"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Internal Notes
              </h2>
            </div>
            <textarea
              {...register("internalNotes")}
              rows={3}
              placeholder="Private notes about this patient..."
              className={`${inputClass} resize-none`}
            />
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Link
              href="/patients"
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Saving..." : "Save Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
