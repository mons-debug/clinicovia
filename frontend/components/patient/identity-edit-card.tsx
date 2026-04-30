"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IdCard, Loader2, Save, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdatePatient, type Patient } from "@/lib/api/patients";
import { useAuthStore } from "@/stores/auth-store";

interface Props {
  patient: Patient;
}

// Reading A: identity is reception's territory.
// Doctor / staff outside that scope can read but not edit.
const EDIT_ROLES = new Set([
  "clinic_owner",
  "manager",
  "receptionist",
  "super_admin",
]);

export function IdentityEditCard({ patient }: Props) {
  const role = useAuthStore((s) => s.currentRole);
  const canEdit = !!role && EDIT_ROLES.has(role);
  const updateMut = useUpdatePatient(patient.id);

  const [firstName, setFirstName] = useState(patient.first_name);
  const [lastName, setLastName] = useState(patient.last_name);
  const [email, setEmail] = useState(patient.email ?? "");
  const [phone, setPhone] = useState(patient.phone);
  const [countryCode, setCountryCode] = useState(patient.phone_country_code || "+212");
  const [gender, setGender] = useState<string>(patient.gender ?? "");
  const [dob, setDob] = useState(patient.date_of_birth ?? "");
  const [cnie, setCnie] = useState(patient.cnie ?? "");
  const [city, setCity] = useState(patient.city ?? "");
  const [country, setCountry] = useState(patient.country ?? "Maroc");
  const [address, setAddress] = useState(patient.address ?? "");

  useEffect(() => {
    setFirstName(patient.first_name);
    setLastName(patient.last_name);
    setEmail(patient.email ?? "");
    setPhone(patient.phone);
    setCountryCode(patient.phone_country_code || "+212");
    setGender(patient.gender ?? "");
    setDob(patient.date_of_birth ?? "");
    setCnie(patient.cnie ?? "");
    setCity(patient.city ?? "");
    setCountry(patient.country ?? "Maroc");
    setAddress(patient.address ?? "");
  }, [patient]);

  const submit = async () => {
    try {
      await updateMut.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        phone_country_code: countryCode,
        gender: gender || null,
        date_of_birth: dob || null,
        cnie: cnie.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        address: address.trim() || null,
      });
      toast.success("Identité enregistrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const inputProps = canEdit ? {} : { disabled: true };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <IdCard className="h-4 w-4 text-[var(--primary)]" />
          Identité
        </h3>
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Lock className="h-3 w-3" /> Lecture seule (médecin)
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="id-first">Prénom</Label>
          <Input id="id-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-last">Nom</Label>
          <Input id="id-last" value={lastName} onChange={(e) => setLastName(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-gender">Sexe</Label>
          <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)} disabled={!canEdit}>
            <SelectTrigger id="id-gender"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="female">Femme</SelectItem>
              <SelectItem value="male">Homme</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-dob">Date de naissance</Label>
          <Input id="id-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-cnie">CNIE</Label>
          <Input id="id-cnie" value={cnie} onChange={(e) => setCnie(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-email">Email</Label>
          <Input id="id-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode} disabled={!canEdit}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="+212">🇲🇦 +212</SelectItem>
                <SelectItem value="+33">🇫🇷 +33</SelectItem>
                <SelectItem value="+34">🇪🇸 +34</SelectItem>
                <SelectItem value="+1">🇺🇸 +1</SelectItem>
              </SelectContent>
            </Select>
            <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").replace(/^0/, ""))} {...inputProps} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-city">Ville</Label>
          <Input id="id-city" value={city} onChange={(e) => setCity(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id-country">Pays</Label>
          <Input id="id-country" value={country} onChange={(e) => setCountry(e.target.value)} {...inputProps} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="id-address">Adresse</Label>
          <Input id="id-address" value={address} onChange={(e) => setAddress(e.target.value)} {...inputProps} />
        </div>
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
