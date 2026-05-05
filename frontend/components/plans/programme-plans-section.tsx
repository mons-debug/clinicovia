"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function InlineSeanceDetail({ planId, patientId }: { planId: string; patientId: string }) {
  const { data: timeline, isLoading } = usePlanTimeline(planId);
  const advance = useAdvanceSession(planId);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [seanceStep, setSeanceStep] = useState(0);

  if (isLoading) return <p className="p-2 text-xs text-[var(--text-muted)]">Chargement...</p>;
  if (!timeline) return null;

  const { plan, sessions, invoices: planInvoices } = timeline;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Séances — {plan.primary_service || plan.title}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">
          {sessions.filter((e) => e.session.status === "completed").length}/{plan.total_sessions} terminées
        </span>
      </div>
      {sessions.map((entry) => {
        const s = entry.session;
        const isExpanded = expandedSession === s.id;
        const sessionInvs = planInvoices.filter((inv) => inv.session_id === s.id);
        return (
          <div key={s.id} className="rounded-md border border-[var(--border)] bg-[var(--background)]">
            <button
              type="button"
              onClick={() => { setExpandedSession(isExpanded ? null : s.id); setSeanceStep(0); }}
              className="flex w-full items-center justify-between p-2.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                  {s.session_number}
                </span>
                <span className="font-medium">Séance {s.session_number}</span>
                <Badge variant={s.status === "completed" ? "success" : s.status === "in_progress" ? "default" : "outline"} className="text-[9px]">
                  {s.status === "completed" ? "Terminée" : s.status === "in_progress" ? "En cours" : s.status === "scheduled" ? "Programmée" : s.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {s.session_price != null && s.session_price > 0 && (
                  <span className="font-mono text-[var(--text-muted)]">{s.session_price.toLocaleString("fr-FR")} MAD</span>
                )}
                <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-[var(--border)] p-3 space-y-3">
                <div className="flex gap-1">
                  {["Photos av.", "Traitement", "Photos ap.", "Ordonnance", "Facture"].map((label, i) => (
                    <button key={label} type="button" onClick={() => setSeanceStep(i)}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                        i === seanceStep ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-[var(--text-muted)] hover:bg-gray-200"
                      )}>{label}</button>
                  ))}
                </div>
                {seanceStep === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">Photos avant — {entry.photos.filter((ph) => ph.stage === "before").length} photo(s)</p>
                )}
                {seanceStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">Score, produits, notes</p>
                    {s.outcome_score && <p className="text-xs">Score: <span className="font-bold">{s.outcome_score}/10</span></p>}
                    {s.outcome_note && <p className="text-xs text-[var(--text-secondary)]">{s.outcome_note}</p>}
                  </div>
                )}
                {seanceStep === 2 && (
                  <p className="text-xs text-[var(--text-muted)]">Photos après — {entry.photos.filter((ph) => ph.stage === "after" || ph.stage === "follow_up").length} photo(s)</p>
                )}
                {seanceStep === 3 && (
                  <div className="space-y-2">
                    {entry.prescriptions.length > 0 ? entry.prescriptions.map((rx) => (
                      <div key={rx.id} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs">
                        <span className="font-mono font-bold">{rx.number}</span>
                        <Badge variant={rx.status === "signed" ? "success" : "outline"}>{rx.status === "signed" ? "Signée" : "Brouillon"}</Badge>
                      </div>
                    )) : <p className="text-xs text-[var(--text-muted)]">Aucune ordonnance</p>}
                    <NewPrescriptionDialog patientId={patientId} appointmentId={entry.appointment?.id} />
                  </div>
                )}
                {seanceStep === 4 && (
                  <div className="space-y-2">
                    {sessionInvs.length > 0 ? sessionInvs.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs">
                        <span className="font-mono font-bold">{inv.number}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{inv.total.toLocaleString("fr-FR")} MAD</span>
                          <Badge variant={inv.status === "paid" ? "success" : inv.status === "issued" ? "default" : "outline"}>
                            {inv.status === "paid" ? "Payée" : inv.status === "issued" ? "Émise" : "Brouillon"}
                          </Badge>
                        </div>
                      </div>
                    )) : <p className="text-xs text-[var(--text-muted)]">Facture auto-créée via Préparer ou Terminer</p>}
                    <NewInvoiceDialog patientId={patientId} planId={planId} sessionId={s.id} sessionPrice={s.session_price} treatmentName={plan.primary_service} />
                  </div>
                )}
                {(s.status === "scheduled" || s.status === "planned") && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgrammePlansSection({ patientId, inline = false }: Props) {
  const { data: plansData } = usePatientPlans(patientId);
  const plans: TreatmentPlan[] = plansData?.plans ?? [];
  const { data: programmesData } = usePatientProgrammes(patientId);
  const programmes = programmesData?.programmes ?? [];
  const createProgramme = useCreateProgramme();
  const [newProgTitle, setNewProgTitle] = useState("");
  const [showNewProg, setShowNewProg] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {/* Programmes */}
      {programmes.map((prog) => (
        <div key={prog.id} className="rounded-lg border border-[var(--border)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{prog.title}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {prog.completed_sessions}/{prog.total_sessions} séances · {prog.total_cost.toLocaleString("fr-FR")} MAD
              </p>
            </div>
            <Badge variant={prog.status === "active" ? "default" : "outline"}>
              {prog.status === "active" ? "Actif" : "Terminé"}
            </Badge>
          </div>
          <div className="space-y-1.5 pl-3 border-l-2 border-[var(--primary-lighter,_#d1d5db)]">
            {prog.plans.length === 0 && (
              <p className="text-[11px] text-[var(--text-muted)] py-1">Aucun plan. Ajoutez-en un.</p>
            )}
            {prog.plans.map((pp) => (
              <div key={pp.id}>
                {inline ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedPlanId(selectedPlanId === pp.id ? null : pp.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md p-2 text-xs transition-colors",
                        selectedPlanId === pp.id ? "bg-[var(--primary-lighter)] border border-[var(--primary)]" : "bg-[var(--background)] hover:bg-gray-100"
                      )}
                    >
                      <div>
                        <span className="font-medium">{pp.title}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{pp.completed_sessions}/{pp.total_sessions} séances</span>
                      </div>
                      {pp.estimated_total != null && (
                        <span className="font-mono text-[var(--text-muted)]">{pp.estimated_total.toLocaleString("fr-FR")} MAD</span>
                      )}
                    </button>
                    {selectedPlanId === pp.id && <InlineSeanceDetail planId={pp.id} patientId={patientId} />}
                  </>
                ) : (
                  <Link href={`/plans/${pp.id}`} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs hover:bg-gray-100">
                    <span className="font-medium">{pp.title} · {pp.completed_sessions}/{pp.total_sessions}</span>
                    {pp.estimated_total != null && <span className="font-mono text-[var(--text-muted)]">{pp.estimated_total.toLocaleString("fr-FR")} MAD</span>}
                  </Link>
                )}
              </div>
            ))}
            <NewPlanDialog patientId={patientId} programmeId={prog.id} triggerLabel="+ Ajouter un plan" />
          </div>
        </div>
      ))}

      {/* Standalone plans */}
      {plans.filter((p) => !p.programme_id).map((plan) => (
        <div key={plan.id}>
          {inline ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-colors",
                  selectedPlanId === plan.id ? "border-[var(--primary)] bg-[var(--primary-lighter)]" : "border-[var(--border)] hover:border-[var(--primary)]"
                )}
              >
                <span className="font-medium text-[var(--text-primary)]">{plan.title}</span>
                <Badge variant={plan.status === "active" ? "default" : "outline"}>
                  {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status}
                </Badge>
              </button>
              {selectedPlanId === plan.id && <InlineSeanceDetail planId={plan.id} patientId={patientId} />}
            </>
          ) : (
            <Link href={`/plans/${plan.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--primary)]">
              <span className="font-medium text-[var(--text-primary)]">{plan.title}</span>
              <Badge variant={plan.status === "active" ? "default" : "outline"}>
                {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status}
              </Badge>
            </Link>
          )}
        </div>
      ))}

      {/* Actions */}
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
            <Button size="sm" onClick={() => {
              if (!newProgTitle.trim()) return;
              createProgramme.mutate(
                { patient_id: patientId, title: newProgTitle.trim() },
                { onSuccess: () => { toast.success("Programme créé"); setNewProgTitle(""); setShowNewProg(false); } }
              );
            }} disabled={createProgramme.isPending}>Créer</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewProg(false)}>Annuler</Button>
          </div>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setShowNewProg(true)}>Nouveau programme</Button>
            <NewPlanDialog patientId={patientId} />
          </>
        )}
      </div>
    </div>
  );
}
