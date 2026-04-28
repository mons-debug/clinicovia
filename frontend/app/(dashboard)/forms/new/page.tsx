"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Settings2,
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  MessageSquare,
  List,
  ListChecks,
  CircleDot,
  CheckSquare,
  CheckSquare2,
  Calendar,
  Clock,
  Upload,
  Heading,
  FileText,
  Loader2,
  X,
  ChevronRight,
  LayoutTemplate,
  FilePlus2,
  ClipboardList,
  Star,
  Users,
  Megaphone,
  Save,
} from "lucide-react";
import { useCreateForm, type FormField, type FormSchema } from "@/lib/api/forms";
import { FORM_TEMPLATES, type FormTemplate } from "@/lib/form-templates";

// ── Field type definitions ────────────────────────────────────

interface FieldTypeConfig {
  type: string;
  label: string;
  icon: React.ReactNode;
  category: string;
}

const FIELD_TYPES: FieldTypeConfig[] = [
  { type: "text", label: "Text", icon: <Type className="w-4 h-4" />, category: "Basic" },
  { type: "textarea", label: "Text Area", icon: <AlignLeft className="w-4 h-4" />, category: "Basic" },
  { type: "number", label: "Number", icon: <Hash className="w-4 h-4" />, category: "Basic" },
  { type: "email", label: "Email", icon: <Mail className="w-4 h-4" />, category: "Basic" },
  { type: "phone", label: "Phone", icon: <Phone className="w-4 h-4" />, category: "Basic" },
  { type: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" />, category: "Basic" },
  { type: "select", label: "Dropdown", icon: <List className="w-4 h-4" />, category: "Choice" },
  { type: "multi_select", label: "Multi Select", icon: <ListChecks className="w-4 h-4" />, category: "Choice" },
  { type: "radio", label: "Radio", icon: <CircleDot className="w-4 h-4" />, category: "Choice" },
  { type: "checkbox", label: "Checkbox", icon: <CheckSquare className="w-4 h-4" />, category: "Choice" },
  { type: "checkbox_group", label: "Checkbox Group", icon: <CheckSquare2 className="w-4 h-4" />, category: "Choice" },
  { type: "date", label: "Date", icon: <Calendar className="w-4 h-4" />, category: "Date/Time" },
  { type: "time", label: "Time", icon: <Clock className="w-4 h-4" />, category: "Date/Time" },
  { type: "file", label: "File Upload", icon: <Upload className="w-4 h-4" />, category: "Media" },
  { type: "heading", label: "Heading", icon: <Heading className="w-4 h-4" />, category: "Layout" },
  { type: "paragraph", label: "Paragraph", icon: <FileText className="w-4 h-4" />, category: "Layout" },
  { type: "button", label: "Button", icon: <Save className="w-4 h-4" />, category: "Layout" },
];

const FIELD_CATEGORIES = ["Basic", "Choice", "Date/Time", "Media", "Layout"];

const CHOICE_TYPES = ["select", "radio", "checkbox_group", "multi_select"];

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "Patient Intake": <ClipboardList className="w-6 h-6" />,
  "Consultation Request": <Calendar className="w-6 h-6" />,
  "Treatment Feedback": <Star className="w-6 h-6" />,
  "Referral Form": <Users className="w-6 h-6" />,
};

function getFieldIcon(type: string) {
  const cfg = FIELD_TYPES.find((f) => f.type === type);
  return cfg?.icon ?? <Type className="w-4 h-4" />;
}

function createField(type: string): FormField {
  const cfg = FIELD_TYPES.find((f) => f.type === type);
  return {
    id: crypto.randomUUID(),
    type,
    label: type === "button" ? "Submit" : (cfg?.label ?? "Field"),
    placeholder: "",
    helpText: "",
    required: false,
    validation: type === "button" ? { buttonColor: "#3EC8A0", buttonStyle: "filled", buttonSize: "full" } : {},
    options: CHOICE_TYPES.includes(type)
      ? [
          { label: "Option 1", value: "option_1" },
          { label: "Option 2", value: "option_2" },
        ]
      : [],
    order: 0,
  };
}

function reorderFields(fields: FormField[]): FormField[] {
  return fields.map((f, i) => ({ ...f, order: i }));
}

// ── Template Selection Phase ──────────────────────────────────

function TemplateSelection({
  onSelect,
}: {
  onSelect: (template: FormTemplate | null) => void;
}) {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Create a New Form
        </h1>
        <p className="text-text-secondary">
          Start from scratch or choose a template to get started quickly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Blank form card */}
        <button
          onClick={() => onSelect(null)}
          className="group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border bg-white hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)]/5 transition-all min-h-[180px] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-lg bg-gray-100 group-hover:bg-[var(--primary-light)]/10 flex items-center justify-center transition-colors">
            <FilePlus2 className="w-6 h-6 text-text-muted group-hover:text-[var(--primary-light)]" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">Blank Form</p>
            <p className="text-sm text-text-muted mt-1">Start from scratch</p>
          </div>
        </button>

        {/* Template cards */}
        {FORM_TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            onClick={() => onSelect(tpl)}
            className="group flex flex-col items-start gap-3 p-6 rounded-xl border border-border bg-white hover:border-[var(--primary-light)] hover:shadow-md transition-all min-h-[180px] cursor-pointer text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-[var(--primary)]/5 group-hover:bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] transition-colors">
              {TEMPLATE_ICONS[tpl.name] ?? (
                <LayoutTemplate className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="font-semibold text-text-primary">{tpl.name}</p>
              <p className="text-sm text-text-muted mt-1">{tpl.description}</p>
            </div>
            <span className="mt-auto text-xs font-medium text-[var(--primary-light)] bg-[var(--primary-light)]/10 px-2 py-0.5 rounded">
              {tpl.category}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Options Editor ────────────────────────────────────────────

function OptionsEditor({
  options,
  onChange,
}: {
  options: { label: string; value: string }[];
  onChange: (opts: { label: string; value: string }[]) => void;
}) {
  const addOption = () => {
    const idx = options.length + 1;
    onChange([...options, { label: `Option ${idx}`, value: `option_${idx}` }]);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (
    index: number,
    key: "label" | "value",
    val: string
  ) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [key]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">Options</label>
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={opt.label}
            onChange={(e) => updateOption(i, "label", e.target.value)}
            placeholder="Label"
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
          />
          <input
            type="text"
            value={opt.value}
            onChange={(e) => updateOption(i, "value", e.target.value)}
            placeholder="Value"
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
          />
          <button
            type="button"
            onClick={() => removeOption(i)}
            className="p-1 text-text-muted hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-1 text-sm text-[var(--primary-light)] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" />
        Add option
      </button>
    </div>
  );
}

// ── Properties Panel ──────────────────────────────────────────

function PropertiesPanel({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updated: FormField) => void;
}) {
  const isChoice = CHOICE_TYPES.includes(field.type);
  const isButton = field.type === "button";
  const isLayout = ["heading", "paragraph"].includes(field.type);
  const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]";

  const btnColor = (field.validation as Record<string, string>).buttonColor || "#3EC8A0";
  const btnStyle = (field.validation as Record<string, string>).buttonStyle || "filled";
  const btnSize = (field.validation as Record<string, string>).buttonSize || "full";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
        {isButton ? "Button Properties" : "Field Properties"}
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text-primary block mb-1">
            {isButton ? "Button Text" : "Label"}
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* Button-specific properties */}
        {isButton && (
          <>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={btnColor} onChange={(e) => onUpdate({ ...field, validation: { ...field.validation, buttonColor: e.target.value } })} className="h-10 w-16 rounded border border-border cursor-pointer" />
                <input value={btnColor} onChange={(e) => onUpdate({ ...field, validation: { ...field.validation, buttonColor: e.target.value } })} className="w-28 rounded-lg border border-border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">Style</label>
              <div className="flex gap-2">
                {(["filled", "outline", "rounded"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => onUpdate({ ...field, validation: { ...field.validation, buttonStyle: s } })} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize ${btnStyle === s ? "border-primary-light bg-primary-lighter/10 text-primary-light" : "border-border text-text-secondary hover:bg-gray-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">Width</label>
              <div className="flex gap-2">
                {([["full", "Full Width"], ["auto", "Auto"], ["half", "Half"]] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => onUpdate({ ...field, validation: { ...field.validation, buttonSize: val } })} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${btnSize === val ? "border-primary-light bg-primary-lighter/10 text-primary-light" : "border-border text-text-secondary hover:bg-gray-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Button preview */}
            <div className="mt-3 rounded-lg bg-gray-50 p-4">
              <p className="text-[10px] text-text-muted mb-2">Preview</p>
              <div className={btnSize === "full" ? "" : btnSize === "half" ? "max-w-[50%]" : "inline-block"}>
                <button
                  type="button"
                  className="px-6 py-2.5 text-sm font-semibold transition-opacity"
                  style={{
                    width: btnSize === "full" ? "100%" : btnSize === "half" ? "100%" : "auto",
                    backgroundColor: btnStyle === "outline" ? "transparent" : btnColor,
                    color: btnStyle === "outline" ? btnColor : "#ffffff",
                    border: `2px solid ${btnColor}`,
                    borderRadius: btnStyle === "rounded" ? "9999px" : "8px",
                  }}
                  disabled
                >
                  {field.label}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Standard field properties */}
        {!isButton && !isLayout && (
          <div>
            <label className="text-sm font-medium text-text-primary block mb-1">
              Placeholder
            </label>
            <input
              type="text"
              value={field.placeholder}
              onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        {!isButton && (
          <div>
            <label className="text-sm font-medium text-text-primary block mb-1">
              Help Text
            </label>
            <input
              type="text"
              value={field.helpText}
              onChange={(e) => onUpdate({ ...field, helpText: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        {!isButton && !isLayout && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">
              Required
            </label>
            <button
              type="button"
              onClick={() => onUpdate({ ...field, required: !field.required })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                field.required ? "bg-[var(--primary-light)]" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  field.required ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {isChoice && (
          <OptionsEditor
            options={field.options}
            onChange={(opts) => onUpdate({ ...field, options: opts })}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function FormBuilderPage() {
  const router = useRouter();
  const createForm = useCreateForm();

  // Phase: "templates" | "builder" | "preview" | "settings"
  const [phase, setPhase] = useState<"templates" | "builder" | "preview" | "settings">("templates");

  // Form meta
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Builder state
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    submitButtonText: "Submit",
    submitButtonColor: "#3EC8A0",
    submitButtonStyle: "filled" as "filled" | "outline" | "rounded",
    successMessage:
      "Thank you for your submission! We will get back to you shortly.",
    redirectUrl: null as string | null,
    formBackground: "#ffffff",
    labelColor: "#1E293B",
    borderRadius: "8",
    showBranding: true,
  });

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  // ── Handlers ──────────────────────────────────────────────

  const handleTemplateSelect = useCallback(
    (template: FormTemplate | null) => {
      if (template) {
        // Re-generate IDs so they are unique
        const newFields = template.schema.fields.map((f) => ({
          ...f,
          id: crypto.randomUUID(),
        }));
        setFields(newFields);
        setSettings((prev) => ({ ...prev, ...template.schema.settings }));
        setTitle(template.name);
        setDescription(template.description);
      } else {
        setFields([]);
        setTitle("");
        setDescription("");
      }
      setPhase("builder");
    },
    []
  );

  const addField = useCallback((type: string) => {
    const newField = createField(type);
    setFields((prev) => {
      const updated = [...prev, newField];
      return reorderFields(updated);
    });
    setSelectedFieldId(newField.id);
  }, []);

  const removeField = useCallback(
    (id: string) => {
      setFields((prev) => reorderFields(prev.filter((f) => f.id !== id)));
      if (selectedFieldId === id) setSelectedFieldId(null);
    },
    [selectedFieldId]
  );

  const updateField = useCallback((updated: FormField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    setFields((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(srcIdx, 1);
      copy.splice(destIdx, 0, moved);
      return reorderFields(copy);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Please enter a form title");
      return;
    }
    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    const schema: FormSchema = {
      fields: reorderFields(fields),
      settings,
    };

    try {
      await createForm.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        schema,
      });
      toast.success("Form created successfully");
      router.push("/forms");
    } catch {
      toast.error("Failed to create form. Please try again.");
    }
  }, [title, description, fields, settings, createForm, router]);

  // ── Template Phase ────────────────────────────────────────

  if (phase === "templates") {
    return <TemplateSelection onSelect={handleTemplateSelect} />;
  }

  // ── Builder / Preview / Settings Phases ─────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-white shrink-0">
        <button
          onClick={() => setPhase("templates")}
          className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title"
            className="text-lg font-semibold text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted w-64 focus:ring-0"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border bg-white">
          {(["builder", "preview", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPhase(tab)}
              className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                phase === tab ? "bg-gray-100 text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={createForm.isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors"
        >
          {createForm.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {createForm.isPending ? "Saving..." : "Save Form"}
        </button>
      </div>

      {/* Preview Mode */}
      {phase === "preview" && (
        <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
          <div className="mx-auto max-w-2xl rounded-2xl shadow-lg" style={{ backgroundColor: settings.formBackground }}>
            <div className="p-8">
              <h1 className="text-2xl font-bold" style={{ color: settings.labelColor }}>{title || "Untitled Form"}</h1>
              {description && <p className="mt-2 text-sm text-text-secondary">{description}</p>}
              <div className="mt-8 space-y-6">
                {fields.map((field) => (
                  <div key={field.id}>
                    {field.type === "heading" ? (
                      <h2 className="text-lg font-semibold" style={{ color: settings.labelColor }}>{field.label}</h2>
                    ) : field.type === "paragraph" ? (
                      <p className="text-sm text-text-secondary">{field.label}</p>
                    ) : field.type === "button" ? (
                      <div className={(field.validation as Record<string, string>).buttonSize === "half" ? "max-w-[50%]" : (field.validation as Record<string, string>).buttonSize === "auto" ? "inline-block" : ""}>
                        <button
                          type="button"
                          className="px-6 py-3 text-sm font-semibold"
                          style={{
                            width: (field.validation as Record<string, string>).buttonSize === "full" ? "100%" : (field.validation as Record<string, string>).buttonSize === "half" ? "100%" : "auto",
                            backgroundColor: (field.validation as Record<string, string>).buttonStyle === "outline" ? "transparent" : ((field.validation as Record<string, string>).buttonColor || "#3EC8A0"),
                            color: (field.validation as Record<string, string>).buttonStyle === "outline" ? ((field.validation as Record<string, string>).buttonColor || "#3EC8A0") : "#ffffff",
                            border: `2px solid ${(field.validation as Record<string, string>).buttonColor || "#3EC8A0"}`,
                            borderRadius: (field.validation as Record<string, string>).buttonStyle === "rounded" ? "9999px" : `${settings.borderRadius}px`,
                          }}
                          disabled
                        >
                          {field.label}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" style={{ color: settings.labelColor }}>
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea placeholder={field.placeholder} rows={3} className="w-full border border-border bg-white px-3 py-2.5 text-sm resize-none" style={{ borderRadius: `${settings.borderRadius}px` }} readOnly />
                        ) : field.type === "select" ? (
                          <select className="w-full border border-border bg-white px-3 py-2.5 text-sm" style={{ borderRadius: `${settings.borderRadius}px` }} disabled>
                            <option>{field.placeholder || "Select..."}</option>
                            {field.options.map((o) => <option key={o.value}>{o.label}</option>)}
                          </select>
                        ) : field.type === "radio" ? (
                          <div className="space-y-2 mt-1">
                            {field.options.map((o) => (
                              <label key={o.value} className="flex items-center gap-2 text-sm text-text-primary">
                                <input type="radio" name={field.id} disabled /> {o.label}
                              </label>
                            ))}
                          </div>
                        ) : field.type === "checkbox" ? (
                          <label className="flex items-center gap-2 text-sm text-text-primary">
                            <input type="checkbox" disabled /> {field.label}
                          </label>
                        ) : field.type === "checkbox_group" || field.type === "multi_select" ? (
                          <div className="space-y-2 mt-1">
                            {field.options.map((o) => (
                              <label key={o.value} className="flex items-center gap-2 text-sm text-text-primary">
                                <input type="checkbox" disabled /> {o.label}
                              </label>
                            ))}
                          </div>
                        ) : field.type === "file" ? (
                          <div className="w-full border-2 border-dashed border-border px-3 py-6 text-center text-sm text-text-muted" style={{ borderRadius: `${settings.borderRadius}px` }}>
                            Click or drag to upload
                          </div>
                        ) : (
                          <input
                            type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                            placeholder={field.placeholder}
                            className="w-full border border-border bg-white px-3 py-2.5 text-sm"
                            style={{ borderRadius: `${settings.borderRadius}px` }}
                            readOnly
                          />
                        )}
                        {field.helpText && <p className="mt-1 text-xs text-text-muted">{field.helpText}</p>}
                      </div>
                    )}
                  </div>
                ))}
                {fields.length > 0 && (
                  <button
                    className={`w-full py-3 text-sm font-semibold text-white transition-opacity ${
                      settings.submitButtonStyle === "outline"
                        ? "bg-transparent border-2 !text-current"
                        : settings.submitButtonStyle === "rounded"
                          ? "rounded-full"
                          : ""
                    }`}
                    style={{
                      backgroundColor: settings.submitButtonStyle === "outline" ? "transparent" : settings.submitButtonColor,
                      borderColor: settings.submitButtonColor,
                      color: settings.submitButtonStyle === "outline" ? settings.submitButtonColor : "#ffffff",
                      borderRadius: settings.submitButtonStyle === "rounded" ? "9999px" : `${settings.borderRadius}px`,
                    }}
                    disabled
                  >
                    {settings.submitButtonText}
                  </button>
                )}
              </div>
              {settings.showBranding && (
                <p className="mt-6 text-center text-[10px] text-text-muted">Powered by Clinicovia</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Mode */}
      {phase === "settings" && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-xl space-y-8">
            {/* General */}
            <section className="rounded-xl border border-border bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-4">General</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Form Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm resize-none focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Success Message</label>
                  <textarea value={settings.successMessage} onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })} rows={2} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm resize-none focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Redirect URL (optional)</label>
                  <input value={settings.redirectUrl || ""} onChange={(e) => setSettings({ ...settings, redirectUrl: e.target.value || null })} placeholder="https://..." className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
                </div>
              </div>
            </section>

            {/* Button Style */}
            <section className="rounded-xl border border-border bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-4">Submit Button</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Button Text</label>
                  <input value={settings.submitButtonText} onChange={(e) => setSettings({ ...settings, submitButtonText: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Button Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.submitButtonColor} onChange={(e) => setSettings({ ...settings, submitButtonColor: e.target.value })} className="h-10 w-16 rounded border border-border cursor-pointer" />
                    <input value={settings.submitButtonColor} onChange={(e) => setSettings({ ...settings, submitButtonColor: e.target.value })} className="w-28 rounded-lg border border-border px-3 py-2 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Button Style</label>
                  <div className="flex gap-2">
                    {(["filled", "outline", "rounded"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => setSettings({ ...settings, submitButtonStyle: style })}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                          settings.submitButtonStyle === style
                            ? "border-primary-light bg-primary-lighter/10 text-primary-light"
                            : "border-border text-text-secondary hover:bg-gray-50"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Preview */}
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-text-muted mb-3">Preview</p>
                  <button
                    className="w-full py-2.5 text-sm font-semibold transition-opacity"
                    style={{
                      backgroundColor: settings.submitButtonStyle === "outline" ? "transparent" : settings.submitButtonColor,
                      borderColor: settings.submitButtonColor,
                      color: settings.submitButtonStyle === "outline" ? settings.submitButtonColor : "#ffffff",
                      borderWidth: "2px",
                      borderStyle: "solid",
                      borderRadius: settings.submitButtonStyle === "rounded" ? "9999px" : `${settings.borderRadius}px`,
                    }}
                    disabled
                  >
                    {settings.submitButtonText}
                  </button>
                </div>
              </div>
            </section>

            {/* Styling */}
            <section className="rounded-xl border border-border bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-4">Form Styling</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.formBackground} onChange={(e) => setSettings({ ...settings, formBackground: e.target.value })} className="h-10 w-16 rounded border border-border cursor-pointer" />
                    <input value={settings.formBackground} onChange={(e) => setSettings({ ...settings, formBackground: e.target.value })} className="w-28 rounded-lg border border-border px-3 py-2 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Label Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.labelColor} onChange={(e) => setSettings({ ...settings, labelColor: e.target.value })} className="h-10 w-16 rounded border border-border cursor-pointer" />
                    <input value={settings.labelColor} onChange={(e) => setSettings({ ...settings, labelColor: e.target.value })} className="w-28 rounded-lg border border-border px-3 py-2 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Border Radius (px)</label>
                  <input type="range" min="0" max="20" value={settings.borderRadius} onChange={(e) => setSettings({ ...settings, borderRadius: e.target.value })} className="w-full" />
                  <p className="text-xs text-text-muted mt-1">{settings.borderRadius}px</p>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.showBranding} onChange={(e) => setSettings({ ...settings, showBranding: e.target.checked })} className="rounded" />
                  <span className="text-sm text-text-primary">Show "Powered by Clinicovia" branding</span>
                </label>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Three-column layout (Builder mode) */}
      {phase === "builder" && <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Field Palette */}
        <div className="w-60 border-r border-border bg-white overflow-y-auto shrink-0 p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Add Fields
          </h3>
          {FIELD_CATEGORIES.map((cat) => {
            const types = FIELD_TYPES.filter((ft) => ft.category === cat);
            return (
              <div key={cat} className="mb-4">
                <p className="text-xs font-medium text-text-secondary mb-1.5 px-1">
                  {cat}
                </p>
                <div className="space-y-1">
                  {types.map((ft) => (
                    <button
                      key={ft.type}
                      onClick={() => addField(ft.type)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-primary hover:bg-[var(--primary-light)]/10 hover:text-[var(--primary)] transition-colors"
                    >
                      <span className="text-text-muted">{ft.icon}</span>
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* CENTER: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <LayoutTemplate className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-secondary font-medium mb-1">
                No fields yet
              </p>
              <p className="text-sm text-text-muted">
                Click a field type on the left to add it to your form.
              </p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="form-canvas">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="max-w-2xl mx-auto space-y-2"
                  >
                    {fields.map((field, index) => (
                      <Draggable
                        key={field.id}
                        draggableId={field.id}
                        index={index}
                      >
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`group flex items-center gap-2 p-3 rounded-xl border bg-white transition-all cursor-pointer ${
                              selectedFieldId === field.id
                                ? "border-[var(--primary-light)] ring-2 ring-[var(--primary-light)]/20"
                                : "border-border hover:border-gray-300"
                            } ${snapshot.isDragging ? "shadow-lg" : ""}`}
                            onClick={() => setSelectedFieldId(field.id)}
                          >
                            <div
                              {...dragProvided.dragHandleProps}
                              className="p-1 text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-text-muted">
                                  {getFieldIcon(field.type)}
                                </span>
                                <span className="font-medium text-sm text-text-primary truncate">
                                  {field.label}
                                </span>
                                {field.required && (
                                  <span className="text-red-500 text-xs font-bold">
                                    *
                                  </span>
                                )}
                              </div>
                              {field.helpText && (
                                <p className="text-xs text-text-muted mt-0.5 ml-6 truncate">
                                  {field.helpText}
                                </p>
                              )}
                            </div>

                            <span className="text-[10px] font-medium text-text-muted bg-gray-100 px-2 py-0.5 rounded shrink-0">
                              {field.type}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFieldId(field.id);
                              }}
                              className="p-1 text-text-muted hover:text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.id);
                              }}
                              className="p-1 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* RIGHT: Properties Panel */}
        <div className="w-72 border-l border-border bg-white overflow-y-auto shrink-0 p-4">
          {selectedField ? (
            <PropertiesPanel field={selectedField} onUpdate={updateField} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Settings2 className="w-8 h-8 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">
                Select a field to edit its properties
              </p>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
