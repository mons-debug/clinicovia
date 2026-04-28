"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, User, Phone, MapPin, Tag, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { COUNTRY_CODES, LEAD_SOURCES } from "@/lib/constants";
import { usePatient, useUpdatePatient } from "@/lib/api/patients";

const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneCountryCode: z.string(),
  phone: z.string().min(1, "Phone is required"),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  leadSource: z.string().optional(),
  treatmentInterests: z.string().optional(),
  internalNotes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export default function EditPatientPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: patient, isLoading: isLoadingPatient, isError, error: loadError } = usePatient(id);
  const updateMutation = useUpdatePatient(id);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    values: patient
      ? {
          firstName: patient.first_name,
          lastName: patient.last_name,
          email: patient.email ?? "",
          phoneCountryCode: patient.phone_country_code,
          phone: patient.phone,
          gender: patient.gender ?? "",
          dateOfBirth: patient.date_of_birth ?? "",
          city: patient.city ?? "",
          country: patient.country ?? "",
          address: "",
          status: patient.status,
          leadSource: patient.lead_source ?? "",
          treatmentInterests: patient.treatment_interests ?? "",
          internalNotes: patient.internal_notes ?? "",
        }
      : undefined,
  });

  const onSubmit = async (data: PatientFormData) => {
    setServerError(null);
    try {
      await updateMutation.mutateAsync({
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
        status: data.status || undefined,
        lead_source: data.leadSource || null,
        treatment_interests: data.treatmentInterests || null,
        internal_notes: data.internalNotes || null,
      });
      toast.success("Patient updated successfully!");
      router.push(`/patients/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update patient";
      setServerError(message);
      toast.error(message);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";
  const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
  const errorClass = "mt-1 text-xs text-red-500";

  if (isLoadingPatient) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading patient...</span>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            {loadError instanceof Error ? loadError.message : "Patient not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Profile
      </Link>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-xl font-bold text-text-primary">Edit Patient</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {patient.first_name} {patient.last_name}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Personal */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Personal</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input {...register("firstName")} className={inputClass} />
                {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input {...register("lastName")} className={inputClass} />
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
              <div>
                <label className={labelClass}>Status</label>
                <select {...register("status")} className={inputClass}>
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="vip">VIP</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Contact</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Phone *</label>
                <div className="flex gap-2">
                  <select
                    {...register("phoneCountryCode")}
                    className="w-[90px] shrink-0 rounded-lg border border-border bg-white py-2.5 px-2 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <input
                    {...register("phone")}
                    type="tel"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                  />
                </div>
                {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Email</label>
                <input {...register("email")} type="email" className={inputClass} />
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Location</h2>
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
                <input {...register("city")} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <input {...register("address")} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Lead Info */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Lead Info</h2>
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
                <input {...register("treatmentInterests")} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Internal Notes</h2>
            </div>
            <textarea {...register("internalNotes")} rows={3} className={`${inputClass} resize-none`} />
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Link
              href={`/patients/${id}`}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
