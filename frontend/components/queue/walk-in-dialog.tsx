"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

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

import { useCreatePatient } from "@/lib/api/patients";

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

export function WalkInDialog({ triggerLabel = "Walk-in" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+212");
  const [requestedService, setRequestedService] = useState("");
  const [channelPref, setChannelPref] = useState("whatsapp");
  const [leadSource, setLeadSource] = useState("walk_in");
  const [language, setLanguage] = useState("fr");

  const create = useCreatePatient();

  const reset = () => {
    setFirstName(""); setLastName(""); setPhone(""); setPhoneCode("+212");
    setRequestedService(""); setChannelPref("whatsapp");
    setLeadSource("walk_in"); setLanguage("fr");
  };

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error("Nom et prénom requis");
    if (!phone.trim()) return toast.error("Téléphone requis");

    try {
      await create.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        phone_country_code: phoneCode,
        channel_pref: channelPref,
        language_pref: language,
        lead_source: leadSource,
        requested_service: requestedService.trim() || null,
        intake_status: "intake_pending",
      });
      toast.success(`${firstName} ${lastName} ajouté(e) à la salle d'attente`);
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Fiche rapide. Le médecin complétera le dossier clinique au fauteuil.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wi-first">Prénom</Label>
            <Input id="wi-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wi-last">Nom</Label>
            <Input id="wi-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="wi-phone">Téléphone</Label>
            <div className="flex gap-2">
              <Input
                id="wi-code"
                className="w-24"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
              />
              <Input
                id="wi-phone"
                placeholder="6 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="wi-service">Demande à l&apos;accueil</Label>
            <Input
              id="wi-service"
              placeholder="ex. consultation Botox · hydrafacial · suivi"
              value={requestedService}
              onChange={(e) => setRequestedService(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wi-channel">Canal préféré</Label>
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Ajout…</> : <><UserPlus className="h-3 w-3" />Ajouter en salle d&apos;attente</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
