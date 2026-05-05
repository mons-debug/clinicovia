"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Loader2, Search, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreatePatient, usePatients } from "@/lib/api/patients";
import { useWalkInExistingPatient } from "@/lib/api/queue";
import { useAllServices } from "@/lib/api/doctor-services";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Téléphone" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
];

const SOURCE_OPTIONS = [
  { value: "walk_in", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google_ads", label: "Google Ads" },
  { value: "tiktok", label: "TikTok" },
  { value: "referral", label: "Recommandation" },
  { value: "phone", label: "Téléphone" },
  { value: "website", label: "Site web" },
];

type Mode = "existing" | "new";

export function DoctorServiceSelect({
  selectedDoctorId,
  selectedServiceId,
  onDoctorChange,
  onServiceChange,
}: {
  selectedDoctorId: string;
  selectedServiceId: string;
  onDoctorChange: (doctorId: string) => void;
  onServiceChange: (serviceId: string) => void;
}) {
  const { data: groups } = useAllServices();

  const filteredServices = useMemo(() => {
    if (!groups || !selectedDoctorId) return [];
    const group = groups.find((g) => g.doctor_id === selectedDoctorId);
    return group?.services ?? [];
  }, [groups, selectedDoctorId]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Médecin</Label>
        <Select value={selectedDoctorId} onValueChange={(v) => { onDoctorChange(v); onServiceChange(""); }}>
          <SelectTrigger><SelectValue placeholder="Choisir le médecin" /></SelectTrigger>
          <SelectContent>
            {(groups ?? []).map((g) => (
              <SelectItem key={g.doctor_id} value={g.doctor_id}>
                {g.doctor_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Service</Label>
        <Select value={selectedServiceId} onValueChange={onServiceChange} disabled={!selectedDoctorId}>
          <SelectTrigger><SelectValue placeholder={selectedDoctorId ? "Choisir le service" : "Médecin d'abord"} /></SelectTrigger>
          <SelectContent>
            {filteredServices.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.duration_minutes}min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function WalkInDialog({ triggerLabel = "Walk-in" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing");
  const qc = useQueryClient();

  // Doctor + service
  const { data: serviceGroups } = useAllServices();
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const selectedService = useMemo(() => {
    if (!serviceGroups || !selectedServiceId) return null;
    for (const g of serviceGroups) {
      const s = g.services.find((s) => s.id === selectedServiceId);
      if (s) return { service: s, doctorName: g.doctor_name };
    }
    return null;
  }, [serviceGroups, selectedServiceId]);

  // Existing-patient mode
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string>("");
  const [pickedLabel, setPickedLabel] = useState<string>("");
  const { data: patientsData } = usePatients({
    search: search || undefined,
    page_size: 8,
  });
  const candidates = patientsData?.patients ?? [];

  // New-patient mode
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+212");
  const [channelPref, setChannelPref] = useState("whatsapp");
  const [leadSource, setLeadSource] = useState("walk_in");
  const [language, setLanguage] = useState("fr");

  const createNew = useCreatePatient();
  const walkInExisting = useWalkInExistingPatient();
  const pending = createNew.isPending || walkInExisting.isPending;

  const reset = () => {
    setSearch(""); setPickedId(""); setPickedLabel("");
    setFirstName(""); setLastName(""); setPhone(""); setPhoneCode("+212");
    setSelectedDoctorId(""); setSelectedServiceId("");
    setChannelPref("whatsapp"); setLeadSource("walk_in"); setLanguage("fr");
    setMode("existing");
  };

  const canSubmit = mode === "existing"
    ? !!(pickedId && selectedServiceId)
    : !!(firstName.trim() && lastName.trim() && phone.trim() && selectedServiceId);

  const submitExisting = async () => {
    if (!pickedId || !selectedServiceId) return;
    try {
      await walkInExisting.mutateAsync({
        patientId: pickedId,
        requestedService: selectedService?.service.name ?? null,
        doctorServiceId: selectedServiceId,
      });
      toast.success(`${pickedLabel} → ${selectedService?.doctorName}`);
      reset(); setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const submitNew = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !selectedServiceId) return;
    try {
      const created = await createNew.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        phone_country_code: phoneCode,
        channel_pref: channelPref,
        language_pref: language,
        lead_source: leadSource,
        requested_service: selectedService?.service.name ?? null,
        intake_status: "intake_pending",
      });

      try {
        await walkInExisting.mutateAsync({
          patientId: created.id,
          requestedService: selectedService?.service.name ?? null,
          doctorServiceId: selectedServiceId,
          flipToAwaiting: false,
          isFirstVisit: true,
        });
      } catch { /* best-effort */ }

      toast.success(`${firstName} ${lastName} → ${selectedService?.doctorName}`);
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      reset(); setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-3 w-3" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Walk-in — accueil</DialogTitle>
          <DialogDescription>
            Patient existant ou nouveau. Choisir le médecin et le service.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              mode === "existing"
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--text-secondary)] hover:bg-[var(--background)]"
            )}
          >
            <Search className="mr-1.5 inline h-3.5 w-3.5" />
            Patient existant
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              mode === "new"
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--text-secondary)] hover:bg-[var(--background)]"
            )}
          >
            <UserPlus className="mr-1.5 inline h-3.5 w-3.5" />
            Nouveau patient
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="wi-search">Rechercher</Label>
              <Input
                id="wi-search"
                placeholder="Nom, téléphone, e-mail…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (pickedId) { setPickedId(""); setPickedLabel(""); }
                }}
                autoFocus
              />
              {!pickedId && search && candidates.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-white">
                  {candidates.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setPickedId(p.id);
                        setPickedLabel(`${p.first_name} ${p.last_name}`);
                      }}
                      className="flex w-full items-center justify-between border-b border-[var(--line-soft,_#E2E8F0)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                    >
                      <span className="font-medium">{p.first_name} {p.last_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{p.phone_country_code}{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {!pickedId && search && candidates.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">Aucun patient trouvé.</p>
              )}
              {pickedId && (
                <div className="flex items-center justify-between rounded-md bg-[var(--primary-lighter)] px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-[var(--primary)]">
                    <UserCheck className="h-4 w-4" /> {pickedLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setPickedId(""); setPickedLabel(""); }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Changer
                  </button>
                </div>
              )}
            </div>

            {/* Doctor + Service dropdowns */}
            <DoctorServiceSelect
              selectedDoctorId={selectedDoctorId}
              selectedServiceId={selectedServiceId}
              onDoctorChange={setSelectedDoctorId}
              onServiceChange={setSelectedServiceId}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wi-first">Prénom</Label>
                <Input id="wi-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wi-last">Nom</Label>
                <Input id="wi-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wi-phone">Téléphone</Label>
              <div className="flex gap-2">
                <Select value={phoneCode} onValueChange={setPhoneCode}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+212">🇲🇦 +212</SelectItem>
                    <SelectItem value="+33">🇫🇷 +33</SelectItem>
                    <SelectItem value="+34">🇪🇸 +34</SelectItem>
                    <SelectItem value="+971">🇦🇪 +971</SelectItem>
                    <SelectItem value="+966">🇸🇦 +966</SelectItem>
                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    <SelectItem value="+44">🇬🇧 +44</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="wi-phone"
                  placeholder="6 12 34 56 78"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.startsWith("0")) v = v.slice(1);
                    setPhone(v);
                  }}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Doctor + Service dropdowns */}
            <DoctorServiceSelect
              selectedDoctorId={selectedDoctorId}
              selectedServiceId={selectedServiceId}
              onDoctorChange={setSelectedDoctorId}
              onServiceChange={setSelectedServiceId}
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wi-channel">Canal</Label>
                <Select value={channelPref} onValueChange={setChannelPref}>
                  <SelectTrigger id="wi-channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wi-source">Source</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger id="wi-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wi-lang">Langue</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="wi-lang"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            onClick={mode === "existing" ? submitExisting : submitNew}
            disabled={pending || !canSubmit}
          >
            {pending ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Ajout…</>
            ) : (
              <><UserPlus className="h-3 w-3" /> Ajouter en salle d&apos;attente</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
