"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Search, User, Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateAppointment, useTreatments } from "@/lib/api/appointments";
import { usePatients, type Patient } from "@/lib/api/patients";
import { useDoctors } from "@/lib/api/doctors";

const schema = z.object({
  appointment_date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  duration_minutes: z.coerce.number().min(5).default(30),
  treatment: z.string().min(1, "Treatment is required"),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

export default function BookAppointmentPage() {
  const router = useRouter();
  const createMutation = useCreateAppointment();
  const { data: treatmentsData } = useTreatments();
  const [serverError, setServerError] = useState<string | null>(null);

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  // Doctor select
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const { data: doctorsData } = useDoctors();

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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { duration_minutes: 30 },
  });

  const startTime = watch("start_time");

  // Auto-calculate end time from treatment duration
  const handleTreatmentChange = (treatmentName: string) => {
    setValue("treatment", treatmentName);
    const treatment = treatmentsData?.treatments.find((t) => t.name === treatmentName);
    if (treatment && startTime) {
      setValue("duration_minutes", treatment.duration_minutes);
      const [h, m] = startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + treatment.duration_minutes;
      const endH = Math.floor(endMinutes / 60).toString().padStart(2, "0");
      const endM = (endMinutes % 60).toString().padStart(2, "0");
      setValue("end_time", `${endH}:${endM}`);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedPatient) {
      setServerError("Please select a patient");
      return;
    }
    setServerError(null);
    try {
      await createMutation.mutateAsync({
        patient_id: selectedPatient.id,
        doctor_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedDoctorId) ? selectedDoctorId : null,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_minutes: data.duration_minutes,
        treatment: data.treatment,
        notes: data.notes || null,
      });
      toast.success("Appointment booked successfully!");
      router.push("/appointments");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book appointment";
      setServerError(message);
      toast.error(message);
    }
  };

  const inputClass = "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";
  const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
  const errorClass = "mt-1 text-xs text-red-500";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Calendar
      </Link>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-xl font-bold text-text-primary">Book Appointment</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Schedule a new appointment for a patient</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Patient */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Patient *</h2>
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
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white shadow-lg max-h-60 overflow-y-auto">
                  {patientsLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</div>
                  ) : patientsData?.patients && patientsData.patients.length > 0 ? (
                    patientsData.patients.map((p) => (
                      <button key={p.id} type="button" onClick={() => selectPatient(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#0D4F6C" }}>
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-text-muted">{p.phone}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-text-muted">
                      No patients found. <Link href="/patients/new" className="font-medium" style={{ color: "var(--primary-light)" }}>Add a patient first</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedPatient && <p className="mt-1.5 text-xs text-emerald-600">Selected: {selectedPatient.first_name} {selectedPatient.last_name}</p>}
          </section>

          {/* Schedule */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Schedule</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Date *</label>
                <input type="date" {...register("appointment_date")} className={inputClass} />
                {errors.appointment_date && <p className={errorClass}>{errors.appointment_date.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Start Time *</label>
                <input type="time" {...register("start_time")} className={inputClass} />
                {errors.start_time && <p className={errorClass}>{errors.start_time.message}</p>}
              </div>
              <div>
                <label className={labelClass}>End Time *</label>
                <input type="time" {...register("end_time")} className={inputClass} />
                {errors.end_time && <p className={errorClass}>{errors.end_time.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input type="number" {...register("duration_minutes")} min="5" className={inputClass} />
              </div>
            </div>
          </section>

          {/* Treatment & Doctor */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Treatment & Doctor</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Treatment *</label>
                {treatmentsData?.treatments && treatmentsData.treatments.length > 0 ? (
                  <select
                    {...register("treatment")}
                    onChange={(e) => handleTreatmentChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select treatment</option>
                    {treatmentsData.treatments.map((t) => (
                      <option key={t.id} value={t.name}>{t.name} ({t.duration_minutes}min - {t.currency} {t.price})</option>
                    ))}
                  </select>
                ) : (
                  <input {...register("treatment")} placeholder="e.g. Botox, Consultation" className={inputClass} />
                )}
                {errors.treatment && <p className={errorClass}>{errors.treatment.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a doctor (optional)</option>
                  {(doctorsData?.doctors || []).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.first_name} {doc.last_name}{doc.specialty ? ` — ${doc.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea {...register("notes")} rows={3} placeholder="Additional notes..." className={`${inputClass} resize-none`} />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Link href="/appointments" className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Booking..." : "Book Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
