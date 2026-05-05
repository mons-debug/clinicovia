"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  Phone,
  Clock,
  ArrowRight,
  CheckCircle2,
  DoorOpen,
  FileText,
  UserCheck,
  Loader2,
  BellRing,
  Receipt,
  Send,
  UserPlus,
  Inbox,
  Stethoscope,
  CreditCard,
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
  usePrepareSession,
  type IntakeStatus,
  type InRoomDocuments,
} from "@/lib/api/queue";
import type { Patient } from "@/lib/api/patients";
import { useSignConsent } from "@/lib/api/consents";
import { useRecordPayment } from "@/lib/api/invoices";
import { FactureReviewDialog } from "@/components/queue/facture-review-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

// ── Chime (reception alert when doctor calls) ────────────────────────
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
    <div className={cn(
      "rounded-xl border bg-white p-3.5 transition-all",
      called
        ? "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-200 animate-pulse"
        : "border-[var(--border)] hover:shadow-md hover:border-[var(--text-muted)]/30"
    )}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-sm font-bold text-[var(--primary)]">
          {initials(p)}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/patients/${p.id}`}
            className="block truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]"
          >
            {p.first_name} {p.last_name}
            {p.lead_source === "whatsapp" && (
              <span className="ml-1.5 text-[9px] font-normal text-[var(--whatsapp)]">WA</span>
            )}
          </Link>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
            {(p as Patient & { requested_service?: string | null }).requested_service && (
              <span className="truncate max-w-[140px] text-[var(--text-secondary)]">
                {(p as Patient & { requested_service?: string | null }).requested_service}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatWait((p as Patient & { intake_at?: string | null }).intake_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Doctor call button */}
      {showCallButton && isDoctor && (
        called ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800">
            <span className="inline-flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              Appelé
            </span>
            <button
              type="button"
              onClick={cancelCall}
              disabled={uncallMut.isPending}
              className="text-emerald-600 underline hover:text-emerald-900 text-[11px]"
            >
              Annuler
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs h-8"
            disabled={callMut.isPending}
            onClick={fireCall}
          >
            {callMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Appeler
          </Button>
        )
      )}

      {/* Action buttons */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-3 flex gap-2">
          {primaryAction && (
            <Button
              size="sm"
              variant={primaryAction.variant ?? "default"}
              className="flex-1 text-xs h-8 gap-1.5"
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
              className="text-xs h-8"
              onClick={() => handle(secondaryAction.to, secondaryAction.label)}
              disabled={advance.isPending}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document cards (in-room) ─────────────────────────────────────────

function InRoomDocumentChips({ docs }: { docs: InRoomDocuments }) {
  const signConsent = useSignConsent();
  const recordPayment = useRecordPayment(docs.invoice_id ?? "");
  const qc = useQueryClient();

  const handleSign = () => {
    if (!docs.consent_id) return;
    signConsent.mutate(
      { consentId: docs.consent_id, signatureData: "reception-confirmed" },
      {
        onSuccess: () => {
          toast.success("Consentement signé");
          qc.invalidateQueries({ queryKey: ["queue"] });
        },
        onError: () => toast.error("Erreur signature"),
      }
    );
  };

  const handlePay = () => {
    if (!docs.invoice_id) return;
    recordPayment.mutate(
      { amount: docs.invoice_total ?? 0, method: "cash" as const },
      {
        onSuccess: () => {
          toast.success("Paiement enregistré");
          qc.invalidateQueries({ queryKey: ["queue"] });
        },
        onError: () => toast.error("Erreur paiement"),
      }
    );
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Consent */}
      {docs.consent_id && (
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Consentement</span>
            </div>
            {docs.consent_status === "signed" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signé
              </span>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => window.open(`/api/v1/consents/${docs.consent_id}/pdf`, '_blank')}>
                  Imprimer
                </Button>
                <Button size="sm" className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600" onClick={handleSign} disabled={signConsent.isPending}>
                  Marquer signé
                </Button>
              </div>
            )}
          </div>
          {docs.consent_status !== "signed" && (
            <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Imprimer, faire signer, puis confirmer</p>
          )}
        </div>
      )}

      {/* Invoice */}
      {docs.invoice_id && (
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[var(--text-muted)]" />
              <Link href={`/invoices/${docs.invoice_id}`} className="text-xs font-medium text-[var(--text-primary)] hover:underline">
                Facture · {docs.invoice_total?.toLocaleString("fr-FR")} MAD
              </Link>
            </div>
            {docs.invoice_status === "paid" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Payé
              </span>
            ) : docs.invoice_status === "draft" ? (
              <FactureReviewDialog
                invoiceId={docs.invoice_id}
                lineItems={docs.invoice_line_items ?? [{ label: "Service", quantity: 1, unit_price: docs.invoice_total ?? 0 }]}
                discount={docs.invoice_discount ?? 0}
                total={docs.invoice_total ?? 0}
                currency="MAD"
                status="draft"
              />
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => window.open(`/invoices/${docs.invoice_id}`, '_blank')}>
                  PDF
                </Button>
                <Button size="sm" className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600" onClick={handlePay} disabled={recordPayment.isPending}>
                  Encaisser
                </Button>
              </div>
            )}
          </div>
          {docs.invoice_status === "draft" && (
            <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Réviser et valider la facture</p>
          )}
          {docs.invoice_status === "issued" && (
            <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Encaisser le paiement du patient</p>
          )}
        </div>
      )}

      {/* Prescriptions */}
      {docs.prescription_ids.length > 0 && docs.prescription_ids.map((rxId, i) => (
        <div key={rxId} className="rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--text-muted)]" />
              <Link href={`/prescriptions/${rxId}`} className="text-xs font-medium text-[var(--text-primary)] hover:underline">
                {docs.prescription_numbers[i] || "Ordonnance"}
              </Link>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => window.open(`/prescriptions/${rxId}`, '_blank')}>
              Imprimer
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PrepareButton({ patientId }: { patientId: string }) {
  const prepareMut = usePrepareSession();
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 w-full border-blue-200 text-blue-700 hover:bg-blue-50 text-xs h-8"
      disabled={prepareMut.isPending}
      onClick={() => {
        prepareMut.mutate(
          { patientId },
          {
            onSuccess: () => toast.success("Documents envoyés à la réception"),
            onError: () => toast.error("Erreur lors de la préparation"),
          }
        );
      }}
    >
      {prepareMut.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      Préparer (consentement + facture)
    </Button>
  );
}

// ── Column ────────────────────────────────────────────────────────────

interface ColumnProps {
  title: string;
  count: number;
  bgTint: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  emptyLabel: string;
  EmptyIcon: React.ComponentType<{ className?: string }>;
}

function Column({ title, count, bgTint, Icon, iconColor, children, emptyLabel, EmptyIcon }: ColumnProps) {
  const isEmpty = count === 0;
  return (
    <div className={cn(
      "flex flex-col rounded-2xl border border-[var(--border)] p-4 min-w-0 overflow-hidden",
      bgTint
    )}>
      {/* Header: title + count */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColor)} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <span className={cn(
          "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold",
          count > 0 ? "bg-[var(--primary)] text-white" : "bg-[var(--border)] text-[var(--text-muted)]"
        )}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 flex-1">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center">
            <EmptyIcon className="mb-2 h-8 w-8 text-[var(--text-muted)]/40" />
            <p className="text-xs text-[var(--text-muted)]">{emptyLabel}</p>
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
    const base = data.counts.awaiting_doctor + data.counts.in_room + (data.counts.checkout_pending ?? 0);
    return {
      total: isDoctor ? base : base + data.counts.intake_pending,
      checkout: data.counts.checkout_pending ?? 0,
    };
  }, [data, isDoctor]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement de la salle d&apos;attente...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
        <p className="text-sm">Impossible de charger la salle d&apos;attente.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Salle d&apos;attente
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {totals.total} patient{totals.total > 1 ? "s" : ""} en cours
            <span className="ml-2 inline-flex items-center gap-1">
              {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="text-[var(--text-muted)]">· live</span>
            </span>
          </p>
        </div>
        <WalkInDialog />
      </div>

      {/* Kanban columns */}
      <div className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2",
        isDoctor ? "xl:grid-cols-3" : "xl:grid-cols-4"
      )}>
        {/* Reception only — intake column */}
        {!isDoctor && (
          <Column
            title="Accueil"
            count={data.counts.intake_pending}
            bgTint="bg-amber-50/50"
            Icon={UserCheck}
            iconColor="text-amber-600"
            emptyLabel="Aucun patient à l'accueil"
            EmptyIcon={UserPlus}
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
        )}

        <Column
          title="En attente"
          count={data.counts.awaiting_doctor}
          bgTint="bg-blue-50/50"
          Icon={Clock}
          iconColor="text-blue-600"
          emptyLabel="Personne n'attend"
          EmptyIcon={Inbox}
        >
          {data.awaiting_doctor.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              primaryAction={isDoctor
                ? { label: "Commencer", to: "in_room" }
                : { label: "Patient entré en salle", to: "in_room" }}
              secondaryAction={isDoctor ? undefined : { label: "Retour", to: "intake_pending", variant: "ghost" }}
              showCallButton
            />
          ))}
        </Column>

        <Column
          title="En consultation"
          count={data.counts.in_room}
          bgTint="bg-emerald-50/50"
          Icon={Stethoscope}
          iconColor="text-emerald-600"
          emptyLabel="Aucune consultation"
          EmptyIcon={DoorOpen}
        >
          {data.in_room.map((p) => {
            const docs = (data.in_room_documents ?? []).find((d) => d.patient_id === p.id);
            const hasDocs = docs && (docs.consent_id || docs.invoice_id);
            return (
              <div key={p.id}>
                <PatientCard
                  patient={p}
                  primaryAction={isDoctor
                    ? { label: "Terminer", to: "checkout_pending" }
                    : undefined}
                  secondaryAction={{ label: "Renvoyer en attente", to: "awaiting_doctor", variant: "ghost" }}
                />
                {/* Doctor: show Préparer button when no documents yet */}
                {isDoctor && !hasDocs && (
                  <PrepareButton patientId={p.id} />
                )}
                {/* Reception: full document workflow */}
                {!isDoctor && hasDocs && (
                  <InRoomDocumentChips docs={docs} />
                )}
                {/* Doctor: read-only document status */}
                {isDoctor && hasDocs && (
                  <div className="mt-2 space-y-1.5">
                    {docs.consent_id && (
                      <div className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        docs.consent_status === "signed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}>
                        <FileText className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {docs.consent_status === "signed" ? "Consentement signé" : "Consentement en attente"}
                        </span>
                        {docs.consent_status === "signed" && <CheckCircle2 className="ml-auto h-3.5 w-3.5" />}
                      </div>
                    )}
                    {docs.invoice_id && (
                      <div className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        docs.invoice_status === "paid"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}>
                        <Receipt className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {docs.invoice_status === "paid"
                            ? "Facture payée"
                            : `Facture · ${docs.invoice_total?.toLocaleString("fr-FR")} MAD`}
                        </span>
                        {docs.invoice_status === "paid" && <CheckCircle2 className="ml-auto h-3.5 w-3.5" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Doctor tip */}
          {data.counts.in_room > 0 && isDoctor && !data.in_room.some((p) => (data.in_room_documents ?? []).find((d) => d.patient_id === p.id)) && (
            <p className="rounded-lg border border-dashed border-emerald-200 bg-white px-3 py-2.5 text-center text-xs text-emerald-600">
              Cliquez sur le nom du patient pour ouvrir le dossier
            </p>
          )}
        </Column>

        <Column
          title="Sortie"
          count={data.counts.checkout_pending ?? 0}
          bgTint="bg-rose-50/50"
          Icon={CreditCard}
          iconColor="text-rose-600"
          emptyLabel="Personne à encaisser"
          EmptyIcon={CheckCircle2}
        >
          {(data.checkout_pending ?? []).map((p) => {
            const docs = (data.checkout_documents ?? []).find((d) => d.patient_id === p.id);
            const hasOrdonnances = docs && docs.prescription_ids.length > 0;
            return (
              <div key={p.id}>
                <PatientCard
                  patient={p}
                  primaryAction={{ label: "Libérer", to: "active" }}
                  secondaryAction={{ label: "Renvoyer", to: "in_room", variant: "ghost" }}
                />
                {hasOrdonnances && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 px-1">Ordonnances</p>
                    {docs.prescription_ids.map((rxId, i) => (
                      <div key={rxId} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                        <Link
                          href={`/prescriptions/${rxId}`}
                          className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] hover:text-[var(--primary)]"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-500" />
                          {docs.prescription_numbers[i] || "Ordonnance"}
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => window.open(`/prescriptions/${rxId}`, '_blank')}
                        >
                          Imprimer
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {!hasOrdonnances && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-600">
                    Prêt à libérer
                  </p>
                )}
              </div>
            );
          })}
        </Column>
      </div>

      {/* Footer info strip */}
      <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-xs text-[var(--text-muted)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
        <span>Flux : Accueil → Attente → Consultation → Sortie. Actualisation automatique toutes les 4 secondes.</span>
      </div>
    </div>
  );
}
