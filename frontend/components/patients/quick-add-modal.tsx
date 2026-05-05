"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Save, Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { COUNTRY_CODES } from "@/lib/constants";
import { useCreatePatient } from "@/lib/api/patients";

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddPatientModal({ open, onClose }: QuickAddModalProps) {
  const router = useRouter();
  const createMutation = useCreatePatient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+212");
  const [treatment, setTreatment] = useState("");

  if (!open) return null;

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setTreatment("");
  };

  const handleSave = async (thenBook: boolean) => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error("Nom et telephone requis");
      return;
    }

    try {
      const patient = await createMutation.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        phone_country_code: countryCode,
        lead_source: "walk_in",
        treatment_interests: treatment || null,
      });
      toast.success(`${firstName} ${lastName} ajoute`);
      reset();
      onClose();

      if (thenBook) {
        router.push(`/appointments/new?patient=${patient.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la creation");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-white py-2.5 px-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold text-text-primary">Nouveau patient</h2>
          <button onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Prenom *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prenom"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Nom *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Telephone *</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-[90px] shrink-0 rounded-lg border border-border bg-white py-2.5 px-2 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="6 12 34 56 78"
                className={`${inputClass} flex-1`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Interet traitement</label>
            <input
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="ex: Botox, Laser, Consultation"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-gray-50 disabled:opacity-60"
          >
            <CalendarPlus className="h-4 w-4" />
            Sauvegarder + RDV
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
