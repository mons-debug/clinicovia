"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Save, GripVertical, Trash2, Settings, Loader2, AlertCircle,
  Type, AlignLeft, Mail, Phone, Hash, CalendarDays, Clock, ChevronDown,
  CheckSquare, Circle, Upload, Heading, FileText, Plus, X,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useForm as useFormData, useUpdateForm, type FormField } from "@/lib/api/forms";

const FIELD_TYPES = [
  { type: "text", label: "Text Input", icon: Type, category: "Basic" },
  { type: "textarea", label: "Textarea", icon: AlignLeft, category: "Basic" },
  { type: "email", label: "Email", icon: Mail, category: "Basic" },
  { type: "phone", label: "Phone", icon: Phone, category: "Basic" },
  { type: "number", label: "Number", icon: Hash, category: "Basic" },
  { type: "select", label: "Dropdown", icon: ChevronDown, category: "Choice" },
  { type: "radio", label: "Radio", icon: Circle, category: "Choice" },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, category: "Choice" },
  { type: "checkbox_group", label: "Checkbox Group", icon: CheckSquare, category: "Choice" },
  { type: "date", label: "Date", icon: CalendarDays, category: "Date/Time" },
  { type: "time", label: "Time", icon: Clock, category: "Date/Time" },
  { type: "heading", label: "Heading", icon: Heading, category: "Layout" },
  { type: "paragraph", label: "Paragraph", icon: FileText, category: "Layout" },
];

const CHOICE_TYPES = ["select", "radio", "checkbox_group", "multi_select"];

export default function EditFormPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { data: form, isLoading: formLoading, isError, error: loadError } = useFormData(id);
  const updateMutation = useUpdateForm(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [fields, setFields] = useState<FormField[]>([]);
  const [settings, setSettings] = useState({ submitButtonText: "Submit", submitButtonColor: "#3EC8A0", successMessage: "Thank you!", redirectUrl: null as string | null });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load form data once
  if (form && !initialized) {
    setTitle(form.title);
    setDescription(form.description || "");
    setFormStatus(form.status);
    setFields(form.schema?.fields ?? []);
    setSettings(form.schema?.settings ?? settings);
    setInitialized(true);
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const addField = (type: string) => {
    const ft = FIELD_TYPES.find((t) => t.type === type);
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: ft?.label || type,
      placeholder: "",
      helpText: "",
      required: false,
      validation: {},
      options: CHOICE_TYPES.includes(type) ? [{ label: "Option 1", value: "option_1" }] : [],
      order: fields.length,
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = [...fields];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setFields(items.map((f, i) => ({ ...f, order: i })));
  }, [fields]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    try {
      await updateMutation.mutateAsync({
        title, description: description || null, status: formStatus,
        schema: { fields: fields.map((f, i) => ({ ...f, order: i })), settings },
      });
      toast.success("Form updated");
      router.push(`/forms/${id}`);
    } catch { toast.error("Failed to update"); }
  };

  if (formLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-text-muted" /></div>;
  if (isError || !form) return (
    <div className="space-y-6">
      <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{loadError instanceof Error ? loadError.message : "Not found"}</p></div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href={`/forms/${id}`} className="text-text-secondary hover:text-text-primary"><ArrowLeft className="h-5 w-5" /></Link>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form Title" className="text-lg font-bold text-text-primary bg-transparent border-none outline-none" />
        </div>
        <div className="flex items-center gap-3">
          <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button onClick={handleSave} disabled={updateMutation.isPending} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--primary-light)" }}>
            <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Builder */}
      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Add Field</p>
          {["Basic", "Choice", "Date/Time", "Layout"].map((cat) => (
            <div key={cat} className="mb-3">
              <p className="mb-1 text-[10px] font-medium uppercase text-text-muted">{cat}</p>
              <div className="space-y-1">
                {FIELD_TYPES.filter((t) => t.category === cat).map((ft) => {
                  const Icon = ft.icon;
                  return (
                    <button key={ft.type} onClick={() => addField(ft.type)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-white hover:text-text-primary hover:shadow-sm">
                      <Icon className="h-3.5 w-3.5" /> {ft.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="canvas">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="mx-auto max-w-xl space-y-2" style={{ minHeight: 200 }}>
                  {fields.map((field, index) => (
                    <Draggable key={field.id} draggableId={field.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef} {...provided.draggableProps}
                          onClick={() => setSelectedFieldId(field.id)}
                          className={`flex items-center gap-2 rounded-lg border bg-white p-3 transition-shadow ${selectedFieldId === field.id ? "border-primary-light shadow-md" : "border-border"} ${snapshot.isDragging ? "shadow-lg" : ""}`}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab text-text-muted"><GripVertical className="h-4 w-4" /></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">{field.label}</span>
                              {field.required && <span className="text-xs text-red-500">*</span>}
                            </div>
                            <span className="text-[10px] text-text-muted">{field.type}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="text-text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {fields.length === 0 && <div className="rounded-lg border-2 border-dashed border-border p-12 text-center"><p className="text-sm text-text-muted">Click a field type to add it</p></div>}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Properties */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-white p-4">
          {selectedField ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Field Properties</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-primary">Label</label>
                <input value={selectedField.label} onChange={(e) => updateField(selectedField.id, { label: e.target.value })} className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none" />
              </div>
              {!["heading", "paragraph", "checkbox"].includes(selectedField.type) && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-primary">Placeholder</label>
                  <input value={selectedField.placeholder} onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })} className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-primary">Help Text</label>
                <input value={selectedField.helpText} onChange={(e) => updateField(selectedField.id, { helpText: e.target.value })} className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary-light focus:outline-none" />
              </div>
              {!["heading", "paragraph"].includes(selectedField.type) && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedField.required} onChange={(e) => updateField(selectedField.id, { required: e.target.checked })} className="rounded" />
                  <span className="text-sm text-text-primary">Required</span>
                </label>
              )}
              {CHOICE_TYPES.includes(selectedField.type) && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-primary">Options</label>
                  {selectedField.options.map((opt, i) => (
                    <div key={i} className="mb-1 flex gap-1">
                      <input value={opt.label} onChange={(e) => { const opts = [...selectedField.options]; opts[i] = { ...opts[i], label: e.target.value }; updateField(selectedField.id, { options: opts }); }} placeholder="Label" className="flex-1 rounded border border-border px-2 py-1 text-xs" />
                      <button onClick={() => { const opts = selectedField.options.filter((_, j) => j !== i); updateField(selectedField.id, { options: opts }); }} className="text-text-muted hover:text-red-500"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => updateField(selectedField.id, { options: [...selectedField.options, { label: `Option ${selectedField.options.length + 1}`, value: `option_${selectedField.options.length + 1}` }] })} className="mt-1 flex items-center gap-1 text-xs font-medium" style={{ color: "var(--primary-light)" }}>
                    <Plus className="h-3 w-3" /> Add Option
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-text-muted">Select a field to edit its properties</p>
            </div>
          )}

          {/* Settings section */}
          <div className="mt-8 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Form Settings</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-primary">Button Text</label>
                <input value={settings.submitButtonText} onChange={(e) => setSettings({ ...settings, submitButtonText: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary-light focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-primary">Button Color</label>
                <input type="color" value={settings.submitButtonColor} onChange={(e) => setSettings({ ...settings, submitButtonColor: e.target.value })} className="h-8 w-full rounded border border-border" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-primary">Success Message</label>
                <textarea value={settings.successMessage} onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:border-primary-light focus:outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
