"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Plus,
  Calendar,
  User,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { CommencerSeanceDialog } from "@/components/plans/commencer-seance-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import {
  usePatientPlans,
  usePatientProgrammes,
  useCreateProgramme,
  usePlanTimeline,
  useAdvanceSession,
  type SessionStatus,
  type TreatmentPlan,
} from "@/lib/api/plans";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  inline?: boolean;
}

/* ─── Progress Ring (SVG circular) ──────────────────────────── */
function ProgressRing({
  completed,
  total,
  size = 40,
  strokeWidth = 3.5,
}: {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={pct >= 1 ? "var(--success)" : "var(--primary)"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]"
      >
        {completed}/{total}
      </span>
    </div>
  );
}

/* ─── Segmented Progress Bar ────────────────────────────────── */
function SegmentedProgress({
  sessions,
}: {
  sessions: Array<{ status: string }>;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="flex gap-0.5 w-full h-1.5 rounded-full overflow-hidden">
      {sessions.map((s, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-full transition-colors",
            s.status === "completed"
              ? "bg-[var(--success)]"
              : s.status === "in_progress"
              ? "bg-[var(--primary)]"
              : s.status === "skipped"
              ? "bg-[var(--danger)]"
              : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

/* ─── Status dot for séance timeline row ────────────────────── */
function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        status === "completed" && "bg-[var(--success)]",
        status === "in_progress" && "bg-[var(--primary)] animate-pulse",
        status === "skipped" && "bg-[var(--danger)]",
        (status === "scheduled" || status === "planned") && "bg-gray-300"
      )}
    />
  );
}

function fmtShort(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

/* ─── Inline Séance Detail (expanded inside plan card) ──────── */
function InlineSeanceDetail({
  planId,
  patientId,
}: {
  planId: string;
  patientId: string;
}) {
  const { data: timeline, isLoading } = usePlanTimeline(planId);
  const advance = useAdvanceSession(planId);

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Chargement...
      </div>
    );
  if (!timeline) return null;

  const { plan, sessions, invoices: planInvoices } = timeline;

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--background)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Séances — {plan.primary_service || plan.title}
        </p>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {sessions.filter((e) => e.session.status === "completed").length}/
          {plan.total_sessions} terminées
        </span>
      </div>

      {/* Séance rows */}
      <div className="divide-y divide-[var(--border)]">
        {sessions.map((entry) => {
          const s = entry.session;
          const isNext =
            (s.status === "scheduled" || s.status === "planned") &&
            !sessions.some(
              (prev) =>
                prev.session.session_number < s.session_number &&
                (prev.session.status === "scheduled" ||
                  prev.session.status === "planned")
            );

          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-xs",
                s.status === "in_progress" && "bg-blue-50/50"
              )}
            >
              {/* Number circle */}
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  s.status === "completed"
                    ? "bg-[var(--success)] text-white"
                    : s.status === "in_progress"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-gray-100 text-[var(--text-muted)]"
                )}
              >
                {s.session_number}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[var(--text-primary)]">
                    Séance {s.session_number}
                  </span>
                  <StatusDot status={s.status} />
                  <span className="text-[var(--text-muted)]">
                    {s.status === "completed"
                      ? "Terminée"
                      : s.status === "in_progress"
                      ? "En cours"
                      : s.status === "skipped"
                      ? "Sautée"
                      : s.planned_for
                      ? fmtShort(s.planned_for)
                      : "À planifier"}
                  </span>
                </div>
              </div>

              {/* Price */}
              {s.session_price != null && s.session_price > 0 && (
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {s.session_price.toLocaleString("fr-FR")} MAD
                </span>
              )}

              {/* Action: Commencer for the next scheduled session */}
              {isNext && (
                <CommencerSeanceDialog
                  planId={planId}
                  sessionId={s.id}
                  sessionNumber={s.session_number}
                  patientId={patientId}
                  patientName=""
                  treatmentName={plan.primary_service || plan.title}
                  sessionPrice={s.session_price}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Plan Card (unified for standalone & programme-nested) ─── */
function PlanCard({
  plan,
  patientId,
  inline,
  isSelected,
  onToggle,
}: {
  plan: {
    id: string;
    title: string;
    primary_service?: string | null;
    status: string;
    total_sessions: number;
    completed_sessions: number;
    estimated_total?: number | null;
  };
  patientId: string;
  inline: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const completed = plan.completed_sessions;
  const total = plan.total_sessions;

  // Find the "next" session date from the plan data we have
  const content = (
    <div className="flex items-center gap-3">
      <ProgressRing completed={completed} total={total} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {plan.title}
          </p>
          <Badge
            variant={
              plan.status === "active"
                ? "default"
                : plan.status === "completed"
                ? "success"
                : "outline"
            }
            className="text-[10px] shrink-0"
          >
            {plan.status === "active"
              ? "Actif"
              : plan.status === "completed"
              ? "Terminé"
              : plan.status === "cancelled"
              ? "Annulé"
              : plan.status}
          </Badge>
        </div>
        {plan.primary_service && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
            {plan.primary_service}
          </p>
        )}
      </div>

      {plan.estimated_total != null && plan.estimated_total > 0 && (
        <span className="text-xs font-mono font-medium text-[var(--text-secondary)] shrink-0">
          {plan.estimated_total.toLocaleString("fr-FR")} MAD
        </span>
      )}

      {inline ? (
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--text-muted)] transition-transform shrink-0",
            !isSelected && "-rotate-90"
          )}
        />
      ) : (
        <ChevronRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
      )}
    </div>
  );

  if (inline) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full rounded-xl border p-3 text-left transition-all",
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary-lighter)] shadow-sm"
              : "border-[var(--border)] bg-white hover:border-[var(--primary)] hover:shadow-sm"
          )}
        >
          {content}
        </button>
        {isSelected && (
          <InlineSeanceDetail planId={plan.id} patientId={patientId} />
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-xl border border-[var(--border)] bg-white p-3 transition-all hover:border-[var(--primary)] hover:shadow-sm"
    >
      {content}
    </Link>
  );
}

/* ─── Main Section ──────────────────────────────────────────── */
export function ProgrammePlansSection({
  patientId,
  inline = false,
}: Props) {
  const { data: plansData } = usePatientPlans(patientId);
  const plans: TreatmentPlan[] = plansData?.plans ?? [];
  const { data: programmesData } = usePatientProgrammes(patientId);
  const programmes = programmesData?.programmes ?? [];
  const createProgramme = useCreateProgramme();
  const [newProgTitle, setNewProgTitle] = useState("");
  const [showNewProg, setShowNewProg] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const standalonePlans = plans.filter((p) => !p.programme_id);
  const hasContent = programmes.length > 0 || standalonePlans.length > 0;

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {!hasContent && (
        <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Aucun plan de traitement
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Créer un premier plan pour commencer le suivi.
          </p>
          <div className="mt-4">
            <NewPlanDialog patientId={patientId} />
          </div>
        </div>
      )}

      {/* Programmes */}
      {programmes.map((prog) => {
        const progPct =
          prog.total_sessions > 0
            ? Math.round((prog.completed_sessions / prog.total_sessions) * 100)
            : 0;

        return (
          <Card key={prog.id} className="overflow-hidden">
            {/* Programme header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <ProgressRing
                  completed={prog.completed_sessions}
                  total={prog.total_sessions}
                  size={44}
                />
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {prog.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {prog.plans.length} plan
                    {prog.plans.length > 1 ? "s" : ""} ·{" "}
                    {prog.total_cost.toLocaleString("fr-FR")} MAD
                  </p>
                </div>
              </div>
              <Badge
                variant={prog.status === "active" ? "default" : "outline"}
                className="text-[10px]"
              >
                {prog.status === "active" ? "Actif" : "Terminé"}
              </Badge>
            </div>

            {/* Plans inside programme */}
            <div className="p-3 space-y-2">
              {prog.plans.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] py-2 text-center">
                  Aucun plan dans ce programme.
                </p>
              )}
              {prog.plans.map((pp) => (
                <PlanCard
                  key={pp.id}
                  plan={{
                    id: pp.id,
                    title: pp.title,
                    primary_service: pp.primary_service,
                    status: pp.status,
                    total_sessions: pp.total_sessions,
                    completed_sessions: pp.completed_sessions,
                    estimated_total: pp.estimated_total,
                  }}
                  patientId={patientId}
                  inline={inline}
                  isSelected={selectedPlanId === pp.id}
                  onToggle={() =>
                    setSelectedPlanId(
                      selectedPlanId === pp.id ? null : pp.id
                    )
                  }
                />
              ))}
              <NewPlanDialog
                patientId={patientId}
                programmeId={prog.id}
                triggerLabel="+ Ajouter un plan"
              />
            </div>
          </Card>
        );
      })}

      {/* Standalone plans */}
      {standalonePlans.length > 0 && (
        <div className="space-y-2">
          {standalonePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={{
                id: plan.id,
                title: plan.title,
                primary_service: plan.primary_service,
                status: plan.status,
                total_sessions: plan.total_sessions,
                completed_sessions: plan.sessions.filter(
                  (s) => s.status === "completed"
                ).length,
                estimated_total: plan.estimated_total,
              }}
              patientId={patientId}
              inline={inline}
              isSelected={selectedPlanId === plan.id}
              onToggle={() =>
                setSelectedPlanId(
                  selectedPlanId === plan.id ? null : plan.id
                )
              }
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {hasContent && (
        <div className="flex gap-2">
          {showNewProg ? (
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="ex. Rajeunissement visage"
                value={newProgTitle}
                onChange={(e) => setNewProgTitle(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newProgTitle.trim()) return;
                  createProgramme.mutate(
                    {
                      patient_id: patientId,
                      title: newProgTitle.trim(),
                    },
                    {
                      onSuccess: () => {
                        toast.success("Programme créé");
                        setNewProgTitle("");
                        setShowNewProg(false);
                      },
                    }
                  );
                }}
                disabled={createProgramme.isPending}
              >
                Créer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNewProg(false)}
              >
                Annuler
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewProg(true)}
              >
                <Plus className="h-3 w-3" />
                Nouveau programme
              </Button>
              <NewPlanDialog patientId={patientId} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
