"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import {
  FLAG_LABEL_FR,
  SCREENING_FLAGS,
  usePatientScreening,
  useUpsertScreening,
  type ScreeningFlag,
  type ScreeningPayload,
} from "@/lib/api/screening";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
}

const EDIT_ROLES = new Set([
  "clinic_owner",
  "manager",
  "doctor",
  "super_admin",
]);

type Tri = "yes" | "no" | "unset";

function triToBool(t: Tri): boolean | null {
  if (t === "yes") return true;
  if (t === "no") return false;
  return null;
}

function boolToTri(v: boolean | null | undefined): Tri {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "unset";
}

export function ScreeningCard({ patientId }: Props) {
  const role = useAuthStore((s) => s.currentRole);
  const canEdit = !!role && EDIT_ROLES.has(role);

  const { data: screening, isLoading } = usePatientScreening(patientId);
  const upsert = useUpsertScreening(patientId);

  const [state, setState] = useState<Record<ScreeningFlag, Tri>>(() =>
    Object.fromEntries(SCREENING_FLAGS.map((k) => [k, "unset"])) as Record<ScreeningFlag, Tri>
  );
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (screening) {
      const next = { ...state };
      for (const k of SCREENING_FLAGS) {
        next[k] = boolToTri(screening[k] as boolean | null | undefined);
      }
      setState(next);
      setNotes(screening.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screening?.id, screening?.assessed_at]);

  if (isLoading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-[var(--border)] bg-white p-5 text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du screening…
      </div>
    );
  }

  const flagCount = Object.values(state).filter((v) => v === "yes").length;
  const answered = Object.values(state).filter((v) => v !== "unset").length;
  const hasFlags = flagCount > 0;

  const submit = async () => {
    const payload: ScreeningPayload = { notes: notes.trim() || null };
    for (const k of SCREENING_FLAGS) {
      payload[k] = triToBool(state[k]);
    }
    try {
      await upsert.mutateAsync(payload);
      toast.success("Screening enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5",
        hasFlags ? "border-rose-300" : "border-[var(--border)]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          {hasFlags ? (
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
          )}
          Screening pré-traitement
          {answered > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)]">
              {answered}/19 répondus
            </span>
          )}
          {hasFlags && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              ⚠ {flagCount} drapeau{flagCount > 1 ? "x" : ""}
            </span>
          )}
        </h3>
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Lock className="h-3 w-3" /> Lecture seule (médecin uniquement)
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Checklist contre-indications · à confirmer avant tout acte. Coche &laquo;&nbsp;Oui&nbsp;&raquo; uniquement si le risque s&apos;applique.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {SCREENING_FLAGS.map((key) => {
          const tri = state[key];
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border p-2 text-sm",
                tri === "yes" ? "border-rose-300 bg-rose-50" :
                tri === "no" ? "border-[var(--line-soft,_#E2E8F0)] bg-white" :
                "border-dashed border-[var(--border)] bg-[var(--background)]/50"
              )}
            >
              <span className={cn("font-medium", tri === "yes" ? "text-rose-700" : "text-[var(--text-primary)]")}>
                {FLAG_LABEL_FR[key]}
              </span>
              <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--border)] text-[11px]">
                {(["yes", "no", "unset"] as Tri[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setState((s) => ({ ...s, [key]: opt }))}
                    className={cn(
                      "px-2 py-1 transition-colors",
                      tri === opt
                        ? opt === "yes"
                          ? "bg-rose-500 text-white"
                          : opt === "no"
                          ? "bg-emerald-500 text-white"
                          : "bg-[var(--background)] text-[var(--text-muted)]"
                        : "bg-white text-[var(--text-secondary)] hover:bg-[var(--background)]",
                      !canEdit && "cursor-not-allowed opacity-70"
                    )}
                  >
                    {opt === "yes" ? "Oui" : opt === "no" ? "Non" : "—"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="screen-notes">Précisions cliniques</Label>
        <textarea
          id="screen-notes"
          rows={3}
          disabled={!canEdit}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-[var(--text-muted)] disabled:bg-[var(--background)] disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          placeholder="ex. Patient sous Eliquis depuis 2 ans · pas d'arrêt possible · acte différé"
        />
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span>
            {screening?.assessed_at
              ? `Dernière évaluation le ${new Date(screening.assessed_at).toLocaleDateString("fr-FR")}`
              : "Jamais évalué"}
          </span>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer le screening
          </Button>
        </div>
      )}

      {flagCount === 0 && answered > 0 && canEdit && (
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-[var(--success)]">
          <CheckCircle2 className="h-3 w-3" />
          Aucun drapeau levé — voie libre pour les actes esthétiques
        </p>
      )}
    </div>
  );
}
