"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  Stethoscope,
  Mail,
  Phone,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  useDoctors,
  useCreateDoctor,
  useDeleteDoctor,
  useUpdateDoctor,
  type Doctor,
  type DoctorCreateInput,
} from "@/lib/api/doctors";

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDoctors({ search: search || undefined });
  const doctors = data?.doctors || [];
  const createMutation = useCreateDoctor();
  const deleteMutation = useDeleteDoctor();

  const [showAdd, setShowAdd] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Doctors</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your clinic&apos;s doctors and their assignments
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <Plus className="h-4 w-4" />
          Add Doctor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search doctors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      {/* Doctors grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Stethoscope className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-text-primary">
            {search ? "No doctors found" : "No doctors yet"}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            {search ? "Try a different search term" : "Add your first doctor to start managing appointments"}
          </p>
          {!search && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Plus className="h-4 w-4" />
              Add Doctor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {doctor.first_name[0]}{doctor.last_name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Dr. {doctor.first_name} {doctor.last_name}
                    </h3>
                    {doctor.specialty && (
                      <p className="text-xs text-text-muted">{doctor.specialty}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditDoctor(doctor)}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm === doctor.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          try {
                            await deleteMutation.mutateAsync(doctor.id);
                            setDeleteConfirm(null);
                            toast.success("Doctor removed");
                          } catch {
                            toast.error("Failed to remove doctor");
                          }
                        }}
                        className="rounded px-2 py-1 text-[10px] font-medium text-white bg-red-500 hover:bg-red-600"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(doctor.id)}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Mail className="h-3.5 w-3.5 text-text-muted" />
                  {doctor.email}
                </div>
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Phone className="h-3.5 w-3.5 text-text-muted" />
                    {doctor.phone}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  doctor.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${doctor.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {doctor.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAdd && (
        <AddDoctorModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); toast.success("Doctor added successfully"); }}
        />
      )}

      {/* Edit Doctor Modal */}
      {editDoctor && (
        <EditDoctorModal
          doctor={editDoctor}
          onClose={() => setEditDoctor(null)}
          onUpdated={() => { setEditDoctor(null); toast.success("Doctor updated"); }}
        />
      )}
    </div>
  );
}

function AddDoctorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createMutation = useCreateDoctor();
  const [form, setForm] = useState<DoctorCreateInput>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    specialty: "",
    password: "",
  });
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(form);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add doctor");
    }
  };

  const inputClass = "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Add Doctor</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">First Name *</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="First name"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">Last Name *</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Last name"
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="doctor@clinic.com"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Phone</label>
            <input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+971 50 123 4567"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Specialty</label>
            <input
              value={form.specialty || ""}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="e.g. Dermatology, Dental, Plastic Surgery"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Password *</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className={`${inputClass} pr-10`}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Add Doctor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDoctorModal({ doctor, onClose, onUpdated }: { doctor: Doctor; onClose: () => void; onUpdated: () => void }) {
  const updateMutation = useUpdateDoctor(doctor.id);
  const [form, setForm] = useState({
    first_name: doctor.first_name,
    last_name: doctor.last_name,
    phone: doctor.phone || "",
    specialty: doctor.specialty || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync(form);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const inputClass = "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Edit Doctor</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">First Name</label>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">Last Name</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-primary">Specialty</label>
            <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--primary-light)" }}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
