"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Check,
  X,
  Clock,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  useMyServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type DoctorService,
  type ServiceCreateInput,
} from "@/lib/api/doctor-services";

function ServiceCard({ service }: { service: DoctorService }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: service.name,
    category: service.category ?? "",
    description: service.description ?? "",
    duration_minutes: service.duration_minutes,
    default_price: service.default_price,
    consent_template: service.consent_template ?? "",
  });

  const update = useUpdateService(service.id);
  const remove = useDeleteService();

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: () => {
        toast.success("Service mis à jour");
        setEditing(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleDelete = () => {
    if (!confirm(`Désactiver « ${service.name} » ?`)) return;
    remove.mutate(service.id, {
      onSuccess: () => toast.success("Service désactivé"),
      onError: (e) => toast.error(e.message),
    });
  };

  if (editing) {
    return (
      <Card className="p-5 border-2 border-[var(--primary)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nom du service</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Catégorie</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="ex: Médecine esthétique"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Durée (minutes)</Label>
              <Input
                type="number"
                min={5}
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Prix par défaut (MAD)</Label>
              <Input
                type="number"
                min={0}
                value={form.default_price}
                onChange={(e) =>
                  setForm({ ...form, default_price: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Modèle de consentement</Label>
            <Textarea
              value={form.consent_template}
              onChange={(e) => setForm({ ...form, consent_template: e.target.value })}
              rows={4}
              placeholder="Texte du consentement pour ce service..."
              className="text-sm"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Ce texte sera pré-rempli dans le consentement quand vous démarrez une séance.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={update.isPending || !form.name.trim()}
            >
              {update.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 hover:border-[var(--primary)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--text-primary)]">{service.name}</h3>
            {service.category && (
              <Badge variant="secondary" className="text-[10px]">
                {service.category}
              </Badge>
            )}
          </div>
          {service.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
              {service.description}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2.5">
            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Clock className="h-3.5 w-3.5" />
              {service.duration_minutes} min
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <DollarSign className="h-3.5 w-3.5" />
              {service.default_price > 0
                ? `${service.default_price.toLocaleString("fr-FR")} MAD`
                : "Prix non défini"}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <FileText className="h-3.5 w-3.5" />
              {service.consent_template ? "Consentement ✓" : "Pas de modèle"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-[var(--primary)]"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-500"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && service.consent_template && (
        <div className="mt-3 p-3 rounded-md bg-gray-50 text-xs text-[var(--text-secondary)] border border-[var(--border)]">
          <p className="font-medium text-[var(--text-primary)] mb-1 text-[11px] uppercase tracking-wider">
            Modèle de consentement
          </p>
          <p>{service.consent_template}</p>
        </div>
      )}
    </Card>
  );
}

function AddServiceForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<ServiceCreateInput>({
    name: "",
    category: "",
    description: "",
    duration_minutes: 30,
    default_price: 0,
    consent_template: "",
  });

  const create = useCreateService();

  const handleSubmit = () => {
    if (!form.name?.trim()) return;
    create.mutate(form, {
      onSuccess: () => {
        toast.success("Service ajouté");
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Card className="p-5 border-2 border-emerald-500 bg-emerald-50/30">
      <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Plus className="h-4 w-4 text-emerald-600" />
        Nouveau service
      </h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nom du service *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Botox"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Catégorie</Label>
            <Input
              value={form.category ?? ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="ex: Médecine esthétique"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Description</Label>
          <Input
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brève description du service"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Durée (minutes)</Label>
            <Input
              type="number"
              min={5}
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Prix par défaut (MAD)</Label>
            <Input
              type="number"
              min={0}
              value={form.default_price}
              onChange={(e) =>
                setForm({ ...form, default_price: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Modèle de consentement</Label>
          <Textarea
            value={form.consent_template ?? ""}
            onChange={(e) => setForm({ ...form, consent_template: e.target.value })}
            rows={3}
            placeholder="Texte du consentement pré-rempli pour ce service..."
            className="text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={create.isPending || !form.name?.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1" />
            )}
            Ajouter
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function DoctorServicesPage() {
  const { data: services, isLoading } = useMyServices();
  const [adding, setAdding] = useState(false);

  const categories = services
    ? [...new Set(services.map((s) => s.category).filter(Boolean))]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mes Services</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Gérez vos services, tarifs et modèles de consentement
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un service
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {adding && <AddServiceForm onClose={() => setAdding(false)} />}

      {!isLoading && services && services.length === 0 && !adding && (
        <Card className="p-8 text-center">
          <Stethoscope className="h-10 w-10 mx-auto text-[var(--text-muted)] mb-3" />
          <h3 className="font-bold text-[var(--text-primary)]">Aucun service</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Ajoutez vos services pour commencer à prendre des rendez-vous
          </p>
        </Card>
      )}

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 mt-4">
            {cat}
          </h2>
          <div className="space-y-2">
            {services!
              .filter((s) => s.category === cat)
              .map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
          </div>
        </div>
      ))}

      {services && services.some((s) => !s.category) && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 mt-4">
            Autres
          </h2>
          <div className="space-y-2">
            {services
              .filter((s) => !s.category)
              .map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
