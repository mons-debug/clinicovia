"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Loader2, Trash2, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

import {
  useBodyZones,
  useDeletePhoto,
  usePatientPhotos,
  useSeedZones,
  useUploadPhoto,
  photoFileUrl,
  type PatientPhoto,
  type PhotoAngle,
  type PhotoStage,
  type ConsentScope,
  type BodyZone,
} from "@/lib/api/photos";
import { useAuthStore } from "@/stores/auth-store";

const STAGE_LABEL: Record<PhotoStage, string> = {
  before: "Avant",
  during: "Pendant",
  after: "Après",
  follow_up: "Suivi",
  control: "Contrôle",
};

const STAGE_VARIANT: Record<PhotoStage, "outline" | "secondary" | "success" | "warning" | "default"> = {
  before: "outline",
  during: "warning",
  after: "success",
  follow_up: "secondary",
  control: "default",
};

const ANGLE_LABEL: Record<PhotoAngle, string> = {
  front: "Face",
  left_45: "3/4 G",
  right_45: "3/4 D",
  left_profile: "Profil G",
  right_profile: "Profil D",
  back: "Dos",
  detail: "Détail",
  other: "Autre",
};

const CONSENT_LABEL: Record<ConsentScope, string> = {
  medical: "Médical (interne)",
  before_after: "Avant/après",
  marketing: "Marketing",
};

interface Props { patientId: string }

// ── Authenticated <img> — fetches with bearer, displays as blob URL ────

function AuthImage({ photoId, alt }: { photoId: string; alt: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const [src, setSrc] = useState<string | null>(null);
  const objectRef = useRef<string | null>(null);

  useMemo(() => {
    let cancelled = false;
    fetch(photoFileUrl(photoId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((blob) => {
        if (cancelled) return;
        if (objectRef.current) URL.revokeObjectURL(objectRef.current);
        const url = URL.createObjectURL(blob);
        objectRef.current = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectRef.current) URL.revokeObjectURL(objectRef.current);
    };
  }, [photoId, token]);

  if (!src) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-[var(--background)] text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="aspect-square w-full rounded-md object-cover" />;
}

// ── Upload dialog ──────────────────────────────────────────────

function UploadDialog({ patientId, zones }: { patientId: string; zones: BodyZone[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [zoneSlug, setZoneSlug] = useState<string>(zones[0]?.slug ?? "");
  const [stage, setStage] = useState<PhotoStage>("before");
  const [angle, setAngle] = useState<PhotoAngle>("front");
  const [consent, setConsent] = useState<ConsentScope>("medical");
  const [note, setNote] = useState("");

  const upload = useUploadPhoto();
  const seed = useSeedZones();

  const reset = () => {
    setFile(null);
    setZoneSlug(zones[0]?.slug ?? "");
    setStage("before");
    setAngle("front");
    setConsent("medical");
    setNote("");
  };

  const submit = async () => {
    if (!file) return toast.error("Choisir un fichier");
    if (!zoneSlug) return toast.error("Choisir une zone");

    try {
      await upload.mutateAsync({
        file,
        patient_id: patientId,
        zone_slug: zoneSlug,
        stage,
        angle,
        consent_scope: consent,
        note: note.trim() || undefined,
      });
      toast.success("Photo ajoutée");
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
          <Camera className="h-3 w-3" />
          Ajouter une photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle photo clinique</DialogTitle>
          <DialogDescription>
            Stockée en interne. Le scope de consentement contrôle l&apos;usage ultérieur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="ph-file">Fichier (JPG / PNG / WebP / HEIC, max 25 MB)</Label>
            <Input
              id="ph-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ph-zone">Zone</Label>
            {zones.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seed.mutate(undefined, {
                  onSuccess: (r) => toast.success(`${r.inserted} zones importées`),
                })}
                disabled={seed.isPending}
              >
                {seed.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                Importer le catalogue de zones
              </Button>
            ) : (
              <Select value={zoneSlug} onValueChange={setZoneSlug}>
                <SelectTrigger id="ph-zone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.slug} value={z.slug}>
                      {z.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ph-stage">Étape</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as PhotoStage)}>
              <SelectTrigger id="ph-stage"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_LABEL) as PhotoStage[]).map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ph-angle">Angle</Label>
            <Select value={angle} onValueChange={(v) => setAngle(v as PhotoAngle)}>
              <SelectTrigger id="ph-angle"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ANGLE_LABEL) as PhotoAngle[]).map((a) => (
                  <SelectItem key={a} value={a}>{ANGLE_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ph-consent">Consentement</Label>
            <Select value={consent} onValueChange={(v) => setConsent(v as ConsentScope)}>
              <SelectTrigger id="ph-consent"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONSENT_LABEL) as ConsentScope[]).map((c) => (
                  <SelectItem key={c} value={c}>{CONSENT_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="ph-note">Note</Label>
            <Input
              id="ph-note"
              placeholder="Optionnel — observations cliniques"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={upload.isPending || !file || !zoneSlug}>
            {upload.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Upload…</> : <><Upload className="h-3 w-3" />Téléverser</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card ───────────────────────────────────────────────────────

export function PhotosCard({ patientId }: Props) {
  const { data: zonesData } = useBodyZones();
  const zones = zonesData?.zones ?? [];
  const { data: photosData } = usePatientPhotos(patientId);
  const photos: PatientPhoto[] = photosData?.photos ?? [];
  const del = useDeletePhoto(patientId);

  // Group by zone, then stage
  const grouped = useMemo(() => {
    const byZone = new Map<string, PatientPhoto[]>();
    for (const p of photos) {
      const arr = byZone.get(p.zone_slug) ?? [];
      arr.push(p);
      byZone.set(p.zone_slug, arr);
    }
    return Array.from(byZone.entries()).map(([slug, items]) => ({
      slug,
      zone: zones.find((z) => z.slug === slug),
      items: items.sort((a, b) => +new Date(b.captured_at) - +new Date(a.captured_at)),
    }));
  }, [photos, zones]);

  const handleDelete = (photoId: string) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    del.mutate(photoId, {
      onSuccess: () => toast.success("Photo supprimée"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
          Photos cliniques
        </h3>
        <UploadDialog patientId={patientId} zones={zones} />
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          Aucune photo. Téléversez avant/pendant/après pour suivre l&apos;évolution.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map(({ slug, zone, items }) => (
            <div key={slug}>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  {zone?.name_fr ?? slug}
                </p>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {items.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="group relative overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)]"
                  >
                    <AuthImage photoId={p.id} alt={`${zone?.name_fr ?? slug} ${p.stage}`} />
                    <div className="absolute left-1 top-1 flex flex-wrap gap-1">
                      <Badge variant={STAGE_VARIANT[p.stage]} className="text-[10px]">
                        {STAGE_LABEL[p.stage]}
                      </Badge>
                      {p.angle && (
                        <Badge variant="outline" className="bg-white/80 text-[10px]">
                          {ANGLE_LABEL[p.angle]}
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="absolute right-1 top-1 hidden rounded-full bg-white/90 p-1 text-[var(--danger)] hover:bg-white group-hover:block"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[10px] text-white">
                      {new Date(p.captured_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
