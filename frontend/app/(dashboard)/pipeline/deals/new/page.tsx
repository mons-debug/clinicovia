"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Search,
  User,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateDeal } from "@/lib/api/deals";
import { usePatients, type Patient } from "@/lib/api/patients";

const dealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  value: z.coerce.number().min(0, "Value must be >= 0"),
  currency: z.string().default("AED"),
  treatment: z.string().optional(),
  temperature: z.string().default("warm"),
  notes: z.string().optional(),
});

type DealFormInput = z.input<typeof dealSchema>;
type DealFormData = z.output<typeof dealSchema>;

export default function NewDealPage() {
  const router = useRouter();
  const createMutation = useCreateDeal();
  const [serverError, setServerError] = useState<string | null>(null);

  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: patientsData, isLoading: patientsLoading } = usePatients({
    search: debouncedSearch || undefined,
    page_size: 10,
  });

  const handlePatientSearch = useCallback(
    (value: string) => {
      setPatientSearch(value);
      setSelectedPatient(null);
      setShowDropdown(true);
      if (debounceRef[0]) clearTimeout(debounceRef[0]);
      debounceRef[0] = setTimeout(() => setDebouncedSearch(value), 300);
    },
    [debounceRef]
  );

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.first_name} ${patient.last_name} (${patient.phone})`);
    setShowDropdown(false);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DealFormInput, unknown, DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: { currency: "AED", temperature: "warm", value: 0 },
  });

  const onSubmit = async (data: DealFormData) => {
    if (!selectedPatient) {
      setServerError("Please select a patient");
      return;
    }
    setServerError(null);
    try {
      await createMutation.mutateAsync({
        patient_id: selectedPatient.id,
        title: data.title,
        value: data.value,
        currency: data.currency,
        treatment: data.treatment || null,
        temperature: data.temperature,
        notes: data.notes || null,
      });
      toast.success("Deal created successfully!");
      router.push("/pipeline");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create deal";
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
        href="/pipeline"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-xl font-bold text-text-primary">Add New Deal</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Create a deal and link it to a patient
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Patient Selection */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Patient *
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientSearch(e.target.value)}
                onFocus={() => patientSearch && setShowDropdown(true)}
                placeholder="Search patient by name or phone..."
                className={`${inputClass} pl-10`}
              />
              {showDropdown && patientSearch && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
                  {patientsLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                    </div>
                  ) : patientsData?.patients && patientsData.patients.length > 0 ? (
                    patientsData.patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: "#0D4F6C" }}
                        >
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {p.first_name} {p.last_name}
                          </p>
                          <p className="text-xs text-text-muted">{p.phone}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-text-muted">
                      Aucun patient trouvé. Créez-le d&apos;abord depuis la salle d&apos;attente.
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <p className="mt-1.5 text-xs text-emerald-600">
                Selected: {selectedPatient.first_name} {selectedPatient.last_name}
              </p>
            )}
          </section>

          {/* Deal Details */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Deal Details
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Deal Title *</label>
                <input {...register("title")} placeholder="e.g. Botox Consultation" className={inputClass} />
                {errors.title && <p className={errorClass}>{errors.title.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Value *</label>
                <input {...register("value")} type="number" step="0.01" min="0" placeholder="0" className={inputClass} />
                {errors.value && <p className={errorClass}>{errors.value.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select {...register("currency")} className={inputClass}>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="SAR">SAR</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Treatment</label>
                <input {...register("treatment")} placeholder="e.g. Botox, Hair Transplant" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Temperature</label>
                <select {...register("temperature")} className={inputClass}>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  placeholder="Additional notes..."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Link
              href="/pipeline"
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
              {createMutation.isPending ? "Creating..." : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
