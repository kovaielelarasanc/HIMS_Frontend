import React, { useEffect, useMemo, useRef, useState, memo } from "react"
import { toast } from "sonner"
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Settings,
  Save,
  ArrowUp,
  ArrowDown,
  Pencil,
  Layers,
  Building2,
  ClipboardList,
  Search,
  Check,
  Loader2,
  Sparkles,
  BarChart3,
  Image as ImageIcon,
  Paperclip,
  Sigma,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { emrTemplatesClient } from "@/api/template"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

import {
  createTemplateBuilderStore,
  ensureSchemaShape,
  ensureUiIds,
  stripUiFields,
  mkDefaultSection,
  mkDefaultField,
  moveItem,
  derivedSectionsFromSchema,
  pickFieldTypes,
  normCode,
  normKey,
  shallowSliceEqual,
} from "./templateBuilderStore"
import BuilderPanel from "./BuilderPanel"

/**
 * Clinician-first builder:
 * Step 1: Minimal setup (Template Name, Department, Record Type)
 * Step 2: Visual builder (drag/drop, add fields)
 * Step 3: Properties
 * Step 4: Live Preview
 * Plus: Master Data management (Departments + Record Types CRUD)
 */

function useDebouncedValue(value, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function iconForType(t) {
  const type = String(t || "").toLowerCase()
  if (type === "image") return <ImageIcon className="h-4 w-4" />
  if (type === "file") return <Paperclip className="h-4 w-4" />
  if (type === "calculation") return <Sigma className="h-4 w-4" />
  if (type === "chart") return <BarChart3 className="h-4 w-4" />
  return <Layers className="h-4 w-4" />
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v)
}

/* --------------------------- Store Initialization -------------------------- */

function createInitialStoreState() {
  return {
    // meta
    name: "",
    deptCode: "",
    typeCode: "",
    description: "",
    tagsText: "",
    isActive: true,

    // schema
    schema: ensureUiIds(ensureSchemaShape({ schema_version: 1, sections: [] })),

    // selection
    selectedSectionRid: null,
    selectedItemRid: null, // item rid inside selected section, or child rid in group editing
    selectedGroupParentRid: null, // if editing group child

    // ui
    step: "setup", // setup | build | preview | masters
  }
}

function selectSectionByRid(schema, sectionRid) {
  const secs = schema?.sections || []
  return secs.find((s) => s?._rid === sectionRid) || null
}

function findItemInSection(section, itemRid) {
  const items = section?.items || []
  for (const it of items) {
    if (it?._rid === itemRid) return { item: it, parent: null }
    if (String(it?.type || "") === "group" && Array.isArray(it?.items)) {
      const child = it.items.find((c) => c?._rid === itemRid)
      if (child) return { item: child, parent: it }
    }
  }
  return { item: null, parent: null }
}

/** clinician-friendly labels (UI only) */
// const FIELD_LABELS = {
//   text: "Short Text",
//   textarea: "Long Note",
//   number: "Number / Measurement",
//   date: "Date",
//   time: "Time",
//   datetime: "Date & Time",
//   boolean: "Yes / No",
//   checkbox: "Yes / No",
//   select: "Dropdown",
//   multiselect: "Checklist",
//   radio: "Single Choice",
//   chips: "Tags / Names",
//   table: "Table (Rows)",
//   group: "Conditional Group",
//   signature: "Signature",
//   file: "File Attachment",
//   image: "Image Attachment",
//   calculation: "Auto Calculation",
//   chart: "Chart / Trend",
//   graph: "Chart / Trend",
//   block: "Reusable Block",
// }


// function labelForFieldType(type) {
//   const t = String(type || "").toLowerCase()
//   return FIELD_LABELS[t] || (t ? t[0].toUpperCase() + t.slice(1) : "Field")
// }

function parseRow(rowStr) {
  // format: rid::code::label
  const [rid, code, label] = String(rowStr || "").split("::")
  return { rid, code, label }
}

// function parseItemRow(rowStr) {
//   // format: rid::kind::type::title::hint::childCount
//   const parts = String(rowStr || "").split("::")
//   return {
//     rid: parts[0] || "",
//     kind: parts[1] || "field",
//     type: parts[2] || "text",
//     title: parts[3] || "",
//     hint: parts[4] || "",
//     childCount: Number(parts[5] || 0),
//   }
// }
/* ------------------------------ Memo Rows -------------------------------- */

const SectionRow = memo(function SectionRow({
  title,
  active,
  onClick,
  onMoveUp,
  onMoveDown,
  onDelete,
  draggableProps,
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-2xl border px-3 py-2",
        active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
      )}
      onClick={onClick}
    >
      <div className="cursor-grab text-slate-400" {...draggableProps}>
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
      </div>

      <div className="hidden items-center gap-1 group-hover:flex">
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveUp())}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl"
          onClick={(e) => (e.stopPropagation(), onMoveDown())}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl text-rose-600 hover:text-rose-700"
          onClick={(e) => (e.stopPropagation(), onDelete())}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})

// const ItemRow = memo(function ItemRow({ title, active, meta, onClick, onMoveUp, onMoveDown, onDelete, draggableProps }) {
//   return (
//     <div
//       className={cn(
//         "group flex items-center gap-2 rounded-2xl border px-3 py-2",
//         active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
//       )}
//       onClick={onClick}
//     >
//       <div className="cursor-grab text-slate-400" {...draggableProps}>
//         <GripVertical className="h-4 w-4" />
//       </div>

//       <div className="flex items-center gap-2">
//         <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
//           {iconForType(meta?.type)}
//         </div>
//       </div>

//       <div className="min-w-0 flex-1">
//         <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
//         {meta?.hint ? <div className="truncate text-xs text-slate-500">{meta.hint}</div> : null}
//       </div>

//       <div className="hidden items-center gap-1 group-hover:flex">
//         <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveUp())}>
//           <ArrowUp className="h-4 w-4" />
//         </Button>
//         <Button
//           size="icon"
//           variant="ghost"
//           className="h-8 w-8 rounded-xl"
//           onClick={(e) => (e.stopPropagation(), onMoveDown())}
//         >
//           <ArrowDown className="h-4 w-4" />
//         </Button>
//         <Button
//           size="icon"
//           variant="ghost"
//           className="h-8 w-8 rounded-xl text-rose-600 hover:text-rose-700"
//           onClick={(e) => (e.stopPropagation(), onDelete())}
//         >
//           <Trash2 className="h-4 w-4" />
//         </Button>
//       </div>
//     </div>
//   )
// })

/* --------------------------- Master Data Manager -------------------------- */

function MastersPanel({ onRefreshMeta }) {
  const [tab, setTab] = useState("departments")
  return (
    <div className="h-full p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">Master Data</div>
          <div className="text-sm text-slate-500">Maintain Departments and Record Types (Create / Edit / Delete).</div>
        </div>
        <Button variant="outline" className="rounded-2xl" onClick={onRefreshMeta}>
          <Sparkles className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="h-[calc(100%-72px)]">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="departments" className="rounded-2xl">
            Departments
          </TabsTrigger>
          <TabsTrigger value="types" className="rounded-2xl">
            Record Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="mt-4 h-[calc(100%-56px)]">
          <DepartmentsCRUD onChanged={onRefreshMeta} />
        </TabsContent>

        <TabsContent value="types" className="mt-4 h-[calc(100%-56px)]">
          <RecordTypesCRUD onChanged={onRefreshMeta} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DepartmentsCRUD({ onChanged }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState("")
  const qd = useDebouncedValue(q, 200)
  const [busy, setBusy] = useState(false)

  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code: "", name: "", is_active: true, display_order: 1000 })

  async function load() {
    setBusy(true)
    try {
      const list = await emrTemplatesClient.departmentsList({ active: false })
      setRows(Array.isArray(list) ? list : [])
    } catch (e) {
      toast.error(e?.message || "Failed to load departments")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = qd.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => String(r?.code || "").toLowerCase().includes(s) || String(r?.name || "").toLowerCase().includes(s))
  }, [rows, qd])

  function startCreate() {
    setEditId("__new__")
    setForm({ code: "", name: "", is_active: true, display_order: 1000 })
  }

  function startEdit(r) {
    setEditId(r.id)
    setForm({
      code: String(r.code || ""),
      name: String(r.name || ""),
      is_active: !!r.is_active,
      display_order: Number(r.display_order || 1000),
    })
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Department name is required")
    if (!form.code.trim()) return toast.error("Department code is required")

    setBusy(true)
    try {
      if (editId === "__new__") {
        // IMPORTANT: backend DeptCreateIn forbids extras — only send allowed keys
        await emrTemplatesClient.departmentsCreate({
          code: normCode(form.code),
          name: form.name.trim(),
          is_active: !!form.is_active,
          display_order: Number(form.display_order || 1000),
        })
        toast.success("Department created")
      } else {
        // DeptUpdateIn: name/is_active/display_order (no code change)
        await emrTemplatesClient.departmentsUpdate(editId, {
          name: form.name.trim(),
          is_active: !!form.is_active,
          display_order: Number(form.display_order || 1000),
        })
        toast.success("Department updated")
      }
      setEditId(null)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!confirm("Delete this department?")) return
    setBusy(true)
    try {
      await emrTemplatesClient.departmentsDelete(id)
      toast.success("Department deleted")
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="h-full rounded-3xl border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Departments</CardTitle>
            <CardDescription>Edit / Delete supported</CardDescription>
          </div>
          <Button className="rounded-2xl" onClick={startCreate} disabled={busy}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="h-10 rounded-2xl pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <Button variant="outline" className="rounded-2xl" onClick={load} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reload
          </Button>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-120px)]">
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-full overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {filtered.map((r) => (
              <div key={r.id} className="mb-2 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{r.code}</div>
                    <div className="text-sm text-slate-600">{r.name}</div>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="secondary" className="rounded-xl">
                        Order: {r.display_order}
                      </Badge>
                      <Badge className={cn("rounded-xl", r.is_active ? "bg-emerald-600" : "bg-slate-400")}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" className="h-9 w-9 rounded-2xl" onClick={() => startEdit(r)} disabled={busy}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => remove(r.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="p-4 text-sm text-slate-500">No departments.</div>}
          </div>

          <div className="h-full rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">
              {editId ? (editId === "__new__" ? "Create Department" : "Edit Department") : "Select an item to edit"}
            </div>

            {editId ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    className="h-11 rounded-2xl font-mono"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    disabled={editId !== "__new__"}
                    placeholder="e.g., CARDIOLOGY"
                  />
                  {editId !== "__new__" ? (
                    <div className="text-xs text-slate-500">Code cannot be changed after creation.</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    className="h-11 rounded-2xl"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Cardiology"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      className="h-11 rounded-2xl"
                      type="number"
                      value={form.display_order}
                      onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value || 0) }))}
                    />
                  </div>

                  <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                      <div className="text-sm font-medium text-slate-700">Active</div>
                      <div className="text-xs text-slate-500">Available to users</div>
                    </div>
                    <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: !!v }))} />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="rounded-2xl" onClick={() => setEditId(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button className="rounded-2xl" onClick={save} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Choose a department on the left to edit, or click “Add”.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecordTypesCRUD({ onChanged }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState("")
  const qd = useDebouncedValue(q, 200)
  const [busy, setBusy] = useState(false)

  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code: "", label: "", category: "CLINICAL", is_active: true, display_order: 1000 })

  async function load() {
    setBusy(true)
    try {
      const list = await emrTemplatesClient.recordTypesList({ active: false })
      setRows(Array.isArray(list) ? list : [])
    } catch (e) {
      toast.error(e?.message || "Failed to load record types")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = qd.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        String(r?.code || "").toLowerCase().includes(s) ||
        String(r?.label || "").toLowerCase().includes(s) ||
        String(r?.category || "").toLowerCase().includes(s)
    )
  }, [rows, qd])

  function startCreate() {
    setEditId("__new__")
    setForm({ code: "", label: "", category: "CLINICAL", is_active: true, display_order: 1000 })
  }

  function startEdit(r) {
    setEditId(r.id)
    setForm({
      code: String(r.code || ""),
      label: String(r.label || ""),
      category: r.category ? String(r.category) : "CLINICAL",
      is_active: !!r.is_active,
      display_order: Number(r.display_order || 1000),
    })
  }

  async function save() {
    if (!form.label.trim()) return toast.error("Record type label is required")
    if (!form.code.trim()) return toast.error("Record type code is required")

    setBusy(true)
    try {
      if (editId === "__new__") {
        // IMPORTANT: TypeCreateIn forbids extras — only send allowed keys
        await emrTemplatesClient.recordTypesCreate({
          code: normCode(form.code),
          label: form.label.trim(),
          category: form.category ? String(form.category).trim() : null,
          is_active: !!form.is_active,
          display_order: Number(form.display_order || 1000),
        })
        toast.success("Record type created")
      } else {
        // TypeUpdateIn: label/category/is_active/display_order (no code change)
        await emrTemplatesClient.recordTypesUpdate(editId, {
          label: form.label.trim(),
          category: form.category ? String(form.category).trim() : null,
          is_active: !!form.is_active,
          display_order: Number(form.display_order || 1000),
        })
        toast.success("Record type updated")
      }
      setEditId(null)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!confirm("Delete this record type?")) return
    setBusy(true)
    try {
      await emrTemplatesClient.recordTypesDelete(id)
      toast.success("Record type deleted")
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  const categories = ["CLINICAL", "ADMINISTRATIVE", "RESEARCH", "QUALITY", "BILLING", "LEGAL", "OTHER"]

  return (
    <Card className="h-full rounded-3xl border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Record Types</CardTitle>
            <CardDescription>Edit / Delete supported</CardDescription>
          </div>
          <Button className="rounded-2xl" onClick={startCreate} disabled={busy}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="h-10 rounded-2xl pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <Button variant="outline" className="rounded-2xl" onClick={load} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reload
          </Button>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-120px)]">
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-full overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {filtered.map((r) => (
              <div key={r.id} className="mb-2 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{r.code}</div>
                    <div className="text-sm text-slate-600">{r.label}</div>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="secondary" className="rounded-xl">
                        {r.category || "—"}
                      </Badge>
                      <Badge variant="secondary" className="rounded-xl">
                        Order: {r.display_order}
                      </Badge>
                      <Badge className={cn("rounded-xl", r.is_active ? "bg-emerald-600" : "bg-slate-400")}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" className="h-9 w-9 rounded-2xl" onClick={() => startEdit(r)} disabled={busy}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => remove(r.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="p-4 text-sm text-slate-500">No record types.</div>}
          </div>

          <div className="h-full rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">
              {editId ? (editId === "__new__" ? "Create Record Type" : "Edit Record Type") : "Select an item to edit"}
            </div>

            {editId ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    className="h-11 rounded-2xl font-mono"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    disabled={editId !== "__new__"}
                    placeholder="e.g., DISCHARGE_SUMMARY"
                  />
                  {editId !== "__new__" ? <div className="text-xs text-slate-500">Code cannot be changed after creation.</div> : null}
                </div>

                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input className="h-11 rounded-2xl" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category || "CLINICAL"} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-11 rounded-2xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      className="h-11 rounded-2xl"
                      type="number"
                      value={form.display_order}
                      onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value || 0) }))}
                    />
                  </div>

                  <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                      <div className="text-sm font-medium text-slate-700">Active</div>
                      <div className="text-xs text-slate-500">Available to users</div>
                    </div>
                    <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: !!v }))} />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="rounded-2xl" onClick={() => setEditId(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button className="rounded-2xl" onClick={save} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Choose a record type on the left to edit, or click “Add”.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ----------------------------- Preview Renderer --------------------------- */


/* -------------------------------------------------------------------------- */
/*                                   PREVIEW                                  */
/* -------------------------------------------------------------------------- */
/**
 * Advanced Preview:
 * - Honors section/group layout (STACK / GRID_2 / GRID_3) + field width hints
 * - Interactive values so "Visible When" rules can be tested (eq/neq)
 * - Supports group children in BOTH models:
 *    1) nested: group.items[]
 *    2) flat: items with parent_key === group.key
 * - Table preview supports add/remove row with inline editing
 */

const PREVIEW_NONE = "__none__"

function layoutCols(layout) {
  const l = String(layout || "STACK").toUpperCase()
  if (l === "GRID_3") return 3
  if (l === "GRID_2") return 2
  return 1
}

function gridColsClass(cols) {
  if (cols === 3) return "grid-cols-1 md:grid-cols-3"
  if (cols === 2) return "grid-cols-1 md:grid-cols-2"
  return "grid-cols-1"
}

function colSpanClass(width, cols) {
  const w = String(width || "FULL").toUpperCase()
  if (cols <= 1) return ""
  if (w === "FULL") return `md:col-span-${cols}`
  if (w === "HALF") return cols >= 2 ? "md:col-span-1" : ""
  if (w === "THIRD") return cols >= 3 ? "md:col-span-1" : ""
  if (w === "AUTO") return "md:col-span-1"
  return ""
}

function normalizeSectionItems(items) {
  const arr = Array.isArray(items) ? items : []
  // If schema already uses nested groups, keep as-is.
  const hasNested = arr.some((it) => String(it?.type || "") === "group" && Array.isArray(it?.items))
  if (hasNested) return arr

  // Else support older flat model: children stored with parent_key
  const groupKeys = new Set(
    arr
      .filter((it) => String(it?.type || "") === "group" && it?.key)
      .map((it) => String(it.key))
  )

  if (!groupKeys.size) return arr
  const hasFlatChildren = arr.some((it) => it?.parent_key && groupKeys.has(String(it.parent_key)))
  if (!hasFlatChildren) return arr

  const top = []
  for (const it of arr) {
    if (it?.parent_key && groupKeys.has(String(it.parent_key))) continue // omit children from top-level
    if (String(it?.type || "") === "group" && it?.key) {
      const kids = arr.filter((x) => String(x?.parent_key || "") === String(it.key))
      top.push({ ...it, items: kids })
    } else {
      top.push(it)
    }
  }
  return top
}

function evalVisibleWhen(vw, values) {
  if (!vw || typeof vw !== "object") return true
  const fieldKey = String(vw.field_key || "")
  if (!fieldKey) return true

  const op = String(vw.op || "eq")
  const actual = values?.[fieldKey]
  const expected = vw.value

  // Best-effort type matching based on expected value
  let a = actual
  let e = expected

  if (e === true || e === false) {
    a = actual === true ? true : actual === false ? false : String(actual) === "true"
  } else if (typeof e === "number") {
    a = actual == null || actual === "" ? null : Number(actual)
  } else if (e == null) {
    a = actual == null ? null : String(actual)
  } else {
    a = actual == null ? "" : String(actual)
    e = String(e)
  }

  const eq = a === e
  return op === "neq" ? !eq : eq
}

function isVisible(item, values) {
  const rules = item?.rules || {}
  const vw = rules.visible_when || null
  return evalVisibleWhen(vw, values)
}

function itemReactKey(it, fallback) {
  return it?._rid || it?.key || fallback
}

const PreviewField = memo(function PreviewField({ item, ctx, cols }) {
  const t = String(item?.type || "text").toLowerCase()
  const label = safeStr(item?.label || (item?.key ? String(item.key) : "Field"))
  const help = safeStr(item?.help_text || "")
  const required = !!item?.required
  const readonly = !!item?.readonly

  const visible = isVisible(item, ctx.values)
  if (!visible && !ctx.showHidden) return null

  // Group is a container: render as a card with its own grid layout
  if (t === "group") {
    const groupCols = layoutCols(item?.group?.layout || "STACK")
    const kids = Array.isArray(item?.items) ? item.items : []
    const vw = item?.rules?.visible_when || null
    const spanCls = colSpanClass(item?.ui?.width || "FULL", cols)

    return (
      <div className={cn("rounded-3xl border border-slate-200 bg-white p-4", spanCls, !visible ? "opacity-60" : "")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {label}
              {required ? <span className="ml-1 text-rose-600">*</span> : null}
            </div>
            {help ? <div className="mt-1 text-xs text-slate-500">{help}</div> : null}
          </div>

          {vw?.field_key ? (
            <Badge variant="secondary" className="rounded-xl">
              Visible when: {safeStr(vw.field_key)} {safeStr(vw.op || "eq")} {safeStr(vw.value)}
            </Badge>
          ) : null}
        </div>

        <div className={cn("mt-4 grid gap-4", gridColsClass(groupCols))}>
          {kids.map((k, idx) => (
            <PreviewField key={itemReactKey(k, `${itemReactKey(item, "g")}_${idx}`)} item={k} ctx={ctx} cols={groupCols} />
          ))}
          {!kids.length ? <div className="text-sm text-slate-500">No fields inside this group yet.</div> : null}
        </div>
      </div>
    )
  }

  const spanCls = colSpanClass(item?.ui?.width || "FULL", cols)

  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-4", spanCls, !visible ? "opacity-60" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {label}
            {required ? <span className="ml-1 text-rose-600">*</span> : null}
          </div>
          {help ? <div className="mt-1 text-xs text-slate-500">{help}</div> : null}
        </div>

        {readonly ? (
          <Badge variant="secondary" className="rounded-xl">
            Read-only
          </Badge>
        ) : null}
      </div>

      <div className="mt-3">
        <PreviewControl item={item} type={t} ctx={ctx} disabled={readonly} />
      </div>
    </div>
  )
})

const PreviewControl = memo(function PreviewControl({ item, type, ctx, disabled }) {
  const key = item?.key ? String(item.key) : item?._rid ? String(item._rid) : null
  const v = key ? ctx.values?.[key] : undefined

  function setVal(next) {
    if (!key) return
    ctx.setValue(key, next)
  }

  // Text-like
  if (type === "text") {
    return (
      <Input
        className="h-11 rounded-2xl"
        value={safeStr(v ?? "")}
        onChange={(e) => setVal(e.target.value)}
        placeholder={safeStr(item?.placeholder || "Type…")}
        disabled={disabled}
      />
    )
  }

  if (type === "textarea") {
    return (
      <Textarea
        className="min-h-[90px] rounded-2xl"
        value={safeStr(v ?? "")}
        onChange={(e) => setVal(e.target.value)}
        placeholder={safeStr(item?.placeholder || "Type…")}
        disabled={disabled}
      />
    )
  }

  if (type === "number") {
    const unit = safeStr(item?.clinical?.unit || "")
    return (
      <div className="flex items-center gap-2">
        <Input
          className="h-11 rounded-2xl"
          type="number"
          value={safeStr(v ?? "")}
          onChange={(e) => setVal(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="0"
          disabled={disabled}
        />
        {unit ? (
          <Badge variant="secondary" className="rounded-xl">
            {unit}
          </Badge>
        ) : null}
      </div>
    )
  }

  if (type === "date" || type === "time" || type === "datetime") {
    const inputType = type === "datetime" ? "datetime-local" : type
    return (
      <Input
        className="h-11 rounded-2xl"
        type={inputType}
        value={safeStr(v ?? "")}
        onChange={(e) => setVal(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (type === "boolean") {
    const checked = v === true
    return (
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm text-slate-700">{checked ? "Yes" : "No"}</div>
        <Switch checked={checked} onCheckedChange={(next) => setVal(!!next)} disabled={disabled} />
      </div>
    )
  }

  if (["select", "radio"].includes(type)) {
    const options = Array.isArray(item?.options) ? item.options : []
    const sel = v == null || v === "" ? PREVIEW_NONE : String(v)

    return (
      <Select value={sel} onValueChange={(next) => setVal(next === PREVIEW_NONE ? null : next)} disabled={disabled}>
        <SelectTrigger className="h-11 rounded-2xl">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent className="max-h-[260px]">
          <SelectItem value={PREVIEW_NONE}>—</SelectItem>
          {options.map((o, idx) => (
            <SelectItem key={`${o.value}-${idx}`} value={String(o.value)}>
              {safeStr(o.label || o.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === "multiselect") {
    const options = Array.isArray(item?.options) ? item.options : []
    const arr = Array.isArray(v) ? v : []
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o, idx) => {
          const val = String(o.value)
          const active = arr.includes(val)
          return (
            <button
              key={`${val}-${idx}`}
              type="button"
              className={cn(
                "rounded-2xl border px-3 py-2 text-sm",
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
              )}
              onClick={() => {
                if (disabled) return
                const next = active ? arr.filter((x) => x !== val) : [...arr, val]
                setVal(next)
              }}
            >
              {safeStr(o.label || o.value)}
            </button>
          )
        })}
        {!options.length ? <div className="text-sm text-slate-500">No options.</div> : null}
      </div>
    )
  }

  if (type === "chips") {
    const s = safeStr(v ?? "")
    const tags = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)

    return (
      <div className="space-y-2">
        <Input
          className="h-11 rounded-2xl"
          value={s}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Comma-separated…"
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          {tags.map((t, idx) => (
            <Badge key={`${t}-${idx}`} variant="secondary" className="rounded-xl">
              {t}
            </Badge>
          ))}
          {!tags.length ? <div className="text-sm text-slate-500">No tags.</div> : null}
        </div>
      </div>
    )
  }

  if (type === "table") {
    const table = item?.table || {}
    const cols = Array.isArray(table.columns) ? table.columns : []
    const allowAdd = table.allow_add_row !== false
    const allowDel = table.allow_delete_row !== false

    const rows = Array.isArray(v) ? v : []
    const safeRows = rows.length ? rows : [{}]

    function patchCell(rowIdx, colKey, nextVal) {
      const next = safeRows.map((r, i) => (i === rowIdx ? { ...(r || {}), [colKey]: nextVal } : r))
      setVal(next)
    }

    function addRow() {
      setVal([...safeRows, {}])
    }

    function delRow(i) {
      const next = safeRows.filter((_, idx) => idx !== i)
      setVal(next.length ? next : [])
    }

    return (
      <div className="space-y-3">
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {cols.map((c) => (
                  <th key={c._rid || c.key} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                    {safeStr(c.label || c.key)}
                  </th>
                ))}
                {allowDel ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {safeRows.map((r, rowIdx) => (
                <tr key={rowIdx} className="border-t">
                  {cols.map((c) => {
                    const ck = String(c.key || "")
                    const cv = r?.[ck]
                    const ct = String(c.type || "text")
                    return (
                      <td key={c._rid || ck} className="px-3 py-2 align-top">
                        {ct === "number" ? (
                          <Input
                            className="h-10 rounded-2xl"
                            type="number"
                            value={safeStr(cv ?? "")}
                            onChange={(e) => patchCell(rowIdx, ck, e.target.value === "" ? null : Number(e.target.value))}
                            disabled={disabled}
                          />
                        ) : (
                          <Input
                            className="h-10 rounded-2xl"
                            value={safeStr(cv ?? "")}
                            onChange={(e) => patchCell(rowIdx, ck, e.target.value)}
                            disabled={disabled}
                          />
                        )}
                      </td>
                    )
                  })}
                  {allowDel ? (
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 w-9 rounded-2xl text-rose-600"
                        onClick={() => delRow(rowIdx)}
                        disabled={disabled || safeRows.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allowAdd ? (
          <Button type="button" variant="outline" className="rounded-2xl" onClick={addRow} disabled={disabled}>
            Add row
          </Button>
        ) : null}

        {!cols.length ? <div className="text-sm text-slate-500">No columns.</div> : null}
      </div>
    )
  }

  if (type === "signature") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Signature capture (preview)
      </div>
    )
  }

  if (type === "file" || type === "image") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {type === "image" ? "Image upload" : "File upload"} (preview)
      </div>
    )
  }

  if (type === "calculation") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Auto-calculation (read-only)
      </div>
    )
  }

  if (type === "chart" || type === "graph") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Graph / trend (preview)
      </div>
    )
  }

  return <div className="text-sm text-slate-500">Preview not available for this field type.</div>
})

function PreviewPanel({ schema }) {
  const sections = schema?.sections || []
  const [values, setValues] = useState({})
  const [showHidden, setShowHidden] = useState(false)

  function setValue(key, next) {
    setValues((prev) => ({ ...(prev || {}), [key]: next }))
  }

  function reset() {
    setValues({})
  }

  const ctx = useMemo(() => ({ values, setValue, showHidden }), [values, showHidden])

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Live Preview</div>
              <div className="text-xs text-slate-500">Interact with fields to test “Visible When” rules.</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs text-slate-600">Show hidden</span>
                <Switch checked={showHidden} onCheckedChange={(v) => setShowHidden(!!v)} />
              </div>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {sections.map((sec) => {
          const cols = layoutCols(sec?.layout || "STACK")
          const items = normalizeSectionItems(sec?.items || [])

          return (
            <Card key={sec._rid} className="rounded-3xl border-slate-200">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{safeStr(sec.label || sec.code || "Section")}</CardTitle>
                    <CardDescription>{safeStr(sec.code)}</CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {sec?.repeatable ? (
                      <Badge variant="secondary" className="rounded-xl">
                        Repeatable
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="rounded-xl">
                      {cols === 3 ? "Grid 3" : cols === 2 ? "Grid 2" : "Stack"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className={cn("grid gap-4", gridColsClass(cols))}>
                {items.map((it, idx) => (
                  <PreviewField key={itemReactKey(it, `${sec._rid}_${idx}`)} item={it} ctx={ctx} cols={cols} />
                ))}

                {!items.length ? <div className="text-sm text-slate-500">No fields added yet.</div> : null}
              </CardContent>
            </Card>
          )
        })}

        {!sections.length ? (
          <Alert className="rounded-3xl border-slate-200">
            <AlertTitle>No sections yet</AlertTitle>
            <AlertDescription>Add sections and fields in the Builder tab.</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </ScrollArea>
  )
}


/* ---------------------------- Properties Editor --------------------------- */

// const PropertiesPanel = memo(function PropertiesPanel({ store }) {
//   const selection = store.useStore(
//     (s) => ({
//       schema: s.schema,
//       selectedSectionRid: s.selectedSectionRid,
//       selectedItemRid: s.selectedItemRid,
//       selectedGroupParentRid: s.selectedGroupParentRid,
//     }),
//     shallowSliceEqual
//   )

//   const schema = selection.schema
//   const section = selection.selectedSectionRid ? selectSectionByRid(schema, selection.selectedSectionRid) : null

//   const { item, parent } = section && selection.selectedItemRid ? findItemInSection(section, selection.selectedItemRid) : { item: null, parent: null }
//   const effectiveItem = item || null
//   const isGroupChild = !!parent

//   function patchSection(patch) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const idx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
//       if (idx < 0) return prev
//       secs[idx] = { ...secs[idx], ...(patch || {}) }
//       return { ...prev, schema: { ...base, sections: secs } }
//     })
//   }

//   function patchItem(patch) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
//       if (sidx < 0) return prev

//       const sec = secs[sidx]
//       const items = [...(sec.items || [])]

//       // group child patch
//       if (prev.selectedItemRid && prev.selectedGroupParentRid) {
//         const pidx = items.findIndex((x) => x?._rid === prev.selectedGroupParentRid)
//         if (pidx < 0) return prev
//         const parent2 = { ...items[pidx], items: [...(items[pidx]?.items || [])] }
//         const cidx = parent2.items.findIndex((c) => c?._rid === prev.selectedItemRid)
//         if (cidx < 0) return prev
//         parent2.items[cidx] = { ...(parent2.items[cidx] || {}), ...(patch || {}) }
//         items[pidx] = parent2
//       } else {
//         const iidx = items.findIndex((x) => x?._rid === prev.selectedItemRid)
//         if (iidx < 0) return prev
//         items[iidx] = { ...(items[iidx] || {}), ...(patch || {}) }
//       }

//       secs[sidx] = { ...sec, items }
//       return { ...prev, schema: { ...base, sections: secs } }
//     })
//   }

//   if (!section) {
//     return (
//       <div className="h-full p-4 md:p-6">
//         <Alert className="rounded-3xl border-slate-200">
//           <AlertTitle>Select a section</AlertTitle>
//           <AlertDescription>Click a section on the left to edit its properties.</AlertDescription>
//         </Alert>
//       </div>
//     )
//   }

//   if (!effectiveItem) {
//     return (
//       <ScrollArea className="h-full">
//         <div className="p-4 md:p-6">
//           <Card className="rounded-3xl border-slate-200">
//             <CardHeader>
//               <CardTitle className="text-base">Section Properties</CardTitle>
//               <CardDescription>Clinician-friendly naming and layout</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <div className="space-y-2">
//                 <Label>Section Code</Label>
//                 <Input
//                   className="h-11 rounded-2xl font-mono"
//                   value={safeStr(section.code)}
//                   onChange={(e) => patchSection({ code: normCode(e.target.value) })}
//                 />
//               </div>

//               <div className="space-y-2">
//                 <Label>Section Title</Label>
//                 <Input className="h-11 rounded-2xl" value={safeStr(section.label)} onChange={(e) => patchSection({ label: e.target.value })} />
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <div className="space-y-2">
//                   <Label>Layout</Label>
//                   <Select value={safeStr(section.layout || "STACK")} onValueChange={(v) => patchSection({ layout: v })}>
//                     <SelectTrigger className="h-11 rounded-2xl">
//                       <SelectValue placeholder="Layout" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {["STACK", "GRID_2", "GRID_3"].map((x) => (
//                         <SelectItem key={x} value={x}>
//                           {x}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
//                   <div>
//                     <div className="text-sm font-medium text-slate-700">Repeatable</div>
//                     <div className="text-xs text-slate-500">Allow repeating this section</div>
//                   </div>
//                   <Switch checked={!!section.repeatable} onCheckedChange={(v) => patchSection({ repeatable: !!v })} />
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </ScrollArea>
//     )
//   }

//   const type = String(effectiveItem?.type || "text")
//   const title = safeStr(effectiveItem?.label || effectiveItem?.key || "Field")
//   const hint = safeStr(effectiveItem?.help_text || "")

//   return (
//     <ScrollArea className="h-full">
//       <div className="p-4 md:p-6">
//         <Card className="rounded-3xl border-slate-200">
//           <CardHeader>
//             <CardTitle className="text-base">
//               Field Properties {isGroupChild ? <Badge className="ml-2 rounded-xl bg-slate-700">Group Item</Badge> : null}
//             </CardTitle>
//             <CardDescription>
//               <span className="font-mono">{type}</span> · {title}
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-4">
//             <div className="space-y-2">
//               <Label>Label</Label>
//               <Input className="h-11 rounded-2xl" value={safeStr(effectiveItem.label)} onChange={(e) => patchItem({ label: e.target.value })} />
//             </div>

//             <div className="space-y-2">
//               <Label>Key</Label>
//               <Input
//                 className="h-11 rounded-2xl font-mono"
//                 value={safeStr(effectiveItem.key)}
//                 onChange={(e) => patchItem({ key: normKey(e.target.value) })}
//               />
//             </div>

//             <div className="grid grid-cols-2 gap-3">
//               <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
//                 <div>
//                   <div className="text-sm font-medium text-slate-700">Required</div>
//                   <div className="text-xs text-slate-500">Must be filled</div>
//                 </div>
//                 <Switch checked={!!effectiveItem.required} onCheckedChange={(v) => patchItem({ required: !!v })} />
//               </div>

//               <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
//                 <div>
//                   <div className="text-sm font-medium text-slate-700">Read-only</div>
//                   <div className="text-xs text-slate-500">Lock in UI</div>
//                 </div>
//                 <Switch checked={!!effectiveItem.readonly} onCheckedChange={(v) => patchItem({ readonly: !!v })} />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label>Help Text</Label>
//               <Textarea className="min-h-[90px] rounded-2xl" value={hint} onChange={(e) => patchItem({ help_text: e.target.value })} />
//             </div>

//             {type === "chart" ? (
//               <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
//                 <div className="text-sm font-semibold text-slate-900">Chart Settings</div>

//                 <div className="space-y-2">
//                   <Label>Title</Label>
//                   <Input
//                     className="h-11 rounded-2xl"
//                     value={safeStr(effectiveItem?.chart?.title || "")}
//                     onChange={(e) => patchItem({ chart: { ...(effectiveItem.chart || {}), title: e.target.value } })}
//                   />
//                 </div>

//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="space-y-2">
//                     <Label>Chart Type</Label>
//                     <Select
//                       value={safeStr(effectiveItem?.chart?.chart_type || "LINE")}
//                       onValueChange={(v) => patchItem({ chart: { ...(effectiveItem.chart || {}), chart_type: v } })}
//                     >
//                       <SelectTrigger className="h-11 rounded-2xl">
//                         <SelectValue />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {["LINE", "BAR", "AREA"].map((x) => (
//                           <SelectItem key={x} value={x}>
//                             {x}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </div>

//                   <div className="flex items-end justify-between rounded-2xl border border-slate-200 bg-white p-3">
//                     <div>
//                       <div className="text-sm font-medium text-slate-700">Legend</div>
//                       <div className="text-xs text-slate-500">Show legend</div>
//                     </div>
//                     <Switch
//                       checked={!!effectiveItem?.chart?.show_legend}
//                       onCheckedChange={(v) => patchItem({ chart: { ...(effectiveItem.chart || {}), show_legend: !!v } })}
//                     />
//                   </div>
//                 </div>
//               </div>
//             ) : null}
//           </CardContent>
//         </Card>
//       </div>
//     </ScrollArea>
//   )
// })

/* ------------------------------ Builder Panel ----------------------------- */

// const BuilderPanel = memo(function BuilderPanel({ store, fieldTypes }) {
//   return (
//     <div className="h-full min-h-0">
//       {/* Desktop / Tablet */}
//       <div className="hidden h-full min-h-0 md:block">
//         <div className="grid h-full min-h-0 grid-cols-12 gap-4 p-4 md:p-6">
//           <SectionsPane store={store} className="col-span-12 md:col-span-4 lg:col-span-3" />
//           <FieldsPane store={store} fieldTypes={fieldTypes} className="col-span-12 md:col-span-8 lg:col-span-6" />
//           <PropertiesPane store={store} className="col-span-12 lg:col-span-3" />
//         </div>
//       </div>

//       {/* Mobile */}
//       <div className="md:hidden h-full min-h-0 p-3">
//         <MobileTabs store={store} fieldTypes={fieldTypes} />
//       </div>
//     </div>
//   )
// })

/* -------------------------------------------------------------------------- */
/*                                MOBILE TABS                                 */
/* -------------------------------------------------------------------------- */

// const MobileTabs = memo(function MobileTabs({ store, fieldTypes }) {
//   const [tab, setTab] = useState("fields")

//   // show tab badges / small context by reading only ids
//   const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)
//   const selectedItemRid = store.useStore((s) => s.selectedItemRid || null, Object.is)

//   return (
//     <div className="h-full min-h-0 flex flex-col">
//       <Tabs value={tab} onValueChange={setTab} className="h-full min-h-0 flex flex-col">
//         <TabsList className="grid grid-cols-3 rounded-2xl p-1">
//           <TabsTrigger value="sections" className="rounded-2xl">
//             Sections
//           </TabsTrigger>
//           <TabsTrigger value="fields" className="rounded-2xl">
//             Fields
//           </TabsTrigger>
//           <TabsTrigger value="config" className="rounded-2xl">
//             Configure
//           </TabsTrigger>
//         </TabsList>

//         <div className="mt-3 h-full min-h-0">
//           <TabsContent value="sections" className="h-full min-h-0 m-0">
//             <SectionsPane store={store} className="h-full" />
//           </TabsContent>

//           <TabsContent value="fields" className="h-full min-h-0 m-0">
//             <FieldsPane store={store} fieldTypes={fieldTypes} className="h-full" />
//           </TabsContent>

//           <TabsContent value="config" className="h-full min-h-0 m-0">
//             <PropertiesPane store={store} className="h-full" />
//           </TabsContent>
//         </div>

//         {/* subtle hint row */}
//         <div className="mt-2 text-[11px] text-slate-500">
//           {selectedSectionRid ? "Section selected" : "Select a section"} · {selectedItemRid ? "Field selected" : "Select a field"}
//         </div>
//       </Tabs>
//     </div>
//   )
// })

/* -------------------------------------------------------------------------- */
/*                               SECTIONS PANE                                */
/* -------------------------------------------------------------------------- */

// const SectionsPane = memo(function SectionsPane({ store, className }) {
//   const dragRef = useRef(null) // { kind:'section', fromIdx:number }

//   // IMPORTANT: subscribe only to what this pane needs
//   const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)

//   // array of primitive strings => stable via shallowSliceEqual caching
//   const sectionRows = store.useStore(
//     (s) =>
//       (s.schema?.sections || []).map((sec) => {
//         const rid = sec?._rid || ""
//         const code = safeStr(sec?.code || "SECTION")
//         const label = safeStr(sec?.label || "")
//         return `${rid}::${code}::${label}`
//       }),
//     shallowSliceEqual
//   )

//   function selectSection(sectionRid) {
//     store.setState((prev) => ({
//       ...prev,
//       selectedSectionRid: sectionRid,
//       selectedItemRid: null,
//       selectedGroupParentRid: null,
//     }))
//   }

//   function addSection() {
//     store.setState((prev) => {
//       const base = prev.schema
//       const next = { ...base, sections: [...(base.sections || []), mkDefaultSection("NEW_SECTION")] }
//       const lastRid = next.sections[next.sections.length - 1]?._rid || null
//       return { ...prev, schema: next, selectedSectionRid: lastRid, selectedItemRid: null, selectedGroupParentRid: null }
//     })
//   }

//   function deleteSection(sectionRid) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const nextSections = (base.sections || []).filter((s) => s?._rid !== sectionRid)
//       const next = { ...base, sections: nextSections }
//       const first = nextSections[0]?._rid || null
//       return { ...prev, schema: next, selectedSectionRid: first, selectedItemRid: null, selectedGroupParentRid: null }
//     })
//   }

//   function moveSectionByRid(sectionRid, dir) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const idx = secs.findIndex((s) => s?._rid === sectionRid)
//       if (idx < 0) return prev
//       const to = idx + dir
//       if (to < 0 || to >= secs.length) return prev
//       return { ...prev, schema: { ...base, sections: moveItem(secs, idx, to) } }
//     })
//   }

//   function onSectionDragStart(fromIdx) {
//     dragRef.current = { kind: "section", fromIdx }
//   }

//   function onSectionDrop(toIdx) {
//     const d = dragRef.current
//     if (!d || d.kind !== "section") return
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       return { ...prev, schema: { ...base, sections: moveItem(secs, d.fromIdx, toIdx) } }
//     })
//     dragRef.current = null
//   }

//   return (
//     <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col", className)}>
//       <CardHeader className="pb-3">
//         <div className="flex items-center justify-between gap-2">
//           <div className="min-w-0">
//             <CardTitle className="text-base">Sections</CardTitle>
//             <CardDescription className="truncate">Vitals, History, Orders…</CardDescription>
//           </div>
//           <Button size="icon" className="h-9 w-9 rounded-2xl" onClick={addSection} type="button">
//             <Plus className="h-4 w-4" />
//           </Button>
//         </div>
//       </CardHeader>

//       <CardContent className="flex-1 min-h-0 p-3 pt-0">
//         <ScrollArea className="h-full">
//           <div className="space-y-2 pr-2">
//             {sectionRows.map((rowStr, idx) => {
//               const { rid, code, label } = parseRow(rowStr)
//               const title = label?.trim() ? label : "Untitled Section"
//               const subtitle = code?.trim() ? code : "SECTION"

//               return (
//                 <div
//                   key={rid}
//                   draggable
//                   onDragStart={() => onSectionDragStart(idx)}
//                   onDragOver={(e) => e.preventDefault()}
//                   onDrop={() => onSectionDrop(idx)}
//                 >
//                   <SectionRow
//                     title={title}
//                     subtitle={subtitle} // if your SectionRow doesn't support subtitle, remove this prop
//                     active={rid === selectedSectionRid}
//                     onClick={() => selectSection(rid)}
//                     onMoveUp={() => moveSectionByRid(rid, -1)}
//                     onMoveDown={() => moveSectionByRid(rid, +1)}
//                     onDelete={() => deleteSection(rid)}
//                     draggableProps={{}}
//                   />
//                 </div>
//               )
//             })}

//             {!sectionRows.length ? (
//               <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
//                 Add a section to begin (e.g., Vitals, Assessment, Plan).
//               </div>
//             ) : null}
//           </div>
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   )
// })

/* -------------------------------------------------------------------------- */
/*                                FIELDS PANE                                 */
// /* -------------------------------------------------------------------------- */

// const FieldsPane = memo(function FieldsPane({ store, fieldTypes, className }) {
//   const dragRef = useRef(null) // { kind:'item', fromIdx:number, sectionRid:string }
//   const [fieldPicker, setFieldPicker] = useState(() => (Array.isArray(fieldTypes) && fieldTypes[0]) || "text")

//   const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)
//   const selectedItemRid = store.useStore((s) => s.selectedItemRid || null, Object.is)

//   const selectedSectionTitle = store.useStore((s) => {
//     const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
//     if (!sec) return ""
//     return safeStr(sec?.label || "") || "Untitled Section"
//   }, Object.is)

//   // items list rows (primitive strings -> stable)
//   const itemRows = store.useStore(
//     (s) => {
//       const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
//       const items = sec?.items || []
//       return items.map((it) => {
//         const kind = String(it?.kind || "field")
//         const type = kind === "block" ? "block" : String(it?.type || "text")
//         const title =
//           kind === "block"
//             ? `Reusable Block · ${safeStr(it?.block_code || "BLOCK")}`
//             : `${labelForFieldType(type)} · ${safeStr(it?.label || it?.key || "Field")}`

//         const hint = safeStr(it?.ui?.hint || it?.help_text || "")
//         const childCount = String(it?.type || "") === "group" && Array.isArray(it?.items) ? it.items.length : 0
//         return `${it?._rid || ""}::${kind}::${type}::${title}::${hint}::${childCount}`
//       })
//     },
//     shallowSliceEqual
//   )

//   // flatten group children for quick list (primitive strings -> stable)
//   const groupChildRows = store.useStore(
//     (s) => {
//       const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
//       const items = sec?.items || []
//       const out = []
//       for (const it of items) {
//         if (String(it?.type || "") !== "group") continue
//         const parentRid = it?._rid || ""
//         const kids = Array.isArray(it?.items) ? it.items : []
//         for (const c of kids) {
//           const rid = c?._rid || ""
//           const type = String(c?.type || "text")
//           const title = `${labelForFieldType(type)} · ${safeStr(c?.label || c?.key || "Field")}`
//           out.push(`${parentRid}::${rid}::${type}::${title}`)
//         }
//       }
//       return out
//     },
//     shallowSliceEqual
//   )

//   const groupMap = useMemo(() => {
//     const m = new Map()
//     for (const row of groupChildRows) {
//       const [parentRid, rid, type, title] = String(row).split("::")
//       if (!m.has(parentRid)) m.set(parentRid, [])
//       m.get(parentRid).push({ rid, type, title })
//     }
//     return m
//   }, [groupChildRows])

//   function selectItem(sectionRid, itemRid, parentRid = null) {
//     store.setState((prev) => ({
//       ...prev,
//       selectedSectionRid: sectionRid,
//       selectedItemRid: itemRid,
//       selectedGroupParentRid: parentRid,
//     }))
//   }

//   function addFieldToSelectedSection() {
//     if (!selectedSectionRid) return toast.error("Select a section first")
//     const t = String(fieldPicker || "text")
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
//       if (sidx < 0) return prev

//       const sec = secs[sidx]
//       const items = [...(sec.items || []), mkDefaultField(t)]
//       secs[sidx] = { ...sec, items }

//       const newItem = items[items.length - 1]
//       return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: newItem._rid, selectedGroupParentRid: null }
//     })
//   }

//   function deleteItem(sectionRid, itemRid, parentRid = null) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const sidx = secs.findIndex((s) => s?._rid === sectionRid)
//       if (sidx < 0) return prev
//       const sec = secs[sidx]
//       const items = [...(sec.items || [])]

//       if (parentRid) {
//         const pidx = items.findIndex((x) => x?._rid === parentRid)
//         if (pidx < 0) return prev
//         const parent = items[pidx]
//         const nextKids = (parent?.items || []).filter((c) => c?._rid !== itemRid)
//         items[pidx] = { ...parent, items: nextKids }
//         secs[sidx] = { ...sec, items }
//         return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: null, selectedGroupParentRid: null }
//       }

//       const nextItems = items.filter((x) => x?._rid !== itemRid)
//       secs[sidx] = { ...sec, items: nextItems }
//       return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: null, selectedGroupParentRid: null }
//     })
//   }

//   function moveItemWithinSection(sectionRid, itemRid, dir) {
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const sidx = secs.findIndex((s) => s?._rid === sectionRid)
//       if (sidx < 0) return prev
//       const sec = secs[sidx]
//       const items = [...(sec.items || [])]
//       const idx = items.findIndex((x) => x?._rid === itemRid)
//       const to = idx + dir
//       if (idx < 0 || to < 0 || to >= items.length) return prev
//       secs[sidx] = { ...sec, items: moveItem(items, idx, to) }
//       return { ...prev, schema: { ...base, sections: secs } }
//     })
//   }

//   function onItemDragStart(sectionRid, fromIdx) {
//     dragRef.current = { kind: "item", sectionRid, fromIdx }
//   }

//   function onItemDrop(sectionRid, toIdx) {
//     const d = dragRef.current
//     if (!d || d.kind !== "item") return
//     if (d.sectionRid !== sectionRid) return
//     store.setState((prev) => {
//       const base = prev.schema
//       const secs = [...(base.sections || [])]
//       const sidx = secs.findIndex((s) => s?._rid === sectionRid)
//       if (sidx < 0) return prev
//       const sec = secs[sidx]
//       const items = [...(sec.items || [])]
//       secs[sidx] = { ...sec, items: moveItem(items, d.fromIdx, toIdx) }
//       return { ...prev, schema: { ...base, sections: secs } }
//     })
//     dragRef.current = null
//   }

//   return (
//     <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col", className)}>
//       <CardHeader className="pb-3">
//         <div className="flex flex-wrap items-center justify-between gap-2">
//           <div className="min-w-0">
//             <CardTitle className="text-base">Fields</CardTitle>
//             <CardDescription className="truncate">
//               {selectedSectionRid ? `In: ${selectedSectionTitle}` : "Select a section"}
//             </CardDescription>
//           </div>

//           <div className="flex items-center gap-2">
//             <Select value={fieldPicker} onValueChange={setFieldPicker}>
//               <SelectTrigger className="h-10 w-[200px] rounded-2xl">
//                 <SelectValue />
//               </SelectTrigger>
//               <SelectContent className="max-h-[280px]">
//                 {(fieldTypes || []).map((t) => (
//                   <SelectItem key={t} value={t}>
//                     {labelForFieldType(t)}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Button className="h-10 rounded-2xl" onClick={addFieldToSelectedSection} disabled={!selectedSectionRid} type="button">
//               <Plus className="mr-2 h-4 w-4" />
//               Add
//             </Button>
//           </div>
//         </div>
//       </CardHeader>

//       <CardContent className="flex-1 min-h-0 p-3 pt-0">
//         <ScrollArea className="h-full">
//           <div className="space-y-2 pr-2">
//             {!selectedSectionRid ? (
//               <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
//                 Select a section on the left to add fields.
//               </div>
//             ) : null}

//             {selectedSectionRid && !itemRows.length ? (
//               <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
//                 Add fields like Vitals, Diagnosis, Medications, Scores, Charts…
//               </div>
//             ) : null}

//             {selectedSectionRid
//               ? itemRows.map((rowStr, idx) => {
//                 const it = parseItemRow(rowStr)
//                 const hint = safeStr(it.hint || "")

//                 return (
//                   <div
//                     key={it.rid}
//                     draggable
//                     onDragStart={() => onItemDragStart(selectedSectionRid, idx)}
//                     onDragOver={(e) => e.preventDefault()}
//                     onDrop={() => onItemDrop(selectedSectionRid, idx)}
//                   >
//                     <ItemRow
//                       title={it.title}
//                       meta={{ type: it.type, hint }}
//                       active={it.rid === selectedItemRid}
//                       onClick={() => selectItem(selectedSectionRid, it.rid, null)}
//                       onMoveUp={() => moveItemWithinSection(selectedSectionRid, it.rid, -1)}
//                       onMoveDown={() => moveItemWithinSection(selectedSectionRid, it.rid, +1)}
//                       onDelete={() => deleteItem(selectedSectionRid, it.rid, null)}
//                       draggableProps={{}}
//                     />

//                     {/* group children quick list */}
//                     {String(it.type || "") === "group" && groupMap.get(it.rid)?.length ? (
//                       <div className="ml-8 mt-2 space-y-2">
//                         {groupMap.get(it.rid).map((c) => (
//                           <div key={c.rid} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
//                             <div className="min-w-0">
//                               <div className="truncate text-xs font-semibold text-slate-900">{c.title}</div>
//                             </div>
//                             <div className="flex gap-2">
//                               <Button
//                                 size="icon"
//                                 variant="ghost"
//                                 className="h-8 w-8 rounded-xl"
//                                 onClick={() => selectItem(selectedSectionRid, c.rid, it.rid)}
//                                 type="button"
//                               >
//                                 <Settings className="h-4 w-4" />
//                               </Button>
//                               <Button
//                                 size="icon"
//                                 variant="ghost"
//                                 className="h-8 w-8 rounded-xl text-rose-600"
//                                 onClick={() => deleteItem(selectedSectionRid, c.rid, it.rid)}
//                                 type="button"
//                               >
//                                 <Trash2 className="h-4 w-4" />
//                               </Button>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     ) : null}
//                   </div>
//                 )
//               })
//               : null}
//           </div>
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   )
// })

// /* -------------------------------------------------------------------------- */
// /*                              PROPERTIES PANE                               */
// /* -------------------------------------------------------------------------- */

// const PropertiesPane = memo(function PropertiesPane({ store, className }) {
//   return (
//     <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col overflow-hidden", className)}>
//       <CardHeader className="pb-3">
//         <CardTitle className="text-base">Configure</CardTitle>
//         <CardDescription>Labels, options, rules (clinician-friendly)</CardDescription>
//       </CardHeader>
//       <CardContent className="flex-1 min-h-0 p-0">
//         {/* IMPORTANT: PropertiesPanel should internally handle its own ScrollArea or overflow */}
//         <div className="h-full min-h-0">
//           <PropertiesPanel store={store} />
//         </div>
//       </CardContent>
//     </Card>
//   )
// })

/* -------------------------------- Setup Panel ---------------------------- */

const SetupPanel = memo(function SetupPanel({
  store,
  departments,
  types,
  loadingMeta,
  onContinue,
  onOpenMasters,
}) {
  const meta = store.useStore(
    (s) => ({
      name: s.name,
      deptCode: s.deptCode,
      typeCode: s.typeCode,
      description: s.description,
      tagsText: s.tagsText,
      isActive: s.isActive,
    }),
    shallowSliceEqual
  )

  function patch(p) {
    store.setState((prev) => ({ ...prev, ...p }))
  }

  const canContinue = meta.name.trim() && meta.deptCode && meta.typeCode

  return (
    // IMPORTANT: min-h-0 enables ScrollArea scrolling inside flex/height-constrained parents
    <div className="h-full min-h-0">
      <ScrollArea className="h-full">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
          {/* Header */}
          <div className="mb-5 md:mb-6">
            <div className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
              Template Setup
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Only the essentials: Name, Department, Record Type.
            </div>
          </div>

          {/* Layout:
              - Mobile: stack (Optional Notes first, Basics second)
              - Desktop/Tablet: two columns (Optional Notes LEFT, Basics RIGHT)
          */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
            {/* LEFT: Optional Notes */}
            <Card className="rounded-3xl border-slate-200 lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">
                  Optional Notes
                </CardTitle>
                <CardDescription>
                  Helps teams discover the template
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    className="min-h-[140px] md:min-h-[180px] rounded-2xl"
                    value={meta.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Brief usage guidance…"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    className="h-11 md:h-12 rounded-2xl"
                    value={meta.tagsText}
                    onChange={(e) => patch({ tagsText: e.target.value })}
                    placeholder="OPD, SOAP, Doctor"
                  />
                </div>

                {/* Nice quick helper */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Tip: Tags improve search and template recommendations.
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Basics */}
            <Card className="rounded-3xl border-slate-200 lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Basics</CardTitle>
                <CardDescription>
                  Required for validation and template scope
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    Template Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    className="h-11 md:h-12 rounded-2xl"
                    value={meta.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="e.g., OPD Consultation Note"
                  />
                </div>

                {/* Department + Record Type */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Department <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={meta.deptCode || ""}
                      onValueChange={(v) => patch({ deptCode: v })}
                      disabled={loadingMeta}
                    >
                      <SelectTrigger className="h-11 md:h-12 rounded-2xl">
                        <SelectValue
                          placeholder={loadingMeta ? "Loading..." : "Select department"}
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {(departments || []).map((d) => (
                          <SelectItem
                            key={d.id || d.code}
                            value={String(d.code || "")}
                          >
                            {d.code} · {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Record Type <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={meta.typeCode || ""}
                      onValueChange={(v) => patch({ typeCode: v })}
                      disabled={loadingMeta}
                    >
                      <SelectTrigger className="h-11 md:h-12 rounded-2xl">
                        <SelectValue
                          placeholder={loadingMeta ? "Loading..." : "Select record type"}
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {(types || []).map((t) => (
                          <SelectItem
                            key={t.id || t.code}
                            value={String(t.code || "")}
                          >
                            {t.code} · {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Active switch */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      Active
                    </div>
                    <div className="text-xs text-slate-500">
                      Available to users
                    </div>
                  </div>
                  <Switch
                    checked={!!meta.isActive}
                    onCheckedChange={(v) => patch({ isActive: !!v })}
                  />
                </div>

                {/* Actions: sticky on mobile inside card (nice UX) */}
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={onOpenMasters}
                    type="button"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Masters
                  </Button>

                  <Button
                    className="rounded-2xl"
                    onClick={onContinue}
                    disabled={!canContinue}
                    type="button"
                  >
                    Continue to Builder
                  </Button>
                </div>

                {!canContinue ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Fill <b>Template Name</b>, <b>Department</b>, and <b>Record Type</b> to continue.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Extra bottom padding so last card never gets clipped on iOS */}
          <div className="h-6" />
        </div>
      </ScrollArea>
    </div>
  )
})


/* -------------------------------- Main Dialog ---------------------------- */

export default function TemplateEditorDialog({ open, onOpenChange, mode = "create", template = null, onSaved }) {
  const isEdit = mode === "edit"
  const isNewVersion = mode === "new_version"

  const abortRef = useRef(null)

  // Bootstrap/meta
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [busy, setBusy] = useState(false)
  const [departments, setDepartments] = useState([])
  const [types, setTypes] = useState([])
  const [presets, setPresets] = useState(null)
  const [builderMeta, setBuilderMeta] = useState(null)

  const storeRef = useRef(null)
  if (!storeRef.current) storeRef.current = createTemplateBuilderStore(createInitialStoreState())
  const store = storeRef.current

  const step = store.useStore((s) => s.step)
  const schema = store.useStore((s) => s.schema)
  const meta = store.useStore(
    (s) => ({ name: s.name, deptCode: s.deptCode, typeCode: s.typeCode, description: s.description, tagsText: s.tagsText, isActive: s.isActive }),
    shallowSliceEqual
  )

  const fieldTypes = useMemo(() => pickFieldTypes(builderMeta, presets), [builderMeta, presets])

  function resetFromTemplate(tpl) {
    const t = tpl || null
    const rawSchema = t?.schema_json || t?.schema || t?.latest_version?.schema_json || null
    const sObj = ensureUiIds(ensureSchemaShape(rawSchema || { schema_version: 1, sections: [] }))

    store.setState((prev) => ({
      ...prev,
      name: t?.name || "",
      deptCode: normCode(t?.dept_code || t?.deptCode || ""),
      typeCode: normCode(t?.record_type_code || t?.type_code || t?.recordTypeCode || ""),
      description: t?.description || "",
      isActive: t?.is_active ?? true,
      tagsText: Array.isArray(t?.tags) ? t.tags.join(", ") : t?.tags_text || "",
      schema: sObj,
      step: "setup",
      selectedSectionRid: sObj.sections?.[0]?._rid || null,
      selectedItemRid: null,
      selectedGroupParentRid: null,
    }))
  }

  async function loadMeta(signal) {
    setLoadingMeta(true)
    try {
      const boot = await emrTemplatesClient.bootstrap(false, signal)
      setDepartments(Array.isArray(boot?.departments) ? boot.departments : [])
      setTypes(Array.isArray(boot?.record_types) ? boot.record_types : [])
    } catch (e) {
      // fallback
      try {
        const [ds, ts] = await Promise.all([
          emrTemplatesClient.departmentsList({ active: false }, signal),
          emrTemplatesClient.recordTypesList({ active: false }, signal),
        ])
        setDepartments(Array.isArray(ds) ? ds : [])
        setTypes(Array.isArray(ts) ? ts : [])
      } catch (e2) {
        toast.error(e2?.message || "Failed to load master data")
      }
    } finally {
      setLoadingMeta(false)
    }
  }

  async function loadPresetsAndMeta(deptCode, typeCode, signal) {
    if (!deptCode || !typeCode) return
    try {
      const p = await emrTemplatesClient.presets({ dept_code: deptCode, record_type_code: typeCode }, signal)
      setPresets(p || null)
    } catch {
      setPresets(null)
    }
    try {
      const m = await emrTemplatesClient.builderMeta({ dept_code: deptCode, record_type_code: typeCode }, signal)
      setBuilderMeta(m || null)
    } catch {
      setBuilderMeta(null)
    }
  }

  useEffect(() => {
    if (!open) return
    abortRef.current?.abort?.()
    abortRef.current = new AbortController()
    loadMeta(abortRef.current.signal)
    resetFromTemplate(template)
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!meta.deptCode || !meta.typeCode) return
    loadPresetsAndMeta(meta.deptCode, meta.typeCode, abortRef.current?.signal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meta.deptCode, meta.typeCode])

  function goBuilder() {
    if (!meta.name.trim()) return toast.error("Template name is required")
    if (!meta.deptCode) return toast.error("Department is required")
    if (!meta.typeCode) return toast.error("Record Type is required")

    store.setState((prev) => {
      const firstSec = prev.schema.sections?.[0]?._rid || null
      return { ...prev, step: "build", selectedSectionRid: prev.selectedSectionRid || firstSec }
    })
  }

  function goPreview() {
    store.setState((prev) => ({ ...prev, step: "preview" }))
  }

  function goMasters() {
    store.setState((prev) => ({ ...prev, step: "masters" }))
  }

  async function validateAndNormalize(schemaObj) {
    const basePayload = {
      dept_code: meta.deptCode,
      record_type_code: meta.typeCode,
      schema_json: stripUiFields(ensureSchemaShape(schemaObj)),
      sections: derivedSectionsFromSchema(schemaObj),
    }

    // normalize (optional server support)
    let normalized = basePayload.schema_json
    try {
      const normRes = await emrTemplatesClient.normalizeSchema(basePayload, abortRef.current?.signal)
      if (normRes?.schema_json) normalized = normRes.schema_json
      else if (normRes?.schema) normalized = normRes.schema
    } catch {
      // ignore
    }

    // validate
    const validateRes = await emrTemplatesClient.validateSchema({ ...basePayload, schema_json: normalized }, abortRef.current?.signal)
    return { validateRes, normSchema: normalized, sections: validateRes?.sections || derivedSectionsFromSchema(normalized) }
  }

  async function saveTemplate() {
    if (!meta.name.trim()) return toast.error("Template name is required")
    if (!meta.deptCode) return toast.error("Department is required")
    if (!meta.typeCode) return toast.error("Record Type is required")

    setBusy(true)
    try {
      const { normSchema, sections } = await validateAndNormalize(schema)

      const tags = (meta.tagsText || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      let result = null

      if (isNewVersion && template?.id) {
        // new version only
        result = await emrTemplatesClient.templateCreateVersion(
          template.id,
          { schema_json: normSchema, sections, publish: false },
          abortRef.current?.signal
        )
      } else if (isEdit && template?.id) {
        /**
         * IMPORTANT API alignment:
         * - PUT /emr/templates/{id} expects TemplateUpdateIn (partial meta only)
         * - Schema changes must go via POST /versions (TemplateVersionCreateIn)
         *   (supports keep_same_version flag if you want "edit current draft" behavior)
         */
        await emrTemplatesClient.templateUpdateMeta(
          template.id,
          {
            name: meta.name.trim(),
            description: meta.description?.trim() || null,
            restricted: !!template?.restricted,
            premium: !!template?.premium,
            is_default: !!template?.is_default,
          },
          abortRef.current?.signal
        )

        result = await emrTemplatesClient.templateCreateVersion(
          template.id,
          { schema_json: normSchema, sections, publish: false, keep_same_version: true },
          abortRef.current?.signal
        )
      } else {
        // create template (TemplateCreateIn accepts dept_code/type_code via populate_by_name)
        result = await emrTemplatesClient.templateCreate(
          {
            name: meta.name.trim(),
            dept_code: meta.deptCode,
            record_type_code: meta.typeCode,
            description: meta.description?.trim() || null,
            tags,
            is_active: !!meta.isActive,
            schema_json: normSchema,
            sections,
            publish: false,
          },
          abortRef.current?.signal
        )
      }

      toast.success("Template saved")
      onSaved?.(result)
      onOpenChange?.(false)
    } catch (e) {
      toast.error(e?.message || "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function refreshMeta() {
    await loadMeta(abortRef.current?.signal)
  }

  const headerTitle = useMemo(() => {
    if (isEdit) return "Edit Template"
    if (isNewVersion) return "Create New Version"
    return "Create Template"
  }, [isEdit, isNewVersion])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-none overflow-hidden rounded-[28px] border-slate-200 p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-slate-900">{headerTitle}</div>
            <div className="truncate text-xs text-slate-500">
              {meta.deptCode && meta.typeCode ? (
                <>
                  <span className="font-mono">{meta.deptCode}</span> · <span className="font-mono">{meta.typeCode}</span>
                </>
              ) : (
                "Setup required"
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={goMasters} disabled={busy}>
              <Settings className="mr-2 h-4 w-4" />
              Masters
            </Button>

            <Button variant="outline" className="rounded-2xl" onClick={goPreview} disabled={busy}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>

            <Button className="rounded-2xl" onClick={saveTemplate} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>

            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Top navigation */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 md:px-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={step === "setup" ? "default" : "outline"}
              className="rounded-2xl"
              onClick={() => store.setState((p) => ({ ...p, step: "setup" }))}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Setup
            </Button>

            <Button
              variant={step === "build" ? "default" : "outline"}
              className="rounded-2xl"
              onClick={() => store.setState((p) => ({ ...p, step: "build" }))}
              disabled={!meta.name.trim() || !meta.deptCode || !meta.typeCode}
            >
              <Layers className="mr-2 h-4 w-4" />
              Builder
            </Button>

            <Button variant={step === "preview" ? "default" : "outline"} className="rounded-2xl" onClick={goPreview}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Preview
            </Button>

            <Button variant={step === "masters" ? "default" : "outline"} className="rounded-2xl" onClick={goMasters}>
              <Settings className="mr-2 h-4 w-4" />
              Masters
            </Button>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              <Badge variant="secondary" className="rounded-xl">
                Fields: {(schema.sections || []).reduce((a, s) => a + (s.items?.length || 0), 0)}
              </Badge>
              <Badge variant="secondary" className="rounded-xl">
                Sections: {(schema.sections || []).length}
              </Badge>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-110px)] min-h-0 bg-slate-50">
          {step === "setup" ? (
            <SetupPanel
              store={store}
              departments={departments}
              types={types}
              loadingMeta={loadingMeta}
              onContinue={goBuilder}
              onOpenMasters={goMasters}
            />
          ) : null}

          {step === "build" ? <BuilderPanel store={store} fieldTypes={fieldTypes} /> : null}

          {step === "preview" ? <PreviewPanel schema={schema} /> : null}

          {step === "masters" ? <MastersPanel onRefreshMeta={refreshMeta} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
