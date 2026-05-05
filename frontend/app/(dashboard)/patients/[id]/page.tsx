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
  MessageSquare,
  Pencil,
  StickyNote,
  Activity,
  User,
  Loader2,
  AlertCircle,
  Pin,
  FolderOpen,
  CalendarPlus,
  Receipt,
  Pill,
  ShieldCheck,
  Clock,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, getStatusVariant } from "@/components/shared/status-badge";
import {
  usePatient,
  usePatientNotes,
  usePatientActivities,
  useCreatePatientNote,
} from "@/lib/api/patients";
import { useAppointments } from "@/lib/api/appointments";
import { useConversations, useWhatsAppSessions, startConversation } from "@/lib/api/whatsapp";
import { useAuthStore } from "@/stores/auth-store";
import { useSessionContext } from "@/lib/api/session-context";
import { useInvoices } from "@/lib/api/invoices";
import { usePatientConsents } from "@/lib/api/consents";
import { usePatientPhotos, photoFileUrl } from "@/lib/api/photos";
import { usePatientPrescriptions } from "@/lib/api/prescriptions";
import { DoctorBento } from "@/components/patient/doctor-bento";
import { SessionChecklist } from "@/components/patient/session-checklist";
import { ProgrammePlansSection } from "@/components/plans/programme-plans-section";
import { NewInvoiceDialog } from "@/components/billing/new-invoice-dialog";
import { NewPrescriptionDialog } from "@/components/prescriptions/new-prescription-dialog";
import { Badge } from "@/components/ui/badge";

type TabKey = "overview" | "dossier" | "conversations" | "notes" | "activity";

export default function PatientProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { currentRole, user: authUser } = useAuthStore();
  const isDoctor = currentRole === "doctor" || currentRole === "clinic_owner";
  const needsWizard = authUser?.specialty === "plastic_surgery";
  const [activeTab, setActiveTab] = useState<TabKey>(isDoctor ? "dossier" : "overview");
  const [noteContent, setNoteContent] = useState("");

  const router = useRouter();
  const { data: patient, isLoading, isError, error } = usePatient(id);
  const { data: sessionsData } = useWhatsAppSessions();
  const { data: sessionCtx } = useSessionContext(id);

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    ...(isDoctor ? [] : [{ key: "overview" as TabKey, label: "Aperçu", icon: User }]),
    { key: "dossier", label: "Dossier", icon: FolderOpen },
    ...(isDoctor ? [] : [{ key: "conversations" as TabKey, label: "Conversations", icon: MessageSquare }]),
    { key: "notes", label: "Notes", icon: StickyNote },
    ...(isDoctor ? [] : [{ key: "activity" as TabKey, label: "Activité", icon: Activity }]),
  ];
  const connectedSessions = (sessionsData?.sessions || []).filter((s) => s.status === "connected");
  const { data: notes = [] } = usePatientNotes(id);
  const { data: activities = [] } = usePatientActivities(id);
  const createNoteMutation = useCreatePatientNote(id);
  const { data: convsData } = useConversations({ patient_id: id });
  const patientConversations = convsData?.conversations || [];

  // Dossier data hooks
  const { data: invoicesData } = useInvoices({ patientId: id });
  const invoices = invoicesData?.invoices ?? [];
  const { data: consentsData } = usePatientConsents(id);
  const consents = consentsData ?? [];
  const { data: photosData } = usePatientPhotos(id);
  const photos = photosData?.photos ?? [];
  const { data: prescriptionsData } = usePatientPrescriptions(id);
  const prescriptions = prescriptionsData?.prescriptions ?? [];

  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "";
  const { data: aptData } = useAppointments(
    { patient_search: patientName, date_from: "2020-01-01", date_to: "2030-12-31", page_size: 200 },
    { enabled: !!patientName },
  );
  const patientAppointments = (aptData?.appointments ?? []).filter((a) => a.patient_id === id);

  // Derived data for quick info cards
  const pastAppointments = patientAppointments
    .filter((a) => new Date(a.appointment_date) <= new Date())
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());
  const futureAppointments = patientAppointments
    .filter((a) => new Date(a.appointment_date) > new Date())
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
  const lastVisit = pastAppointments[0];
  const nextAppointment = futureAppointments[0];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
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
      toast.error("Le contenu ne peut pas être vide");
      return;
    }
    try {
      await createNoteMutation.mutateAsync({ content: noteContent.trim() });
      setNoteContent("");
      toast.success("Note ajoutée");
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Chargement...</span>
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
            {error instanceof Error ? error.message : "Patient introuvable"}
          </p>
        </div>
      </div>
    );
  }

  const p = patient;
  const visitCount = pastAppointments.length;
  const patientSinceDate = new Date(p.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux patients
      </Link>

      {/* Patient header */}
      <div className="rounded-xl border border-border bg-white px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {p.first_name[0]}{p.last_name[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-text-primary truncate">
                  {p.first_name} {p.last_name}
                </h1>
                <StatusBadge
                  status={p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  variant={getStatusVariant(p.status)}
                  dot
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-text-muted" /> {p.phone_country_code}{p.phone}
                </span>
                {p.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3 text-text-muted" /> {p.email}
                  </span>
                )}
                {(p.city || p.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-text-muted" /> {[p.city, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={async () => {
                if (!p.phone) return;
                const session = connectedSessions[0];
                if (!session) {
                  toast.error("Aucun numéro WhatsApp connecté");
                  return;
                }
                try {
                  const phone = `${p.phone_country_code}${p.phone}`.replace(/\D/g, "");
                  const jid = `${phone}@s.whatsapp.net`;
                  const conv = await startConversation(session.id, jid, `${p.first_name} ${p.last_name}`);
                  router.push(`/whatsapp?conversation=${conv.id}`);
                } catch {
                  toast.error("Erreur WhatsApp");
                }
              }}
              disabled={!p.phone || connectedSessions.length === 0}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                p.phone && connectedSessions.length > 0
                  ? "text-text-primary hover:bg-gray-50"
                  : "cursor-not-allowed text-text-muted"
              }`}
              title={!p.phone ? "Pas de téléphone" : connectedSessions.length === 0 ? "WhatsApp non connecté" : "Envoyer un message WhatsApp"}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <Link
              href={`/patients/${id}/edit`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-primary transition-colors hover:bg-gray-50"
              title="Modifier le patient"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Tags */}
        {p.tags.length > 0 && (
          <div className="mt-3 flex gap-1.5 pl-16">
            {p.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.tag}
              </span>
            ))}
          </div>
        )}

        {/* Compact info bar */}
        <div className="mt-3 border-t border-border pt-3 pl-16">
          <p className="text-xs text-text-secondary">
            Patient depuis {patientSinceDate} · {visitCount} visite{visitCount !== 1 ? "s" : ""} · {p.total_spent.toLocaleString("fr-FR")} MAD dépensé
          </p>
        </div>
      </div>

      {/* Segmented tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100/80 p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-text-primary">Informations patient</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {[
                { label: "Nom complet", value: `${p.first_name} ${p.last_name}` },
                { label: "Genre", value: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "--" },
                { label: "Date de naissance", value: p.date_of_birth || "--" },
                { label: "Source", value: p.lead_source || "--" },
                { label: "Intérêts", value: p.treatment_interests || "--" },
                { label: "Adresse", value: [p.city, p.country].filter(Boolean).join(", ") || "--" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[11px] text-text-muted uppercase tracking-wide">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
            {p.internal_notes && (
              <div className="mt-5 rounded-lg bg-amber-50 p-3">
                <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">Notes internes</p>
                <p className="mt-1 text-sm text-amber-800">{p.internal_notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-sm font-semibold text-text-primary">Activité récente</h3>
            <div className="mt-4 space-y-3">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-2">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-light" />
                  <div>
                    <p className="text-xs text-text-primary">{act.description}</p>
                    <p className="text-[10px] text-text-muted">{formatDate(act.created_at)}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-xs text-text-muted">Aucune activité</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "dossier" && (
        <div className="space-y-5">
          {/* Active session — full wizard for surgery, checklist for aesthetic/reception */}
          {sessionCtx?.active && isDoctor && needsWizard && (
            <DoctorBento
              patientId={id}
              patientName={patientName}
              patient={patient}
            />
          )}
          {sessionCtx?.active && (!needsWizard || !isDoctor) && (
            <SessionChecklist patientId={id} patientName={patientName} />
          )}

          {/* Quick info cards — 2 column grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                <Clock className="h-4 w-4 text-text-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-text-muted uppercase tracking-wide">Dernière visite</p>
                {lastVisit ? (
                  <p className="text-sm font-medium text-text-primary truncate">
                    {formatDateShort(lastVisit.appointment_date)} — {lastVisit.treatment || "Consultation"}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">Aucune</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                <CalendarDays className="h-4 w-4 text-text-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-text-muted uppercase tracking-wide">Prochain RDV</p>
                {nextAppointment ? (
                  <p className="text-sm font-medium text-text-primary truncate">
                    {formatDateShort(nextAppointment.appointment_date)} — {nextAppointment.treatment || "Consultation"}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">Aucun</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions — ghost/outline buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/appointments/new?patient=${id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-gray-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Nouveau RDV
            </Link>
            <NewInvoiceDialog patientId={id} triggerLabel="Nouvelle facture" />
            <NewPrescriptionDialog patientId={id} triggerLabel="Nouvelle ordonnance" />
          </div>

          {/* Plans & Séances */}
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Plans de traitement</h3>
            <ProgrammePlansSection patientId={id} />
          </div>

          {/* Factures */}
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Factures</h3>
              <span className="text-[11px] text-text-muted">{invoices.length} facture{invoices.length !== 1 ? "s" : ""}</span>
            </div>
            {invoices.length === 0 ? (
              <p className="mt-4 text-center text-xs text-text-muted">Aucune facture</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <Receipt className="h-3.5 w-3.5 text-text-muted" />
                      <div>
                        <span className="text-sm font-medium text-text-primary">{inv.number || "Brouillon"}</span>
                        <span className="ml-2 text-[11px] text-text-muted">{formatDate(inv.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-text-primary">{inv.total.toLocaleString("fr-FR")} MAD</span>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "issued" ? "default" : "outline"}>
                        {inv.status === "paid" ? "Payée" : inv.status === "issued" ? "Émise" : inv.status === "draft" ? "Brouillon" : inv.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Ordonnances */}
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Ordonnances</h3>
              <span className="text-[11px] text-text-muted">{prescriptions.length} ordonnance{prescriptions.length !== 1 ? "s" : ""}</span>
            </div>
            {prescriptions.length === 0 ? (
              <p className="mt-4 text-center text-xs text-text-muted">Aucune ordonnance</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {prescriptions.map((rx) => (
                  <Link
                    key={rx.id}
                    href={`/prescriptions/${rx.id}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <Pill className="h-3.5 w-3.5 text-text-muted" />
                      <div>
                        <span className="text-sm font-medium text-text-primary">{rx.number}</span>
                        <span className="ml-2 text-[11px] text-text-muted">{formatDate(rx.issue_date)}</span>
                      </div>
                    </div>
                    <Badge variant={rx.status === "signed" ? "success" : "outline"}>
                      {rx.status === "signed" ? "Signée" : rx.status === "draft" ? "Brouillon" : rx.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Consentements */}
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Consentements</h3>
              <span className="text-[11px] text-text-muted">{consents.length}</span>
            </div>
            {consents.length === 0 ? (
              <p className="mt-4 text-center text-xs text-text-muted">Aucun consentement</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
                      <div>
                        <span className="text-sm font-medium text-text-primary">{c.title}</span>
                        {c.treatment_name && (
                          <span className="ml-2 text-[11px] text-text-muted">{c.treatment_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === "signed" ? "success" : c.status === "pending" ? "warning" : "outline"}>
                        {c.status === "signed" ? "Signé" : c.status === "pending" ? "En attente" : c.status}
                      </Badge>
                      {c.status === "signed" && c.signed_at && (
                        <span className="text-[10px] text-text-muted">{formatDate(c.signed_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Photos</h3>
              <span className="text-[11px] text-text-muted">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
            </div>
            {photos.length === 0 ? (
              <p className="mt-4 text-center text-xs text-text-muted">Aucune photo</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-gray-50">
                    <img
                      src={photoFileUrl(photo.id)}
                      alt={`${photo.stage} - ${photo.zone_slug}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1">
                      <span className="text-[10px] font-medium text-white capitalize">{photo.stage}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                      {conv.last_message || "Aucun message"}
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
                Aucune conversation
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Les conversations apparaîtront ici quand ce patient enverra un message via WhatsApp.
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
              placeholder="Écrire une note..."
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAddNote();
                }
              }}
              className="w-full resize-none rounded-lg border border-border bg-gray-50 p-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Cmd+Entrée pour enregistrer</span>
              <button
                onClick={handleAddNote}
                disabled={createNoteMutation.isPending || !noteContent.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {createNoteMutation.isPending ? "..." : "Enregistrer"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 mt-0.5">
                    <User className="h-3 w-3 text-text-muted" />
                  </div>
                  <div className="min-w-0">
                    {note.is_pinned && (
                      <span className="mb-1 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <Pin className="h-2.5 w-2.5" /> Épinglé
                      </span>
                    )}
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{note.content}</p>
                  </div>
                </div>
                <span className="text-[10px] text-text-muted shrink-0">{formatDate(note.created_at)}</span>
              </div>
            </div>
          ))}

          {notes.length === 0 && (
            <div className="rounded-xl border border-border bg-white p-6 text-center">
              <StickyNote className="mx-auto h-6 w-6 text-text-muted" />
              <p className="mt-2 text-sm text-text-secondary">Aucune note. Ajoutez votre première note ci-dessus.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="rounded-xl border border-border bg-white">
          {activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Activity className="h-3 w-3 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm text-text-primary">{act.description}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {formatDate(act.created_at)} à {formatTime(act.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Activity className="mx-auto h-6 w-6 text-text-muted" />
              <p className="mt-2 text-sm text-text-secondary">Aucune activité enregistrée.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
