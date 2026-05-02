"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  Pencil,
  StickyNote,
  Activity,
  User,
  DollarSign,
  Star,
  Loader2,
  AlertCircle,
  Pin,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { IdentityEditCard } from "@/components/patient/identity-edit-card";
import { ClinicalEditCard } from "@/components/patient/clinical-edit-card";
import { ScreeningCard } from "@/components/patient/screening-card";
import { TerminerVisiteButton } from "@/components/patient/terminer-visite-button";
import { SessionChecklist } from "@/components/patient/session-checklist";
import { DoctorBento } from "@/components/patient/doctor-bento";
import { useSessionContext } from "@/lib/api/session-context";
import { usePatientConsents, useCreateConsent } from "@/lib/api/consents";
import { IdentiteTab } from "@/components/patient/tabs/identite-tab";
import { ScreeningTab } from "@/components/patient/tabs/screening-tab";
import { ClinicalTab } from "@/components/patient/tabs/clinical-tab";
import { PlanGeneralTab } from "@/components/patient/tabs/plan-general-tab";
import { ConsultationTab } from "@/components/patient/tabs/consultation-tab";
import { PhotosCard } from "@/components/photos/photos-card";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import {
  usePatient,
  usePatientNotes,
  usePatientActivities,
  useCreatePatientNote,
} from "@/lib/api/patients";
import { usePatientPlans, usePatientProgrammes, useCreateProgramme, type TreatmentPlan } from "@/lib/api/plans";
import { useInvoices, type Invoice as InvoiceType, type InvoiceStatus } from "@/lib/api/invoices";
import { usePatientPrescriptions, type Prescription as PrescriptionType, type PrescriptionStatus } from "@/lib/api/prescriptions";
import { usePatientConsultations, type Consultation as ConsultationType, type ConsultationStatus } from "@/lib/api/consultations";
import { useConversations, useWhatsAppSessions, startConversation } from "@/lib/api/whatsapp";

const tabs = [
  { key: "overview", label: "Dossier", icon: User },
  { key: "conversations", label: "Conversations", icon: MessageSquare },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "activity", label: "Activité", icon: Activity },
] as const;

const INTAKE_LABEL: Record<string, string> = {
  intake_pending: "À l'accueil",
  awaiting_doctor: "En attente",
  in_room: "En consultation",
  active: "Actif",
  archived: "Archivé",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone: "Téléphone",
  email: "E-mail",
  sms: "SMS",
};

type TabKey = (typeof tabs)[number]["key"];

export default function PatientProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [noteContent, setNoteContent] = useState("");
  const [wizardCollapsed, setWizardCollapsed] = useState(false);

  const router = useRouter();
  const { data: patient, isLoading, isError, error } = usePatient(id);
  const { data: sessionCtx } = useSessionContext(id);
  const { data: sessionsData } = useWhatsAppSessions();
  const connectedSessions = (sessionsData?.sessions || []).filter((s) => s.status === "connected");
  const { data: notes = [] } = usePatientNotes(id);
  const { data: activities = [] } = usePatientActivities(id);
  const createNoteMutation = useCreatePatientNote(id);
  const { data: convsData } = useConversations({ patient_id: id });
  const patientConversations = convsData?.conversations || [];
  const { data: plansData } = usePatientPlans(id);
  const plans: TreatmentPlan[] = plansData?.plans ?? [];
  const { data: programmesData } = usePatientProgrammes(id);
  const programmes = programmesData?.programmes ?? [];
  const createProgramme = useCreateProgramme();
  const [newProgTitle, setNewProgTitle] = useState("");
  const [showNewProgDossier, setShowNewProgDossier] = useState(false);
  const { data: invoicesData } = useInvoices({ patientId: id });
  const invoices: InvoiceType[] = invoicesData?.invoices ?? [];
  const { data: prescriptionsData } = usePatientPrescriptions(id);
  const prescriptions: PrescriptionType[] = prescriptionsData?.prescriptions ?? [];
  const { data: consultationsData } = usePatientConsultations(id);
  const consultations: ConsultationType[] = consultationsData?.consultations ?? [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast.error("La note ne peut pas être vide");
      return;
    }
    try {
      await createNoteMutation.mutateAsync({ content: noteContent.trim() });
      setNoteContent("");
      toast.success("Note ajoutée");
    } catch {
      toast.error("Impossible d'ajouter la note");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Chargement du dossier…</span>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="space-y-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux patients
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : "Patient not found"}
          </p>
        </div>
      </div>
    );
  }

  const p = patient;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux patients
      </Link>

      {/* Patient header card */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: "#0D4F6C" }}
            >
              {p.first_name[0]}{p.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">
                  {p.first_name} {p.last_name}
                </h1>
                <StatusBadge
                  status={p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  variant={getStatusVariant(p.status)}
                  dot
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {p.phone_country_code}{p.phone}
                </span>
                {p.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {p.email}
                  </span>
                )}
                {(p.city || p.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {[p.city, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              {p.tags.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-md px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!p.phone) return;
                const session = connectedSessions[0];
                if (!session) {
                  toast.error("No WhatsApp number connected");
                  return;
                }
                try {
                  const phone = `${p.phone_country_code}${p.phone}`.replace(/\D/g, "");
                  const jid = `${phone}@s.whatsapp.net`;
                  const conv = await startConversation(session.id, jid, `${p.first_name} ${p.last_name}`);
                  router.push(`/whatsapp?conversation=${conv.id}`);
                } catch {
                  toast.error("Failed to start WhatsApp conversation");
                }
              }}
              disabled={!p.phone || connectedSessions.length === 0}
              className={`flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium transition-colors ${
                p.phone && connectedSessions.length > 0
                  ? "text-text-primary hover:bg-gray-50"
                  : "cursor-not-allowed text-text-muted"
              }`}
              title={!p.phone ? "No phone number" : connectedSessions.length === 0 ? "No WhatsApp connected" : "Send WhatsApp message"}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </button>
            {p.intake_status === "in_room" && (
              <TerminerVisiteButton
                patientId={p.id}
                patientName={`${p.first_name} ${p.last_name}`}
                canTerminate={sessionCtx?.can_terminate}
                sessionPrice={sessionCtx?.session_price}
                treatment={sessionCtx?.treatment}
                mode={sessionCtx?.mode}
                planTitle={sessionCtx?.plan_title}
                sessionNumber={sessionCtx?.session_number}
                totalSessions={sessionCtx?.total_sessions}
                soapExists={sessionCtx?.soap_exists}
                ordonnanceExists={sessionCtx?.ordonnance_exists}
                ordonnanceCount={sessionCtx?.ordonnance_count}
                photosBefore={sessionCtx?.photos_before}
                photosAfter={sessionCtx?.photos_after}
                factureStatus={sessionCtx?.facture_status}
                factureAmount={sessionCtx?.facture_amount}
              />
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Score lead", value: `${p.lead_score}/100`, icon: Star, color: "#F59E0B" },
            { label: "Total dépensé", value: `${p.total_spent.toLocaleString("fr-FR")} MAD`, icon: DollarSign, color: "#10B981" },
            { label: "Valeur vie", value: `${p.lifetime_value.toLocaleString("fr-FR")} MAD`, icon: DollarSign, color: "#059669" },
            { label: "Patient depuis", value: formatDate(p.created_at), icon: Calendar, color: "#3B82F6" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: stat.color }} />
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-text-primary">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-light text-primary-light"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {/* Tab content */}
      {activeTab === "overview" && p.intake_status === "in_room" && wizardCollapsed && (
        <button
          type="button"
          onClick={() => setWizardCollapsed(false)}
          className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-400 bg-emerald-50 px-5 py-3 transition-colors hover:bg-emerald-100"
        >
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-emerald-800">
              {sessionCtx?.mode === "seance"
                ? `Séance ${sessionCtx.session_number}/${sessionCtx.total_sessions} en cours — ${sessionCtx.treatment}`
                : `Consultation en cours — ${sessionCtx?.treatment || ""}`}
            </span>
          </div>
          <span className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
            Reprendre la séance
          </span>
        </button>
      )}
      {activeTab === "overview" && p.intake_status === "in_room" && !wizardCollapsed && (
        <DoctorBento patientId={p.id} patientName={`${p.first_name} ${p.last_name}`} patient={p} onCollapse={() => setWizardCollapsed(true)} />
      )}

      {activeTab === "overview" && p.intake_status !== "in_room" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Identité — always-on, role-gated edit (reception) */}
            <IdentityEditCard patient={p} />

            {/* Dossier clinique — always-on, role-gated edit (doctor) */}
            <ClinicalEditCard patient={p} />

            {/* Screening pré-traitement — 19-flag checklist (doctor edits) */}
            <ScreeningCard patientId={p.id} />

            {/* Demande à l'accueil + statut salle (read-only summary) */}
            {(p.requested_service || p.intake_status) && (
              <div className="rounded-xl border border-border bg-white p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted">Statut salle d{"'"}attente</p>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">
                      {INTAKE_LABEL[p.intake_status] || p.intake_status}
                    </p>
                  </div>
                  {p.requested_service && (
                    <div>
                      <p className="text-xs font-medium text-[var(--primary)]">Demande à l{"'"}accueil</p>
                      <p className="mt-0.5 text-sm text-[var(--text-primary)]">{p.requested_service}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Préférences & attribution */}
            <div className="rounded-xl border border-border bg-white p-5">
              <h3 className="text-base font-semibold text-text-primary">
                Préférences &amp; provenance
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-text-muted">Langue</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.language_pref?.toUpperCase() || "FR"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Canal préféré</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {CHANNEL_LABEL[p.channel_pref] || p.channel_pref || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Source</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.lead_source || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Campagne</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.source_campaign || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Médium</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.source_medium || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Premier contact</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.first_touch_at ? formatDate(p.first_touch_at) : "—"}
                  </p>
                </div>
              </div>
              {p.treatment_interests && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted">Intérêts traitement</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{p.treatment_interests}</p>
                </div>
              )}
            </div>

            {/* Programmes & Plans */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">
                  Programmes & Plans
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowNewProgDossier(true)}>
                    Nouveau programme
                  </Button>
                  <NewPlanDialog patientId={p.id} />
                </div>
              </div>
              {/* New programme form */}
              {showNewProgDossier && (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="ex. Rajeunissement visage"
                    value={newProgTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgTitle(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => {
                    if (!newProgTitle.trim()) return;
                    createProgramme.mutate(
                      { patient_id: p.id, title: newProgTitle.trim() },
                      { onSuccess: () => { toast.success("Programme créé"); setNewProgTitle(""); setShowNewProgDossier(false); } }
                    );
                  }} disabled={createProgramme.isPending}>Créer</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewProgDossier(false)}>Annuler</Button>
                </div>
              )}
              {/* Programmes */}
              {programmes.length > 0 && (
                <div className="mt-4 space-y-3">
                  {programmes.map((prog) => (
                    <div key={prog.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-text-primary">{prog.title}</p>
                          <p className="text-[11px] text-text-muted">
                            {prog.completed_sessions}/{prog.total_sessions} séances · {prog.total_cost.toLocaleString("fr-FR")} MAD
                          </p>
                        </div>
                        <Badge variant={prog.status === "active" ? "default" : "outline"}>
                          {prog.status === "active" ? "Actif" : "Terminé"}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 pl-3 border-l-2 border-gray-200">
                        {prog.plans.length === 0 && (
                          <p className="text-[11px] text-text-muted py-1">Aucun plan. Ajoutez-en un.</p>
                        )}
                        {prog.plans.map((pp) => (
                          <Link key={pp.id} href={`/plans/${pp.id}`} className="flex items-center justify-between rounded-md bg-gray-50 p-2 text-xs hover:bg-gray-100">
                            <span className="font-medium">{pp.title} · {pp.completed_sessions}/{pp.total_sessions}</span>
                            {pp.estimated_total != null && <span className="font-mono text-text-muted">{pp.estimated_total.toLocaleString("fr-FR")} MAD</span>}
                          </Link>
                        ))}
                        <NewPlanDialog patientId={p.id} programmeId={prog.id} triggerLabel="+ Ajouter un plan" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {plans.length === 0 && programmes.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Aucun programme ni plan. Créez un programme pour regrouper les traitements, ou un plan individuel.
                </p>
              ) : plans.filter((p) => !p.programme_id).length > 0 ? (
                <div className="mt-4 space-y-3">
                  {plans.filter((p) => !p.programme_id).map((plan) => {
                    const completed = plan.sessions.filter((s) => s.status === "completed").length;
                    const pct = plan.total_sessions > 0 ? Math.round((completed / plan.total_sessions) * 100) : 0;
                    return (
                      <Link
                        key={plan.id}
                        href={`/plans/${plan.id}`}
                        className="block rounded-lg border border-border p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-text-primary">{plan.title}</p>
                              <Badge
                                variant={
                                  plan.status === "completed"
                                    ? "success"
                                    : plan.status === "cancelled"
                                    ? "destructive"
                                    : "default"
                                }
                              >
                                {plan.status === "active" ? "Actif" : plan.status === "completed" ? "Terminé" : plan.status === "cancelled" ? "Annulé" : "Brouillon"}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-muted">
                              {completed} / {plan.total_sessions} séances ·{" "}
                              {plan.estimated_total != null
                                ? `${plan.estimated_total.toLocaleString("fr-FR")} ${plan.currency}`
                                : "—"}
                            </p>
                          </div>
                          <div className="w-32">
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
                              <div
                                className="h-full rounded-full bg-[var(--primary)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Consultations */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">Consultations</h3>
                <NewConsultationDialog patientId={p.id} />
              </div>
              {consultations.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Aucune consultation. Note SOAP au fauteuil.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {consultations.map((c) => {
                    const statusLabel: Record<ConsultationStatus, string> = {
                      draft: "Brouillon", signed: "Signée", cancelled: "Annulée",
                    };
                    const statusVariant: Record<ConsultationStatus, "outline" | "success" | "destructive"> = {
                      draft: "outline", signed: "success", cancelled: "destructive",
                    };
                    return (
                      <Link
                        key={c.id}
                        href={`/consultations/${c.id}`}
                        className="block rounded-lg border border-border p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <p className="truncate font-mono text-sm font-semibold text-text-primary">{c.number}</p>
                          <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
                        </div>
                        <p className="text-xs text-text-muted">
                          {new Date(c.visit_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          {c.chief_complaint && (<><span className="mx-1">·</span><span className="italic">{c.chief_complaint}</span></>)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Photos cliniques */}
            <PhotosCard patientId={p.id} />

            {/* Consentements */}
            <ConsentsSection patientId={p.id} />

            {/* Ordonnances */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">Ordonnances</h3>
                <NewPrescriptionDialog patientId={p.id} />
              </div>
              {prescriptions.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Aucune ordonnance pour ce patient.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {prescriptions.map((rx) => {
                    const rxLabel: Record<PrescriptionStatus, string> = {
                      draft: "Brouillon",
                      signed: "Signée",
                      cancelled: "Annulée",
                    };
                    const rxVariant: Record<PrescriptionStatus, "outline" | "success" | "destructive"> = {
                      draft: "outline",
                      signed: "success",
                      cancelled: "destructive",
                    };
                    return (
                      <Link
                        key={rx.id}
                        href={`/prescriptions/${rx.id}`}
                        className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-mono text-sm font-semibold text-text-primary">{rx.number}</p>
                            <Badge variant={rxVariant[rx.status]}>{rxLabel[rx.status]}</Badge>
                            {rx.renewable && <Badge variant="secondary">Renouvelable</Badge>}
                          </div>
                          <p className="text-xs text-text-muted">
                            {new Date(rx.issue_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                            {" · "}
                            {rx.lines.length} médicament{rx.lines.length > 1 ? "s" : ""}
                            {rx.diagnosis && (<><span className="mx-1">·</span><span className="italic">{rx.diagnosis}</span></>)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Factures */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">Factures</h3>
                <NewInvoiceDialog patientId={p.id} />
              </div>
              {invoices.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Aucune facture pour ce patient.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {invoices.map((inv) => {
                    const statusLabel: Record<InvoiceStatus, string> = {
                      draft: "Brouillon",
                      issued: "Émise",
                      partial: "Partiel",
                      paid: "Payée",
                      cancelled: "Annulée",
                      refunded: "Remboursée",
                    };
                    const statusVariant: Record<InvoiceStatus, "default" | "outline" | "warning" | "success" | "destructive"> = {
                      draft: "outline",
                      issued: "default",
                      partial: "warning",
                      paid: "success",
                      cancelled: "destructive",
                      refunded: "destructive",
                    };
                    return (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-mono text-sm font-semibold text-text-primary">
                              {inv.number}
                            </p>
                            <Badge variant={statusVariant[inv.status]}>
                              {statusLabel[inv.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted">
                            {new Date(inv.issue_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                            {" · "}
                            {inv.line_items.length} ligne{inv.line_items.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold">
                            {inv.total.toLocaleString("fr-FR")} {inv.currency}
                          </p>
                          {inv.total_paid > 0 && inv.total_paid < inv.total && (
                            <p className="text-xs text-[var(--warning)]">
                              {(inv.total - inv.total_paid).toLocaleString("fr-FR")} restant
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {p.internal_notes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-700">Notes internes</p>
                <p className="mt-1 text-sm text-amber-800">{p.internal_notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-base font-semibold text-text-primary">Activité récente</h3>
            <div className="mt-4 space-y-3">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  <div>
                    <p className="text-xs text-text-primary">{act.description}</p>
                    <p className="text-[10px] text-text-muted">{formatDate(act.created_at)}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-xs text-text-muted">Aucune activité pour le moment</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "conversations" && (
        <div className="rounded-xl border border-border bg-white">
          {patientConversations.length > 0 ? (
            <div className="divide-y divide-border">
              {patientConversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/whatsapp?conversation=${conv.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary">
                        +{conv.contact_phone}
                      </p>
                      <span className="text-[10px] text-text-muted">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-text-secondary">
                      {conv.last_message || "No messages"}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      {conv.unread_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-3 text-sm font-medium text-text-primary">
                No WhatsApp Conversations
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Conversations will appear here when this patient messages via WhatsApp.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-3">
          {/* Add note */}
          <div className="rounded-xl border border-border bg-white p-4">
            <textarea
              placeholder="Add a note..."
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-gray-50 p-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleAddNote}
                disabled={createNoteMutation.isPending}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {createNoteMutation.isPending ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-border bg-white p-4">
              {note.is_pinned && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              <p className="text-sm text-text-primary">{note.content}</p>
              <p className="mt-2 text-xs text-text-muted">{formatDate(note.created_at)}</p>
            </div>
          ))}

          {notes.length === 0 && (
            <div className="rounded-xl border border-border bg-white p-6 text-center">
              <p className="text-sm text-text-secondary">No notes yet. Add your first note above.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="rounded-xl border border-border bg-white">
          {activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Activity className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm text-text-primary">{act.description}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatDate(act.created_at)} at {formatTime(act.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-text-secondary">No activity recorded yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Consents section ────────────────────────────────────────────────

function ConsentsSection({ patientId }: { patientId: string }) {
  const { data: consents } = usePatientConsents(patientId);
  const createMut = useCreateConsent();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Consentement traitement");
  const [bodyText, setBodyText] = useState(
    "Je soussigné(e) autorise le médecin à pratiquer l'acte proposé. " +
    "J'ai été informé(e) des risques, bénéfices et alternatives. " +
    "J'ai pu poser toutes mes questions."
  );

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await createMut.mutateAsync({
        patient_id: patientId,
        consent_type: "treatment",
        title: title.trim(),
        body_text: bodyText.trim() || null,
      });
      setShowForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    pending: "En attente",
    signed: "Signé",
    declined: "Refusé",
    revoked: "Révoqué",
  };
  const STATUS_VARIANT: Record<string, "outline" | "success" | "destructive" | "warning"> = {
    pending: "warning",
    signed: "success",
    declined: "destructive",
    revoked: "destructive",
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Consentements</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3" />
          Nouveau consentement
        </Button>
      </div>

      {showForm && (
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-[var(--primary)] bg-[var(--primary-lighter)]/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="consent-title">Titre</Label>
            <Input
              id="consent-title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consent-body">Texte du consentement</Label>
            <textarea
              id="consent-body"
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={createMut.isPending}>
              Créer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {(!consents || consents.length === 0) && !showForm ? (
        <p className="mt-3 text-xs text-text-muted">
          Aucun consentement pour ce patient.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {(consents ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{c.title}</p>
                <p className="text-[11px] text-text-muted">
                  {c.treatment_name ?? c.consent_type}
                  {c.signed_at && ` · signé le ${new Date(c.signed_at).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                {STATUS_LABEL[c.status] ?? c.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
