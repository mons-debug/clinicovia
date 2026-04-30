"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyClinic, useUpdateMyClinic, type ClinicUpdateInput } from "@/lib/api/clinics";

export default function ClinicSettingsPage() {
  const { data: clinic, isLoading } = useMyClinic();
  const updateMut = useUpdateMyClinic();

  const [form, setForm] = useState<ClinicUpdateInput>({});

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name,
        clinic_type: clinic.clinic_type,
        phone: clinic.phone,
        email: clinic.email,
        website: clinic.website,
        address: clinic.address,
        city: clinic.city,
        country: clinic.country,
        timezone: clinic.timezone,
        currency: clinic.currency,
        language: clinic.language,
        ice: clinic.ice,
        if_number: clinic.if_number,
        rc_number: clinic.rc_number,
        cnss: clinic.cnss,
        primary_color: clinic.primary_color,
        accent_color: clinic.accent_color,
        logo_url: clinic.logo_url,
      });
    }
  }, [clinic]);

  if (isLoading || !clinic) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const set = (k: keyof ClinicUpdateInput, v: string | null) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    try {
      await updateMut.mutateAsync(form);
      toast.success("Paramètres enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Paramètres de la clinique</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Identité, IDs légaux, branding, préférences locales.
          </p>
        </div>
        <Button onClick={submit} disabled={updateMut.isPending}>
          {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Enregistrer
        </Button>
      </div>

      {/* Identité */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <Building2 className="h-4 w-4 text-[var(--primary)]" />
          Identité
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nom de la clinique</Label>
            <Input id="name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              placeholder="ex. beauty, médical, dentaire"
              value={form.clinic_type ?? ""}
              onChange={(e) => set("clinic_type", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">URL du logo</Label>
            <Input
              id="logo"
              placeholder="https://…"
              value={form.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <Input id="country" value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Légal Maroc */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Identifiants légaux (Maroc)</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Ces numéros s&apos;impriment sur les factures et les ordonnances.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ice">ICE</Label>
            <Input
              id="ice"
              placeholder="Identifiant Commun de l'Entreprise"
              value={form.ice ?? ""}
              onChange={(e) => set("ice", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="if_number">IF</Label>
            <Input
              id="if_number"
              placeholder="Identifiant Fiscal"
              value={form.if_number ?? ""}
              onChange={(e) => set("if_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rc">RC</Label>
            <Input
              id="rc"
              placeholder="Registre du Commerce"
              value={form.rc_number ?? ""}
              onChange={(e) => set("rc_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnss">CNSS</Label>
            <Input
              id="cnss"
              placeholder="Caisse Nationale de Sécurité Sociale"
              value={form.cnss ?? ""}
              onChange={(e) => set("cnss", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Branding */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Branding</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary">Couleur primaire</Label>
            <div className="flex items-center gap-2">
              <Input
                id="primary"
                value={form.primary_color ?? ""}
                onChange={(e) => set("primary_color", e.target.value)}
                className="font-mono"
              />
              <span
                className="h-8 w-12 shrink-0 rounded border border-[var(--border)]"
                style={{ backgroundColor: form.primary_color ?? "#0D4F6C" }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent">Couleur d&apos;accent</Label>
            <div className="flex items-center gap-2">
              <Input
                id="accent"
                value={form.accent_color ?? ""}
                onChange={(e) => set("accent_color", e.target.value)}
                className="font-mono"
              />
              <span
                className="h-8 w-12 shrink-0 rounded border border-[var(--border)]"
                style={{ backgroundColor: form.accent_color ?? "#3EC8A0" }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Préférences */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Préférences locales</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tz">Fuseau horaire</Label>
            <Input
              id="tz"
              value={form.timezone ?? ""}
              onChange={(e) => set("timezone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Select
              value={form.currency ?? "MAD"}
              onValueChange={(v) => set("currency", v)}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAD">MAD — Dirham marocain</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="USD">USD — Dollar américain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Langue</Label>
            <Select
              value={form.language ?? "fr"}
              onValueChange={(v) => set("language", v)}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={updateMut.isPending} size="lg">
          {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}
