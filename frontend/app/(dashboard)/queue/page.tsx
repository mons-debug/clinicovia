"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Phone,
  Clock,
  ArrowRight,
  CheckCircle2,
  DoorOpen,
  UserCheck,
  Loader2,
  Sparkles,
  BellRing,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WalkInDialog } from "@/components/queue/walk-in-dialog";
import {
  useQueue,
  useAdvanceIntake,
  useCallPatient,
  useUncallPatient,
  type IntakeStatus,
} from "@/lib/api/queue";
import type { Patient } from "@/lib/api/patients";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

// ── Chime (reception alert when doctor calls) ────────────────────────
// Programmatic — no asset, no autoplay-blocked file. Two short beeps.
function playChime() {
  if (typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const beep = (when: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.18, when + 0.04);
      g.gain.linearRampToValueAtTime(0, when + 0.22);
      o.start(when);
      o.stop(when + 0.25);
    };
    beep(ctx.currentTime, 880);
    beep(ctx.currentTime + 0.18, 1175);
  } catch {
    // ignore — sound is best-effort
  }
}

function isCallRecent(calledAt: string | null | undefined): boolean {
  if (!calledAt) return false;
  return Date.now() - new Date(calledAt).getTime() < 5 * 60 * 1000;
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatWait(intakeAt: string | null | undefined): string {
  if (!intakeAt) return "—";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(intakeAt).getTime()) / 60_000)
  );
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function initials(p: Patient): string {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

// ── Patient card ──────────────────────────────────────────────────────

interface PatientCardProps {
  patient: Patient & { intake_at?: string | null; doctor_called_at?: string | null; requested_service?: string | null };
  primaryAction?: { label: string; to: IntakeStatus; variant?: "default" | "secondary" };
  secondaryAction?: { label: string; to: IntakeStatus; variant?: "secondary" | "ghost" };
  showCallButton?: boolean;
  checkoutAmount?: string | null;
}

function PatientCard({ patient: p, primaryAction, secondaryAction, showCallButton, checkoutAmount }: PatientCardProps) {
  const advance = useAdvanceIntake();
  const callMut = useCallPatient();
  const uncallMut = useUncallPatient();
  const role = useAuthStore((s) => s.currentRole);
  const isDoctor = role === "doctor" || role === "clinic_owner" || role === "manager";

  const handle = (to: IntakeStatus, label: string) => {
    advance.mutate(
      { patientId: p.id, to },
      {
        onSuccess: () => toast.success(`${p.first_name} → ${label}`),
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : "Erreur";
          toast.error(msg);
        },
      }
    );
  };

  const called = isCallRecent(p.doctor_called_at);

  const fireCall = () => {
    callMut.mutate(p.id, {
      onSuccess: () => toast.success(`Réception alertée pour ${p.first_name}`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  const cancelCall = () => {
    uncallMut.mutate(p.id, {
      onSuccess: () => toast.success("Appel annulé"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
    });
  };

  return (
    <Card className={cn(
      "p-4 transition-all",
      called
        ? "border-2 border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300/60 animate-pulse"
        : "hover:shadow-card-hover"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-sm font-semibold text-[var(--primary)]">
          {initials(p)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/patients/${p.id}`}
              className="truncate font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline"
            >
              {p.first_name} {p.last_name}
            </Link>
            {p.lead_source === "whatsapp" && (
              <Badge variant="outline" className="text-[10px] border-[var(--whatsapp)] text-[var(--whatsapp)]">
                WA
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {p.phone_country_code} {p.phone}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatWait((p as Patient & { intake_at?: string | null }).intake_at)}
            </span>
          </div>
          {(p as Patient & { requested_service?: string | null }).requested_service && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-secondary)]">
              <Sparkles className="h-3 w-3" />
              {(p as Patient & { requested_service?: string | null }).requested_service}
            </p>
          )}
        </div>
      </div>

      {/* Doctor → reception ping (only doctors see this on EN ATTENTE cards) */}
      {showCallButton && isDoctor && (
        called ? (
          <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
            <span className="inline-flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              Patient appelé · réception alertée
            </span>
            <button
              type="button"
              onClick={cancelCall}
              disabled={uncallMut.isPending}
              className="text-emerald-700/70 underline hover:text-emerald-900"
            >
              Annuler
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50"
            disabled={callMut.isPending}
            onClick={fireCall}
          >
            {callMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellRing className="h-3 w-3" />}
            Appeler ce patient (alerter réception)
          </Button>
        )
      )}

      {(primaryAction || secondaryAction) && (
        <div className="mt-3 flex gap-2">
          {primaryAction && (
            <Button
              size="sm"
              variant={primaryAction.variant ?? "default"}
              className="flex-1"
              disabled={advance.isPending}
              onClick={() => handle(primaryAction.to, primaryAction.label)}
            >
              {advance.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  {primaryAction.label}
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant={secondaryAction.variant ?? "ghost"}
              onClick={() => handle(secondaryAction.to, secondaryAction.label)}
              disabled={advance.isPending}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Column ────────────────────────────────────────────────────────────

interface ColumnProps {
  title: string;
  subtitle: string;
  count: number;
  accent: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  empty: string;
}

function Column({ title, subtitle, count, accent, Icon, children, empty }: ColumnProps) {
  const isEmpty = count === 0;
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { data, isLoading, isError, refetch, isFetching } = useQueue(4000);
  const role = useAuthStore((s) => s.currentRole);
  const isDoctor = role === "doctor" || role === "clinic_owner" || role === "manager";

  // Track which patients are currently flagged "called" so we can chime
  // exactly once when a new call arrives (not on every poll).
  const previouslyCalled = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const currentlyCalled = new Set<string>();
    for (const p of data.awaiting_doctor) {
      if (isCallRecent((p as Patient & { doctor_called_at?: string | null }).doctor_called_at)) {
        currentlyCalled.add(p.id);
      }
    }
    // Find IDs that are called now but weren't on the previous tick
    const fresh: string[] = [];
    currentlyCalled.forEach((id) => {
      if (!previouslyCalled.current.has(id)) fresh.push(id);
    });
    if (fresh.length > 0) {
      playChime();
    }
    previouslyCalled.current = currentlyCalled;
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { total: 0, checkout: 0 };
    return {
      total:
        data.counts.intake_pending +
        data.counts.awaiting_doctor +
        data.counts.in_room +
        (data.counts.checkout_pending ?? 0),
      checkout: data.counts.checkout_pending ?? 0,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la salle d&apos;attente…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
        <p>Impossible de charger la salle d&apos;attente.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Salle d&apos;attente
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {totals.total} patient{totals.total > 1 ? "s" : ""} en cours · auto-actualisé toutes les 4 secondes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            Synchronisation live
          </span>
          <WalkInDialog />
        </div>
      </div>

      {/* Four columns — left-to-right is the patient flow */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Column
          title="À l'accueil"
          subtitle="Réception remplit la fiche"
          count={data.counts.intake_pending}
          accent="bg-amber-50 text-amber-700"
          Icon={UserCheck}
          empty="Aucun patient à l'accueil"
        >
          {data.intake_pending.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              primaryAction={{ label: "Salle d'attente", to: "awaiting_doctor" }}
              secondaryAction={{ label: "Annuler", to: "archived" }}
            />
          ))}
        </Column>

        <Column
          title="En attente"
          subtitle="Prêt pour le médecin"
          count={data.counts.awaiting_doctor}
          accent="bg-blue-50 text-blue-700"
          Icon={Clock}
          empty="Personne n'attend le médecin"
        >
          {data.awaiting_doctor.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              primaryAction={{ label: "Patient entré en salle", to: "in_room" }}
              secondaryAction={{ label: "Retour accueil", to: "intake_pending", variant: "ghost" }}
              showCallButton
            />
          ))}
        </Column>

        <Column
          title="En consultation"
          subtitle="Médecin avec le patient"
          count={data.counts.in_room}
          accent="bg-emerald-50 text-emerald-700"
          Icon={DoorOpen}
          empty="Aucune consultation en cours"
        >
          {data.in_room.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              primaryAction={isDoctor ? undefined : undefined}
              secondaryAction={{ label: "Renvoyer en attente", to: "awaiting_doctor", variant: "ghost" }}
            />
          ))}
          {/* Doctor shortcut — go to calendar to use Terminer dialog */}
          {data.counts.in_room > 0 && isDoctor && (
            <Link
              href="/calendar"
              className="mt-1 block rounded-md bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Ouvrir le calendrier pour terminer →
            </Link>
          )}
        </Column>

        <Column
          title="À encaisser"
          subtitle="Consultation finie · paiement"
          count={data.counts.checkout_pending ?? 0}
          accent="bg-rose-50 text-rose-700"
          Icon={Receipt}
          empty="Personne à encaisser"
        >
          {(data.checkout_pending ?? []).map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              primaryAction={{ label: "Payé / clôturé", to: "active" }}
              secondaryAction={{ label: "Renvoyer au médecin", to: "in_room", variant: "ghost" }}
            />
          ))}
        </Column>
      </div>

      {/* Done strip */}
      <div className="rounded-lg border border-[var(--line-soft,_#E2E8F0)] bg-white p-4 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
          Le médecin clôture la consultation depuis le calendrier (Terminer) — le patient passe à « À encaisser » jusqu&apos;à paiement.
        </span>
      </div>
    </div>
  );
}
