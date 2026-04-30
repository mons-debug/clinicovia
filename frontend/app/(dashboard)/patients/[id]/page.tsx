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
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { NewPlanDialog } from "@/components/plans/new-plan-dialog";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { CompleteDossierCard } from "@/components/patient/complete-dossier-card";
import {
  usePatient,
  usePatientNotes,
  usePatientActivities,
  useCreatePatientNote,
} from "@/lib/api/patients";
import { usePatientPlans, type TreatmentPlan } from "@/lib/api/plans";
import { useInvoices, type Invoice as InvoiceType, type InvoiceStatus } from "@/lib/api/invoices";
import { usePatientPrescriptions, type Prescription as PrescriptionType, type PrescriptionStatus } from "@/lib/api/prescriptions";
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

  const router = useRouter();
  const { data: patient, isLoading, isError, error } = usePatient(id);
  const { data: sessionsData } = useWhatsAppSessions();
  const connectedSessions = (sessionsData?.sessions || []).filter((s) => s.status === "connected");
  const { data: notes = [] } = usePatientNotes(id);
  const { data: activities = [] } = usePatientActivities(id);
  const createNoteMutation = useCreatePatientNote(id);
  const { data: convsData } = useConversations({ patient_id: id });
  const patientConversations = convsData?.conversations || [];
  const { data: plansData } = usePatientPlans(id);
  const plans: TreatmentPlan[] = plansData?.plans ?? [];
  const { data: invoicesData } = useInvoices({ patientId: id });
  const invoices: InvoiceType[] = invoicesData?.invoices ?? [];
  const { data: prescriptionsData } = usePatientPrescriptions(id);
  const prescriptions: PrescriptionType[] = prescriptionsData?.prescriptions ?? [];

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
            <Link
              href={`/patients/${id}/edit`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Lead Score", value: `${p.lead_score}/100`, icon: Star, color: "#F59E0B" },
            { label: "Total Spent", value: `$${p.total_spent.toLocaleString()}`, icon: DollarSign, color: "#10B981" },
            { label: "Lifetime Value", value: `$${p.lifetime_value.toLocaleString()}`, icon: DollarSign, color: "#059669" },
            { label: "Patient Since", value: formatDate(p.created_at), icon: Calendar, color: "#3B82F6" },
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
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Compléter le dossier — only while intake is incomplete */}
            {p.intake_status && p.intake_status !== "active" && p.intake_status !== "archived" && (
              <CompleteDossierCard patient={p} />
            )}

            {/* Identité */}
            <div className="rounded-xl border border-border bg-white p-5">
              <h3 className="text-base font-semibold text-text-primary">Identité</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[
                  { label: "Nom complet", value: `${p.first_name} ${p.last_name}` },
                  { label: "Sexe", value: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "—" },
                  { label: "Date de naissance", value: p.date_of_birth ? formatDate(p.date_of_birth) : "—" },
                  { label: "CNIE", value: p.cnie || "—" },
                  { label: "Ville", value: [p.city, p.country].filter(Boolean).join(", ") || "—" },
                  { label: "Adresse", value: p.email || "—" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-text-muted">{item.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dossier clinique */}
            <div className="rounded-xl border border-border bg-white p-5">
              <h3 className="text-base font-semibold text-text-primary">Dossier clinique</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-text-muted">Phototype</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.fitzpatrick ? `Fitzpatrick ${p.fitzpatrick}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Poids</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.weight_kg != null ? `${p.weight_kg} kg` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Taille</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.height_cm != null ? `${p.height_cm} cm` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">IMC</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.bmi != null ? p.bmi : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Tabac</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {p.smoker == null ? "—" : p.smoker ? "Oui" : "Non"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Statut salle</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {INTAKE_LABEL[p.intake_status] || p.intake_status}
                  </p>
                </div>
              </div>
              {p.requested_service && (
                <div className="mt-4 rounded-lg bg-[var(--primary-lighter)] p-3">
                  <p className="text-xs font-medium text-[var(--primary)]">Demande à l&apos;accueil</p>
                  <p className="mt-0.5 text-sm text-[var(--primary)]">{p.requested_service}</p>
                </div>
              )}
            </div>

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

            {/* Plans de traitement */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">
                  Plans de traitement
                </h3>
                <NewPlanDialog patientId={p.id} />
              </div>
              {plans.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Aucun plan pour ce patient. Créez-en un pour suivre les séances et le coût estimé.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {plans.map((plan) => {
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
              )}
            </div>

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
