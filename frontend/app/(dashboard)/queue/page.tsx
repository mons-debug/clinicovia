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
      "p-3 transition-all",
      called
        ? "border-2 border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300/60 animate-pulse"
        : "hover:shadow-card-hover"
    )}>
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-lighter)] text-xs font-semibold text-[var(--primary)]">
          {initials(p)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/patients/${p.id}`}
            className="block truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline"
          >
            {p.first_name} {p.last_name}
            {p.lead_source === "whatsapp" && (
              <span className="ml-1 text-[9px] font-normal text-[var(--whatsapp)]">WA</span>
            )}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-0.5">
              <Phone className="h-2.5 w-2.5" />
              {p.phone}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatWait((p as Patient & { intake_at?: string | null }).intake_at)}
            </span>
          </div>
          {(p as Patient & { requested_service?: string | null }).requested_service && (
            <p className="mt-1.5 truncate rounded bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {(p as Patient & { requested_service?: string | null }).requested_service}
            </p>
          )}
        </div>
      </div>

      {/* Doctor → reception ping (only doctors see this on EN ATTENTE cards) */}
      {showCallButton && isDoctor && (
        called ? (
          <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-100 px-2 py-1.5 text-[11px] font-semibold text-emerald-800">
            <span className="inline-flex items-center gap-1">
              <BellRing className="h-3 w-3" />
              Appelé
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
            className="mt-2 w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-[11px]"
            disabled={callMut.isPending}
            onClick={fireCall}
          >
            {callMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellRing className="h-3 w-3" />}
            Appeler
          </Button>
        )
      )}

      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex gap-1.5">
          {primaryAction && (
            <Button
              size="sm"
              variant={primaryAction.variant ?? "default"}
              className="flex-1 text-[11px] px-2 h-8"
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
              className="text-[11px] px-2 h-8"
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
    <div className="mt-1 rounded-md bg-emerald-50 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Documents à traiter</p>

      {/* Consent */}
      {docs.consent_id && (
        <div className="rounded-md border border-emerald-200 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              Consentement
            </span>
            <span className="flex-1" />
            {docs.consent_status === "signed" ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signé
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => window.open(`/api/v1/consents/${docs.consent_id}/pdf`, '_blank')}>
                  Imprimer
                </Button>
                <Button size="sm" className="h-6 text-[11px] bg-amber-500 hover:bg-amber-600 whitespace-nowrap" onClick={handleSign} disabled={signConsent.isPending}>
                  Signé par patient
                </Button>
              </div>
            )}
          </div>
          {docs.consent_status !== "signed" && (
            <p className="text-[10px] text-gray-500">Imprimer → faire signer le patient → cliquer Signé</p>
          )}
        </div>
      )}

      {/* Facture */}
      {docs.invoice_id && (
        <div className="rounded-md border border-emerald-200 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Link href={`/invoices/${docs.invoice_id}`} className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:underline">
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              Facture · {docs.invoice_total?.toLocaleString("fr-FR")} MAD
            </Link>
            <span className="flex-1" />
            {docs.invoice_status === "paid" ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Payé
              </span>
            ) : docs.invoice_status === "draft" ? (
              <div className="flex gap-1.5">
                <FactureReviewDialog
                  invoiceId={docs.invoice_id}
                  lineItems={docs.invoice_line_items ?? [{ label: "Service", quantity: 1, unit_price: docs.invoice_total ?? 0 }]}
                  discount={docs.invoice_discount ?? 0}
                  total={docs.invoice_total ?? 0}
                  currency="MAD"
                  status="draft"
                />
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => window.open(`/invoices/${docs.invoice_id}`, '_blank')}>
                  PDF
                </Button>
                <Button size="sm" className="h-6 text-[11px] bg-amber-500 hover:bg-amber-600" onClick={handlePay} disabled={recordPayment.isPending}>
                  Payé
                </Button>
              </div>
            )}
          </div>
          {docs.invoice_status === "draft" && (
            <p className="text-[10px] text-gray-500">Réviser la facture → valider avant paiement</p>
          )}
          {docs.invoice_status === "issued" && (
            <p className="text-[10px] text-gray-500">Encaisser le paiement → cliquer Payé</p>
          )}
        </div>
      )}

      {/* Prescriptions */}
      {docs.prescription_ids.length > 0 && docs.prescription_ids.map((rxId, i) => (
        <div key={rxId} className="rounded-md border border-emerald-200 bg-white p-2.5">
          <div className="flex items-center justify-between">
            <Link href={`/prescriptions/${rxId}`} className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:underline">
              <FileText className="h-3.5 w-3.5" />
              {docs.prescription_numbers[i] || "Ordonnance"}
            </Link>
            <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => window.open(`/prescriptions/${rxId}`, '_blank')}>
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
      className="mt-2 w-full border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px]"
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
        <Send className="h-3 w-3" />
      )}
      Préparer (consentement + facture)
    </Button>
  );
}

function Column({ title, subtitle, count, accent, Icon, children, empty }: ColumnProps) {
  const isEmpty = count === 0;
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 min-w-0 overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="truncate text-[10px] text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
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
    const base = data.counts.awaiting_doctor + data.counts.in_room + (data.counts.checkout_pending ?? 0);
    return {
      total: isDoctor ? base : base + data.counts.intake_pending,
      checkout: data.counts.checkout_pending ?? 0,
    };
  }, [data, isDoctor]);

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
          {!isDoctor && <WalkInDialog />}
        </div>
      </div>

      {/* Columns — left-to-right is the patient flow */}
      <div className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2",
        isDoctor ? "xl:grid-cols-3" : "xl:grid-cols-4"
      )}>
        {/* Reception only — intake column */}
        {!isDoctor && (
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
        )}

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
          subtitle="Médecin avec le patient"
          count={data.counts.in_room}
          accent="bg-emerald-50 text-emerald-700"
          Icon={DoorOpen}
          empty="Aucune consultation en cours"
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
                {/* Reception: full document workflow (consent, facture, ordonnance) */}
                {!isDoctor && hasDocs && (
                  <InRoomDocumentChips docs={docs} />
                )}
                {/* Doctor: light document status chips (read-only) */}
                {isDoctor && hasDocs && (
                  <div className="mt-1 rounded-md bg-emerald-50 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Documents</p>
                    <div className="flex flex-wrap gap-1.5">
                      {docs.consent_id && (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          docs.consent_status === "signed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          <FileText className="h-3 w-3" />
                          {docs.consent_status === "signed" ? "Consentement signé" : "Consentement en attente"}
                        </span>
                      )}
                      {docs.invoice_id && (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          docs.invoice_status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          <Receipt className="h-3 w-3" />
                          {docs.invoice_status === "paid"
                            ? "Facture payée"
                            : `Facture · ${docs.invoice_total?.toLocaleString("fr-FR")} MAD`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Doctor tip — click patient name to open dossier */}
          {data.counts.in_room > 0 && isDoctor && !data.in_room.some((p) => (data.in_room_documents ?? []).find((d) => d.patient_id === p.id)) && (
            <p className="mt-1 rounded-md bg-emerald-50 px-3 py-2 text-center text-[11px] text-emerald-700">
              Clic sur le nom du patient pour ouvrir le dossier
            </p>
          )}
        </Column>

        <Column
          title="À encaisser"
          subtitle="Traitement terminé · ordonnances"
          count={data.counts.checkout_pending ?? 0}
          accent="bg-rose-50 text-rose-700"
          Icon={Receipt}
          empty="Personne à encaisser"
        >
          {(data.checkout_pending ?? []).map((p) => {
            const docs = (data.checkout_documents ?? []).find((d) => d.patient_id === p.id);
            const hasOrdonnances = docs && docs.prescription_ids.length > 0;
            return (
              <div key={p.id}>
                <PatientCard
                  patient={p}
                  primaryAction={{ label: "Terminé · libérer", to: "active" }}
                  secondaryAction={{ label: "Renvoyer au médecin", to: "in_room", variant: "ghost" }}
                />
                {hasOrdonnances && (
                  <div className="mt-1 space-y-1.5 rounded-md bg-blue-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Ordonnances à imprimer</p>
                    <div className="flex flex-wrap gap-2">
                      {docs.prescription_ids.map((rxId, i) => (
                        <Link
                          key={rxId}
                          href={`/prescriptions/${rxId}`}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:border-blue-400"
                        >
                          <FileText className="h-3 w-3" />
                          {docs.prescription_numbers[i] || "Ordonnance"}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {!hasOrdonnances && (
                  <div className="mt-1 rounded-md bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] text-emerald-700">Aucune ordonnance · prêt à libérer</p>
                  </div>
                )}
              </div>
            );
          })}
        </Column>
      </div>

      {/* Done strip */}
      <div className="rounded-lg border border-[var(--line-soft,_#E2E8F0)] bg-white p-4 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
          Le médecin termine la séance (Terminer) — le patient passe à « À encaisser » pour ordonnances et sortie.
        </span>
      </div>
    </div>
  );
}
