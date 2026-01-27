// FILE: frontend/src/emr/templates/BuilderPanel.jsx
import React, { memo, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    Plus,
    Trash2,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Settings,
    Wand2,
    ListPlus,
    Table2,
    ShieldCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

import {
    genRid,
    mkDefaultSection,
    mkDefaultField,
    moveItem,
    normCode,
    normKey,
    shallowSliceEqual,
} from "./templateBuilderStore"

/* -------------------------------------------------------------------------- */
/*                               UI LABEL MAPS                                */
/* -------------------------------------------------------------------------- */

const FIELD_LABELS = {
    text: "Short Text",
    textarea: "Long Note",
    number: "Number / Measurement",
    date: "Date",
    time: "Time",
    datetime: "Date & Time",
    boolean: "Yes / No",
    select: "Dropdown",
    multiselect: "Checklist",
    radio: "Single Choice",
    chips: "Tags / Names",
    table: "Table (Rows)",
    group: "Conditional Group",
    signature: "Signature",
    file: "File Attachment",
    image: "Image Attachment",
    calculation: "Auto Calculation",
    chart: "Graph / Trend",
    graph: "Graph / Trend",
}

function labelForFieldType(type) {
    const t = String(type || "").toLowerCase()
    return FIELD_LABELS[t] || (t ? t[0].toUpperCase() + t.slice(1) : "Field")
}

function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v)
}

/* -------------------------------------------------------------------------- */
/*                         SCHEMA SELECTORS / HELPERS                          */
/* -------------------------------------------------------------------------- */

function selectSectionByRid(schema, sectionRid) {
    const secs = schema?.sections || []
    return secs.find((s) => s?._rid === sectionRid) || null
}

function walkItems(items, fn) {
    const arr = Array.isArray(items) ? items : []
    for (const it of arr) {
        fn(it, null)
        if (String(it?.type || "") === "group" && Array.isArray(it?.items)) {
            for (const c of it.items) fn(c, it)
        }
    }
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

const uid = () =>
(globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(16).slice(2)}`)

function uniqueKey(base, takenSet) {
    let k = normCode(base || "field")
    if (!takenSet.has(k)) return k
    let i = 2
    while (takenSet.has(`${k}_${i}`)) i++
    return `${k}_${i}`
}

function getSectionAndIndexByUiId(schema, uiId) {
    for (let si = 0; si < (schema.sections || []).length; si++) {
        const items = schema.sections[si]?.items || []
        const idx = items.findIndex((it) => it?.ui_id === uiId)
        if (idx >= 0) return { si, idx }
    }
    return null
}

function getChildren(items, groupKey) {
    return (items || []).filter((it) => it?.parent_key === groupKey)
}

function removeItemAndChildren(sectionItems, uiId) {
    const target = sectionItems.find((x) => x?.ui_id === uiId)
    if (!target) return sectionItems

    // if removing a group => remove its children too
    if (target.type === "group") {
        const gk = target.key
        return sectionItems.filter((it) => it?.ui_id !== uiId && it?.parent_key !== gk)
    }

    // removing a normal child/field
    return sectionItems.filter((it) => it?.ui_id !== uiId)
}

// Moves a child up/down among siblings by swapping positions in the flat array
function moveChild(sectionItems, groupKey, childUiId, dir /* -1 | +1 */) {
    const idxs = []
    for (let i = 0; i < sectionItems.length; i++) {
        if (sectionItems[i]?.parent_key === groupKey) idxs.push(i)
    }
    const curPos = idxs.findIndex((i) => sectionItems[i]?.ui_id === childUiId)
    if (curPos < 0) return sectionItems

    const nextPos = curPos + dir
    if (nextPos < 0 || nextPos >= idxs.length) return sectionItems

    const a = idxs[curPos]
    const b = idxs[nextPos]
    const copy = sectionItems.slice()
        ;[copy[a], copy[b]] = [copy[b], copy[a]]
    return copy
}

/* -------------------------------------------------------------------------- */
/*                         CLINICAL QUICK PACKS (NEW)                          */
/* -------------------------------------------------------------------------- */
/**
 * Clinician-friendly “Quick Add” packs that insert structured sections/fields.
 * Stored as normal schema objects; backend can validate/normalize as usual.
 */

function mkField(type, patch = {}) {
    const f = mkDefaultField(type)
    return { ...f, ...patch }
}

function mkSelectField({ key, label, help_text, options = [] }) {
    const f = mkField("select", {
        key: normKey(key),
        label,
        help_text: help_text || "",
        options: (options || []).map((o) => ({ value: normKey(o.value || o), label: safeStr(o.label || o) })),
    })
    return f
}

function mkRadioField({ key, label, help_text, options = [] }) {
    const f = mkField("radio", {
        key: normKey(key),
        label,
        help_text: help_text || "",
        options: (options || []).map((o) => ({ value: normKey(o.value || o), label: safeStr(o.label || o) })),
        choice: { display: "RADIO", orientation: "HORIZONTAL" },
    })
    return f
}

function mkTableField({ key, label, help_text, columns = [], allow_add_row = true, allow_delete_row = true }) {
    const f = mkField("table", {
        key: normKey(key),
        label,
        help_text: help_text || "",
        table: {
            min_rows: 0,
            max_rows: 0,
            allow_add_row: !!allow_add_row,
            allow_delete_row: !!allow_delete_row,
            columns: (columns || []).map((c) => {
                const colType = String(c.type || "text").toLowerCase()
                const col = {
                    _rid: genRid(),
                    key: normKey(c.key || c.label || "column"),
                    label: safeStr(c.label || "Column"),
                    type: colType,
                    required: !!c.required,
                }
                if (["select", "radio"].includes(colType)) {
                    col.options = (c.options || []).map((o) => ({ value: normKey(o.value || o), label: safeStr(o.label || o) }))
                }
                return col
            }),
        },
    })
    return f
}

function mkGroupField({ key, label, help_text, visible_when, layout = "STACK", items = [] }) {
    const f = mkField("group", {
        key: normKey(key),
        label,
        help_text: help_text || "",
        group: { layout, collapsible: false, collapsed_by_default: false },
        items,
        rules: {
            ...(items?.rules || {}),
            ...(visible_when ? { visible_when } : {}),
        },
    })
    return f
}

function upsertSection(baseSchema, { code, label }) {
    const schema = baseSchema || { schema_version: 1, sections: [] }
    const secs = [...(schema.sections || [])]
    const wantCode = normCode(code)
    let idx = secs.findIndex((s) => normCode(s?.code) === wantCode)
    if (idx < 0) {
        const sec = mkDefaultSection(wantCode)
        sec.label = safeStr(label || "")
        secs.push(sec)
        idx = secs.length - 1
    } else {
        secs[idx] = { ...secs[idx], code: wantCode, label: safeStr(label || secs[idx]?.label || "") }
    }
    return { schema: { ...schema, sections: secs }, sectionRid: secs[idx]?._rid || null, sectionIndex: idx }
}

function appendFieldsToSection(schema, sectionRid, fields) {
    const secs = [...(schema.sections || [])]
    const sidx = secs.findIndex((s) => s?._rid === sectionRid)
    if (sidx < 0) return schema
    const sec = secs[sidx]
    const items = [...(sec.items || []), ...(fields || [])]
    secs[sidx] = { ...sec, items }
    return { ...schema, sections: secs }
}

const CLINICAL_PACKS = [
    {
        id: "implant_details",
        label: "Implant Details (Audit-safe)",
        icon: Table2,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "IMPLANT_DETAILS", label: "Implant Details" })

            const implantTable = mkTableField({
                key: "implant_used",
                label: "Implant Used",
                help_text: "Record all implants used during the procedure for traceability and audit.",
                columns: [
                    { key: "implant_name", label: "Implant Name", type: "text" },
                    { key: "manufacturer", label: "Manufacturer", type: "text" },
                    { key: "size_length", label: "Size / Length", type: "text" },
                    { key: "side", label: "Side", type: "select", options: ["Left", "Right", "Bilateral"] },
                    { key: "serial_batch_no", label: "Serial / Batch No", type: "text" },
                    { key: "quantity", label: "Quantity", type: "number" },
                ],
            })

            const cementUsed = mkField("boolean", {
                key: "cement_used",
                label: "Bone Cement Used",
                help_text: "Indicate whether bone cement was used.",
                default_value: false,
            })

            const cementDetails = mkGroupField({
                key: "cement_details",
                label: "Cement Details",
                help_text: "Fill only if cement was used.",
                visible_when: { op: "eq", field_key: "cement_used", value: true },
                layout: "GRID_2",
                items: [
                    mkField("text", { key: "cement_brand", label: "Cement Brand" }),
                    mkField("boolean", { key: "antibiotic_mixed", label: "Antibiotic Mixed", default_value: false }),
                    mkField("text", {
                        key: "antibiotic_name",
                        label: "Antibiotic Name",
                        rules: { visible_when: { op: "eq", field_key: "antibiotic_mixed", value: true } },
                    }),
                ],
            })

            const next = appendFieldsToSection(s1, sectionRid, [implantTable, cementUsed, cementDetails])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
    {
        id: "surgical_counts",
        label: "Surgical Count (OT Safety)",
        icon: ShieldCheck,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "COUNTS", label: "Counts" })

            const sponge = mkGroupField({
                key: "sponge_count",
                label: "Sponge / Gauze Count",
                help_text: "Record sponge counts as per OT protocol.",
                layout: "GRID_2",
                items: [
                    mkField("number", { key: "initial_count", label: "Initial Count", ui: { width: "HALF" } }),
                    mkField("number", { key: "final_count", label: "Final Count", ui: { width: "HALF" } }),
                    mkRadioField({
                        key: "count_status",
                        label: "Count Status",
                        options: ["Correct", "Incorrect"],
                    }),
                ],
            })

            const instrument = mkGroupField({
                key: "instrument_count",
                label: "Instrument Count",
                layout: "GRID_2",
                items: [
                    mkField("number", { key: "initial_count", label: "Initial Count", ui: { width: "HALF" } }),
                    mkField("number", { key: "final_count", label: "Final Count", ui: { width: "HALF" } }),
                    mkRadioField({
                        key: "count_status",
                        label: "Count Status",
                        options: ["Correct", "Incorrect"],
                    }),
                ],
            })

            const verifiedBy = mkField("chips", {
                key: "count_verified_by",
                label: "Verified By",
                help_text: "Names of OT staff who verified surgical counts (e.g., Scrub Nurse, Circulating Nurse).",
                choice: { allow_custom: true, display: "CHIPS" },
            })

            const next = appendFieldsToSection(s1, sectionRid, [sponge, instrument, verifiedBy])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
    {
        id: "blood_loss_transfusion",
        label: "Blood Loss & Transfusion",
        icon: ListPlus,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "BLOOD_LOSS", label: "Blood Loss" })

            const ebl = mkField("number", {
                key: "estimated_blood_loss_ml",
                label: "Estimated Blood Loss (ml)",
                help_text: "Enter estimated intraoperative blood loss in milliliters.",
                clinical: { unit: "ml" },
            })

            const transfusion = mkField("boolean", {
                key: "blood_transfusion_given",
                label: "Blood Transfusion Given",
                default_value: false,
            })

            const transfusionDetails = mkGroupField({
                key: "transfusion_details",
                label: "Transfusion Details",
                visible_when: { op: "eq", field_key: "blood_transfusion_given", value: true },
                layout: "GRID_2",
                items: [
                    mkSelectField({
                        key: "blood_product",
                        label: "Blood Product",
                        options: ["PRBC", "FFP", "Platelets", "Whole Blood"],
                    }),
                    mkField("number", { key: "units_given", label: "Units Given" }),
                    mkField("boolean", { key: "transfusion_reaction", label: "Transfusion Reaction", default_value: false }),
                ],
            })

            const next = appendFieldsToSection(s1, sectionRid, [ebl, transfusion, transfusionDetails])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
    {
        id: "tourniquet_details",
        label: "Tourniquet Details",
        icon: ListPlus,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "TOURNIQUET", label: "Tourniquet Details" })

            const used = mkField("boolean", { key: "tourniquet_used", label: "Used", default_value: false })
            const pressure = mkField("number", {
                key: "pressure_mmhg",
                label: "Pressure (mmHg)",
                clinical: { unit: "mmHg" },
                rules: { visible_when: { op: "eq", field_key: "tourniquet_used", value: true } },
            })
            const duration = mkField("number", {
                key: "duration_minutes",
                label: "Duration (minutes)",
                clinical: { unit: "minutes" },
                rules: { visible_when: { op: "eq", field_key: "tourniquet_used", value: true } },
            })

            const grp = mkGroupField({
                key: "tourniquet_group",
                label: "Tourniquet",
                layout: "GRID_2",
                items: [used, pressure, duration],
            })

            const next = appendFieldsToSection(s1, sectionRid, [grp])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
    {
        id: "drain_details",
        label: "Drain Details",
        icon: ListPlus,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "DRAIN", label: "Drain Details" })

            const drainUsed = mkField("boolean", { key: "drain_used", label: "Drain Used", default_value: false })

            const drainType = mkSelectField({
                key: "drain_type",
                label: "Drain Type",
                options: ["Romovac", "Suction", "Corrugated"],
            })
            drainType.rules = { visible_when: { op: "eq", field_key: "drain_used", value: true } }

            const drainCount = mkField("number", {
                key: "number_of_drains",
                label: "Number of Drains",
                rules: { visible_when: { op: "eq", field_key: "drain_used", value: true } },
            })

            const grp = mkGroupField({
                key: "drain_group",
                label: "Drain",
                layout: "GRID_2",
                items: [drainUsed, drainType, drainCount],
            })

            const next = appendFieldsToSection(s1, sectionRid, [grp])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
    {
        id: "surgeon_signature",
        label: "Surgeon Signature",
        icon: ShieldCheck,
        apply: (schema) => {
            const { schema: s1, sectionRid } = upsertSection(schema, { code: "SIGNATURES", label: "Signatures" })
            const sig = mkField("signature", {
                key: "operating_surgeon_signature",
                label: "Operating Surgeon Signature",
                help_text: "Digital signature of operating surgeon.",
                signature: { signer_role: "DOCTOR", capture_mode: "DRAW", watermark: true },
            })
            const next = appendFieldsToSection(s1, sectionRid, [sig])
            return { schema: next, focusSectionRid: sectionRid }
        },
    },
]

function addFieldToGroup(groupUiId, { type, label = "Value" }) {
    setSchema((prev) => {
        const loc = getSectionAndIndexByUiId(prev, groupUiId)
        if (!loc) return prev

        const sec = prev.sections[loc.si]
        const items = sec.items || []
        const group = items[loc.idx]
        if (!group?.key) return prev

        const taken = new Set(items.map((x) => x?.key).filter(Boolean))
        const newUiId = uid()

        const newItem = {
            kind: "field",
            type,
            ui_id: newUiId,
            label,
            key: uniqueKey(`${group.key}_${type}`, taken),
            rules: {},
            parent_key: group.key,
            default_value: null,
        }

        // insert after last existing child of this group (keeps nice grouping in flat array)
        let insertAt = loc.idx + 1
        for (let i = 0; i < items.length; i++) {
            if (items[i]?.parent_key === group.key) insertAt = Math.max(insertAt, i + 1)
        }

        const nextItems = items.slice(0, insertAt).concat([newItem], items.slice(insertAt))

        const nextSections = prev.sections.map((s, i) =>
            i === loc.si ? { ...s, items: nextItems } : s
        )
        return { ...prev, sections: nextSections }
    })
}

function deleteItem(uiId) {
    setSchema((prev) => {
        const loc = getSectionAndIndexByUiId(prev, uiId)
        if (!loc) return prev
        const sec = prev.sections[loc.si]
        const nextItems = removeItemAndChildren(sec.items || [], uiId)
        const nextSections = prev.sections.map((s, i) =>
            i === loc.si ? { ...s, items: nextItems } : s
        )
        return { ...prev, sections: nextSections }
    })
}

function moveGroupChild(groupKey, childUiId, dir) {
    setSchema((prev) => {
        // find section that contains this child
        const loc = getSectionAndIndexByUiId(prev, childUiId)
        if (!loc) return prev
        const sec = prev.sections[loc.si]
        const nextItems = moveChild(sec.items || [], groupKey, childUiId, dir)
        const nextSections = prev.sections.map((s, i) =>
            i === loc.si ? { ...s, items: nextItems } : s
        )
        return { ...prev, sections: nextSections }
    })
}


/* -------------------------------------------------------------------------- */
/*                                  ROW UI                                    */
/* -------------------------------------------------------------------------- */

const SectionRow = memo(function SectionRow({ title, subtitle, active, onClick, onMoveUp, onMoveDown, onDelete }) {
    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded-2xl border px-3 py-2",
                active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
            )}
            onClick={onClick}
            role="button"
            tabIndex={0}
        >
            <div className="cursor-grab text-slate-400">
                <GripVertical className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                {subtitle ? <div className="truncate text-xs text-slate-500">{subtitle}</div> : null}
            </div>

            <div className="hidden items-center gap-1 group-hover:flex">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveUp())} type="button">
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveDown())} type="button">
                    <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-xl text-rose-600 hover:text-rose-700"
                    onClick={(e) => (e.stopPropagation(), onDelete())}
                    type="button"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
})

const ItemRow = memo(function ItemRow({ title, hint, active, onClick, onMoveUp, onMoveDown, onDelete }) {
    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded-2xl border px-3 py-2",
                active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
            )}
            onClick={onClick}
            role="button"
            tabIndex={0}
        >
            <div className="cursor-grab text-slate-400">
                <GripVertical className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                {hint ? <div className="truncate text-xs text-slate-500">{hint}</div> : null}
            </div>

            <div className="hidden items-center gap-1 group-hover:flex">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveUp())} type="button">
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(e) => (e.stopPropagation(), onMoveDown())} type="button">
                    <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-xl text-rose-600 hover:text-rose-700"
                    onClick={(e) => (e.stopPropagation(), onDelete())}
                    type="button"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
})

/* -------------------------------------------------------------------------- */
/*                                 MAIN PANEL                                 */
/* -------------------------------------------------------------------------- */

const BuilderPanel = memo(function BuilderPanel({ store, fieldTypes }) {
    return (
        <div className="h-full min-h-0">
            {/* Desktop/Tablet */}
            <div className="hidden h-full min-h-0 md:block">
                <div className="grid h-full min-h-0 grid-cols-12 gap-4 p-4 md:p-6">
                    <SectionsPane store={store} className="col-span-12 md:col-span-4 lg:col-span-3" />
                    <FieldsPane store={store} fieldTypes={fieldTypes} className="col-span-12 md:col-span-8 lg:col-span-6" />
                    <PropertiesPane store={store} fieldTypes={fieldTypes} className="col-span-12 lg:col-span-3" />
                </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden h-full min-h-0 p-3">
                <MobileTabs store={store} fieldTypes={fieldTypes} />
            </div>
        </div>
    )
})

export default BuilderPanel

/* -------------------------------------------------------------------------- */
/*                                 MOBILE TABS                                */
/* -------------------------------------------------------------------------- */

const MobileTabs = memo(function MobileTabs({ store, fieldTypes }) {
    const [tab, setTab] = useState("fields")
    const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)
    const selectedItemRid = store.useStore((s) => s.selectedItemRid || null, Object.is)

    return (
        <div className="h-full min-h-0 flex flex-col">
            <Tabs value={tab} onValueChange={setTab} className="h-full min-h-0 flex flex-col">
                <TabsList className="grid grid-cols-3 rounded-2xl p-1">
                    <TabsTrigger value="sections" className="rounded-2xl">
                        Sections
                    </TabsTrigger>
                    <TabsTrigger value="fields" className="rounded-2xl">
                        Fields
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-2xl">
                        Configure
                    </TabsTrigger>
                </TabsList>

                <div className="mt-3 h-full min-h-0">
                    <TabsContent value="sections" className="m-0 h-full min-h-0">
                        <SectionsPane store={store} className="h-full" />
                    </TabsContent>

                    <TabsContent value="fields" className="m-0 h-full min-h-0">
                        <FieldsPane store={store} fieldTypes={fieldTypes} className="h-full" />
                    </TabsContent>

                    <TabsContent value="config" className="m-0 h-full min-h-0">
                        <PropertiesPane store={store} fieldTypes={fieldTypes} className="h-full" />
                    </TabsContent>
                </div>

                <div className="mt-2 text-[11px] text-slate-500">
                    {selectedSectionRid ? "Section selected" : "Select a section"} · {selectedItemRid ? "Field selected" : "Select a field"}
                </div>
            </Tabs>
        </div>
    )
})

/* -------------------------------------------------------------------------- */
/*                                 SECTIONS PANE                              */
/* -------------------------------------------------------------------------- */

const SectionsPane = memo(function SectionsPane({ store, className }) {
    const dragRef = useRef(null) // { fromIdx:number }
    const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)

    // primitive rows => stable
    const sectionRows = store.useStore(
        (s) =>
            (s.schema?.sections || []).map((sec) => {
                const rid = sec?._rid || ""
                const code = safeStr(sec?.code || "SECTION")
                const label = safeStr(sec?.label || "")
                return `${rid}::${code}::${label}`
            }),
        shallowSliceEqual
    )

    function selectSection(sectionRid) {
        store.setState((prev) => ({
            ...prev,
            selectedSectionRid: sectionRid,
            selectedItemRid: null,
            selectedGroupParentRid: null,
        }))
    }

    function addSection() {
        store.setState((prev) => {
            const base = prev.schema
            const next = { ...base, sections: [...(base.sections || []), mkDefaultSection("NEW_SECTION")] }
            const lastRid = next.sections[next.sections.length - 1]?._rid || null
            return { ...prev, schema: next, selectedSectionRid: lastRid, selectedItemRid: null, selectedGroupParentRid: null }
        })
    }

    function deleteSection(sectionRid) {
        store.setState((prev) => {
            const base = prev.schema
            const nextSections = (base.sections || []).filter((s) => s?._rid !== sectionRid)
            const first = nextSections[0]?._rid || null
            return {
                ...prev,
                schema: { ...base, sections: nextSections },
                selectedSectionRid: first,
                selectedItemRid: null,
                selectedGroupParentRid: null,
            }
        })
    }

    function moveSectionByRid(sectionRid, dir) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const idx = secs.findIndex((s) => s?._rid === sectionRid)
            const to = idx + dir
            if (idx < 0 || to < 0 || to >= secs.length) return prev
            return { ...prev, schema: { ...base, sections: moveItem(secs, idx, to) } }
        })
    }

    function onSectionDragStart(fromIdx) {
        dragRef.current = { fromIdx }
    }

    function onSectionDrop(toIdx) {
        const d = dragRef.current
        if (!d) return
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            return { ...prev, schema: { ...base, sections: moveItem(secs, d.fromIdx, toIdx) } }
        })
        dragRef.current = null
    }

    function parseRow(rowStr) {
        const [rid, code, label] = String(rowStr || "").split("::")
        return { rid, code, label }
    }

    return (
        <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle className="text-base">Sections</CardTitle>
                        <CardDescription className="truncate">Vitals, History, Orders…</CardDescription>
                    </div>
                    <Button size="icon" className="h-9 w-9 rounded-2xl" onClick={addSection} type="button">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 p-3 pt-0">
                <ScrollArea className="h-full">
                    <div className="space-y-2 pr-2">
                        {sectionRows.map((rowStr, idx) => {
                            const { rid, code, label } = parseRow(rowStr)
                            const title = label?.trim() ? label : "Untitled Section"
                            const subtitle = code?.trim() ? code : "SECTION"
                            return (
                                <div
                                    key={rid}
                                    draggable
                                    onDragStart={() => onSectionDragStart(idx)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => onSectionDrop(idx)}
                                >
                                    <SectionRow
                                        title={title}
                                        subtitle={subtitle}
                                        active={rid === selectedSectionRid}
                                        onClick={() => selectSection(rid)}
                                        onMoveUp={() => moveSectionByRid(rid, -1)}
                                        onMoveDown={() => moveSectionByRid(rid, +1)}
                                        onDelete={() => deleteSection(rid)}
                                    />
                                </div>
                            )
                        })}

                        {!sectionRows.length ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                                Add a section to begin (e.g., Vitals, Assessment, Plan).
                            </div>
                        ) : null}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
})

/* -------------------------------------------------------------------------- */
/*                                  FIELDS PANE                               */
/* -------------------------------------------------------------------------- */

const FieldsPane = memo(function FieldsPane({ store, fieldTypes, className }) {
    const dragRef = useRef(null) // { sectionRid, fromIdx }
    const [fieldPicker, setFieldPicker] = useState(() => (Array.isArray(fieldTypes) && fieldTypes[0]) || "text")
    const [packPicker, setPackPicker] = useState("")

    const selectedSectionRid = store.useStore((s) => s.selectedSectionRid || null, Object.is)
    const selectedItemRid = store.useStore((s) => s.selectedItemRid || null, Object.is)

    const selectedSectionTitle = store.useStore((s) => {
        const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
        if (!sec) return ""
        return safeStr(sec?.label || "") || "Untitled Section"
    }, Object.is)

    const itemRows = store.useStore(
        (s) => {
            const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
            const items = sec?.items || []
            return items.map((it) => {
                const type = String(it?.type || "text")
                const title = `${labelForFieldType(type)} · ${safeStr(it?.label || "Field")}`
                const hint = safeStr(it?.help_text || it?.ui?.hint || "")
                const childCount = String(it?.type || "") === "group" && Array.isArray(it?.items) ? it.items.length : 0
                return `${it?._rid || ""}::${type}::${title}::${hint}::${childCount}`
            })
        },
        shallowSliceEqual
    )

    const groupChildRows = store.useStore(
        (s) => {
            const sec = s.selectedSectionRid ? selectSectionByRid(s.schema, s.selectedSectionRid) : null
            const items = sec?.items || []
            const out = []
            for (const it of items) {
                if (String(it?.type || "") !== "group") continue
                const parentRid = it?._rid || ""
                const kids = Array.isArray(it?.items) ? it.items : []
                for (const c of kids) {
                    out.push(`${parentRid}::${c?._rid || ""}::${String(c?.type || "text")}::${safeStr(c?.label || "Field")}`)
                }
            }
            return out
        },
        shallowSliceEqual
    )

    const groupMap = useMemo(() => {
        const m = new Map()
        for (const row of groupChildRows) {
            const [parentRid, rid, type, label] = String(row).split("::")
            if (!m.has(parentRid)) m.set(parentRid, [])
            m.get(parentRid).push({ rid, type, label })
        }
        return m
    }, [groupChildRows])

    function parseItemRow(rowStr) {
        const parts = String(rowStr || "").split("::")
        return {
            rid: parts[0] || "",
            type: parts[1] || "text",
            title: parts[2] || "",
            hint: parts[3] || "",
            childCount: Number(parts[4] || 0),
        }
    }

    function selectItem(sectionRid, itemRid, parentRid = null) {
        store.setState((prev) => ({
            ...prev,
            selectedSectionRid: sectionRid,
            selectedItemRid: itemRid,
            selectedGroupParentRid: parentRid,
        }))
    }

    function addFieldToSelectedSection() {
        if (!selectedSectionRid) return toast.error("Select a section first")
        const t = String(fieldPicker || "text").toLowerCase()
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (sidx < 0) return prev
            const sec = secs[sidx]
            const items = [...(sec.items || []), mkDefaultField(t)]
            secs[sidx] = { ...sec, items }
            const newItem = items[items.length - 1]
            return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: newItem._rid, selectedGroupParentRid: null }
        })
    }

    function deleteItem(sectionRid, itemRid, parentRid = null) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === sectionRid)
            if (sidx < 0) return prev
            const sec = secs[sidx]
            const items = [...(sec.items || [])]

            if (parentRid) {
                const pidx = items.findIndex((x) => x?._rid === parentRid)
                if (pidx < 0) return prev
                const parent = items[pidx]
                const nextKids = (parent?.items || []).filter((c) => c?._rid !== itemRid)
                items[pidx] = { ...parent, items: nextKids }
                secs[sidx] = { ...sec, items }
                return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: null, selectedGroupParentRid: null }
            }

            const nextItems = items.filter((x) => x?._rid !== itemRid)
            secs[sidx] = { ...sec, items: nextItems }
            return { ...prev, schema: { ...base, sections: secs }, selectedItemRid: null, selectedGroupParentRid: null }
        })
    }

    function moveItemWithinSection(sectionRid, itemRid, dir) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === sectionRid)
            if (sidx < 0) return prev
            const sec = secs[sidx]
            const items = [...(sec.items || [])]
            const idx = items.findIndex((x) => x?._rid === itemRid)
            const to = idx + dir
            if (idx < 0 || to < 0 || to >= items.length) return prev
            secs[sidx] = { ...sec, items: moveItem(items, idx, to) }
            return { ...prev, schema: { ...base, sections: secs } }
        })
    }

    function onItemDragStart(sectionRid, fromIdx) {
        dragRef.current = { sectionRid, fromIdx }
    }

    function onItemDrop(sectionRid, toIdx) {
        const d = dragRef.current
        if (!d || d.sectionRid !== sectionRid) return
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === sectionRid)
            if (sidx < 0) return prev
            const sec = secs[sidx]
            const items = [...(sec.items || [])]
            secs[sidx] = { ...sec, items: moveItem(items, d.fromIdx, toIdx) }
            return { ...prev, schema: { ...base, sections: secs } }
        })
        dragRef.current = null
    }

    function applyPack(packId) {
        const pack = CLINICAL_PACKS.find((p) => p.id === packId)
        if (!pack) return
        store.setState((prev) => {
            const res = pack.apply(prev.schema)
            const focus = res?.focusSectionRid || prev.selectedSectionRid || res?.schema?.sections?.[0]?._rid || null
            return {
                ...prev,
                schema: res.schema,
                selectedSectionRid: focus,
                selectedItemRid: null,
                selectedGroupParentRid: null,
            }
        })
        toast.success(`Added: ${pack.label}`)
    }

    return (
        <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col", className)}>
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                            <CardTitle className="text-base">Fields</CardTitle>
                            <CardDescription className="truncate">
                                {selectedSectionRid ? `In: ${selectedSectionTitle}` : "Select a section"}
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={fieldPicker} onValueChange={setFieldPicker}>
                                <SelectTrigger className="h-10 w-[200px] rounded-2xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[280px]">
                                    {(fieldTypes || []).map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {labelForFieldType(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button className="h-10 rounded-2xl" onClick={addFieldToSelectedSection} disabled={!selectedSectionRid} type="button">
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                            </Button>
                        </div>
                    </div>

                    {/* NEW: Quick Clinical Packs */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-slate-500">Quick add:</div>
                        <Select
                            value={packPicker}
                            onValueChange={(v) => {
                                setPackPicker("") // reset so user can add again quickly
                                if (v) applyPack(v)
                            }}
                        >
                            <SelectTrigger className="h-9 w-[260px] rounded-2xl">
                                <SelectValue placeholder="Choose a clinical set…" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[320px]">
                                {CLINICAL_PACKS.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Badge variant="secondary" className="rounded-xl">
                            No JSON · Clinician friendly
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 p-3 pt-0">
                <ScrollArea className="h-full">
                    <div className="space-y-2 pr-2">
                        {!selectedSectionRid ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                                Select a section on the left to add fields.
                            </div>
                        ) : null}

                        {selectedSectionRid && !itemRows.length ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                                Add fields like Vitals, Diagnosis, Medications, Scores, Tables…
                            </div>
                        ) : null}

                        {selectedSectionRid
                            ? itemRows.map((rowStr, idx) => {
                                const it = parseItemRow(rowStr)
                                const hint = safeStr(it.hint || "")
                                return (
                                    <div
                                        key={it.rid}
                                        draggable
                                        onDragStart={() => onItemDragStart(selectedSectionRid, idx)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => onItemDrop(selectedSectionRid, idx)}
                                    >
                                        <ItemRow
                                            title={it.title}
                                            hint={hint}
                                            active={it.rid === selectedItemRid}
                                            onClick={() => selectItem(selectedSectionRid, it.rid, null)}
                                            onMoveUp={() => moveItemWithinSection(selectedSectionRid, it.rid, -1)}
                                            onMoveDown={() => moveItemWithinSection(selectedSectionRid, it.rid, +1)}
                                            onDelete={() => deleteItem(selectedSectionRid, it.rid, null)}
                                        />

                                        {/* group children quick list */}
                                        {String(it.type || "") === "group" && groupMap.get(it.rid)?.length ? (
                                            <div className="ml-8 mt-2 space-y-2">
                                                {groupMap.get(it.rid).map((c) => (
                                                    <div key={c.rid} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-xs font-semibold text-slate-900">
                                                                {labelForFieldType(c.type)} · {safeStr(c.label)}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 rounded-xl"
                                                                onClick={() => selectItem(selectedSectionRid, c.rid, it.rid)}
                                                                type="button"
                                                            >
                                                                <Settings className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 rounded-xl text-rose-600"
                                                                onClick={() => deleteItem(selectedSectionRid, c.rid, it.rid)}
                                                                type="button"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                )
                            })
                            : null}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
})

/* -------------------------------------------------------------------------- */
/*                                PROPERTIES PANE                             */
/* -------------------------------------------------------------------------- */
/**
 * This Properties pane is clinician-friendly:
 * - No “schema” or “JSON”
 * - Only shows “Internal ID / Advanced” inside a collapsed panel
 * - Required applies only when visible (runtime rule); builder just stores flags
 */

const PropertiesPane = memo(function PropertiesPane({ store, fieldTypes, className }) {
    return (
        <Card className={cn("rounded-3xl border-slate-200 h-full min-h-0 flex flex-col overflow-hidden", className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Configure</CardTitle>
                <CardDescription>Labels, choices, table columns, visibility</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
                <PropertiesPanel store={store} fieldTypes={fieldTypes} />
            </CardContent>
        </Card>
    )
})

const PropertiesPanel = memo(function PropertiesPanel({ store, fieldTypes }) {

    function uniqueKeyNormKey(base, takenSet) {
        let k = normKey(base || "field")
        if (!takenSet.has(k)) return k
        let i = 2
        while (takenSet.has(`${k}_${i}`)) i++
        return `${k}_${i}`
    }

    function selectGroupChild(parentRid, childRid) {
        store.setState((prev) => ({
            ...prev,
            selectedItemRid: childRid,
            selectedGroupParentRid: parentRid,
        }))
    }

    function addChildToGroup(parentRid, { type, label = "Value" }) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (sidx < 0) return prev

            const sec = secs[sidx]
            const items = [...(sec.items || [])]
            const pidx = items.findIndex((x) => x?._rid === parentRid)
            if (pidx < 0) return prev

            // collect all keys in section (including nested), to avoid duplicates
            const taken = new Set()
            walkItems(items, (it) => {
                if (it?.key) taken.add(String(it.key))
            })

            const parent = { ...(items[pidx] || {}), items: [...((items[pidx]?.items) || [])] }

            const child = mkDefaultField(String(type || "text").toLowerCase())
            child.label = label
            child.key = uniqueKeyNormKey(`${normKey(parent.key || "group")}_${child.type}`, taken)

            parent.items.push(child)
            items[pidx] = parent
            secs[sidx] = { ...sec, items }

            return {
                ...prev,
                schema: { ...base, sections: secs },
                selectedItemRid: child._rid,              // auto-open child config
                selectedGroupParentRid: parentRid,
            }
        })
    }

    function deleteChildFromGroup(parentRid, childRid) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (sidx < 0) return prev

            const sec = secs[sidx]
            const items = [...(sec.items || [])]
            const pidx = items.findIndex((x) => x?._rid === parentRid)
            if (pidx < 0) return prev

            const parent = { ...(items[pidx] || {}), items: [...((items[pidx]?.items) || [])] }
            parent.items = parent.items.filter((c) => c?._rid !== childRid)
            items[pidx] = parent
            secs[sidx] = { ...sec, items }

            const deletingSelected = prev.selectedItemRid === childRid && prev.selectedGroupParentRid === parentRid

            return {
                ...prev,
                schema: { ...base, sections: secs },
                ...(deletingSelected ? { selectedItemRid: parentRid, selectedGroupParentRid: null } : {}),
            }
        })
    }

    function moveChildInGroup(parentRid, childRid, dir) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (sidx < 0) return prev

            const sec = secs[sidx]
            const items = [...(sec.items || [])]
            const pidx = items.findIndex((x) => x?._rid === parentRid)
            if (pidx < 0) return prev

            const parent = { ...(items[pidx] || {}), items: [...((items[pidx]?.items) || [])] }
            const kids = parent.items
            const from = kids.findIndex((c) => c?._rid === childRid)
            const to = from + dir
            if (from < 0 || to < 0 || to >= kids.length) return prev

            parent.items = moveItem(kids, from, to)
            items[pidx] = parent
            secs[sidx] = { ...sec, items }

            return { ...prev, schema: { ...base, sections: secs } }
        })
    }

    const selection = store.useStore(
        (s) => ({
            schema: s.schema,
            selectedSectionRid: s.selectedSectionRid,
            selectedItemRid: s.selectedItemRid,
            selectedGroupParentRid: s.selectedGroupParentRid,
        }),
        shallowSliceEqual
    )

    const schema = selection.schema
    const section = selection.selectedSectionRid ? selectSectionByRid(schema, selection.selectedSectionRid) : null
    const { item, parent } = section && selection.selectedItemRid ? findItemInSection(section, selection.selectedItemRid) : { item: null, parent: null }
    const effectiveItem = item || null
    const isGroupChild = !!parent

    function patchSection(patch) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const idx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (idx < 0) return prev
            secs[idx] = { ...secs[idx], ...(patch || {}) }
            return { ...prev, schema: { ...base, sections: secs } }
        })
    }

    function patchItem(patch) {
        store.setState((prev) => {
            const base = prev.schema
            const secs = [...(base.sections || [])]
            const sidx = secs.findIndex((s) => s?._rid === prev.selectedSectionRid)
            if (sidx < 0) return prev
            const sec = secs[sidx]
            const items = [...(sec.items || [])]

            // group child patch
            if (prev.selectedItemRid && prev.selectedGroupParentRid) {
                const pidx = items.findIndex((x) => x?._rid === prev.selectedGroupParentRid)
                if (pidx < 0) return prev
                const parent2 = { ...items[pidx], items: [...(items[pidx]?.items || [])] }
                const cidx = parent2.items.findIndex((c) => c?._rid === prev.selectedItemRid)
                if (cidx < 0) return prev
                parent2.items[cidx] = { ...(parent2.items[cidx] || {}), ...(patch || {}) }
                items[pidx] = parent2
            } else {
                const iidx = items.findIndex((x) => x?._rid === prev.selectedItemRid)
                if (iidx < 0) return prev
                items[iidx] = { ...(items[iidx] || {}), ...(patch || {}) }
            }

            secs[sidx] = { ...sec, items }
            return { ...prev, schema: { ...base, sections: secs } }
        })
    }

    const conditionCandidates = useMemo(() => {
        // fields in this section that can be used for “Visible When”
        const out = []
        const sec = section
        if (!sec) return out
        walkItems(sec.items || [], (it) => {
            const t = String(it?.type || "")
            if (!it?.key) return
            if (["boolean", "radio", "select"].includes(t)) {
                out.push({ key: String(it.key), label: safeStr(it?.label || it.key), type: t })
            }
        })
        return out
    }, [section])

    if (!section) {
        return (
            <div className="h-full p-4 md:p-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Select a section (left) or a field (middle) to configure.
                </div>
            </div>
        )
    }

    // No item selected => section config
    if (!effectiveItem) {
        return (
            <div className="h-full min-h-0">
                <ScrollArea className="h-full">
                    <div className="p-4 md:p-6 space-y-4">
                        <Card className="rounded-3xl border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-base">Section Settings</CardTitle>
                                <CardDescription>Clinician-friendly naming and layout</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Section Title</Label>
                                    <Input className="h-11 rounded-2xl" value={safeStr(section.label)} onChange={(e) => patchSection({ label: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Layout</Label>
                                        <Select value={safeStr(section.layout || "STACK")} onValueChange={(v) => patchSection({ layout: v })}>
                                            <SelectTrigger className="h-11 rounded-2xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[
                                                    { v: "STACK", l: "Stack (one below another)" },
                                                    { v: "GRID_2", l: "Grid (2 columns)" },
                                                    { v: "GRID_3", l: "Grid (3 columns)" },
                                                ].map((x) => (
                                                    <SelectItem key={x.v} value={x.v}>
                                                        {x.l}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                                        <div>
                                            <div className="text-sm font-medium text-slate-700">Repeatable</div>
                                            <div className="text-xs text-slate-500">For daily notes / repeated entries</div>
                                        </div>
                                        <Switch checked={!!section.repeatable} onCheckedChange={(v) => patchSection({ repeatable: !!v })} />
                                    </div>
                                </div>

                                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced</summary>
                                    <div className="mt-3 space-y-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-600">Internal Section Code</Label>
                                            <Input
                                                className="h-11 rounded-2xl font-mono"
                                                value={safeStr(section.code)}
                                                onChange={(e) => patchSection({ code: normCode(e.target.value) })}
                                            />
                                            <div className="text-xs text-slate-500">Used internally; keep stable once used in records.</div>
                                        </div>
                                    </div>
                                </details>
                            </CardContent>
                        </Card>

                        <div className="h-6" />
                    </div>
                </ScrollArea>
            </div>
        )
    }

    // Item config
    const type = String(effectiveItem?.type || "text").toLowerCase()

    return (
        <div className="h-full min-h-0">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4">
                    <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                Field Settings
                                {isGroupChild ? <Badge className="rounded-xl bg-slate-700">Inside Group</Badge> : null}
                            </CardTitle>
                            <CardDescription>{labelForFieldType(type)}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Common */}
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input className="h-11 rounded-2xl" value={safeStr(effectiveItem.label)} onChange={(e) => patchItem({ label: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <Label>Help Text (Tooltip)</Label>
                                <Textarea
                                    className="min-h-[90px] rounded-2xl"
                                    value={safeStr(effectiveItem.help_text || "")}
                                    onChange={(e) => patchItem({ help_text: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">Required</div>
                                        <div className="text-xs text-slate-500">Applies only when visible</div>
                                    </div>
                                    <Switch checked={!!effectiveItem.required} onCheckedChange={(v) => patchItem({ required: !!v })} />
                                </div>

                                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">Read-only</div>
                                        <div className="text-xs text-slate-500">Locks editing in documentation</div>
                                    </div>
                                    <Switch checked={!!effectiveItem.readonly} onCheckedChange={(v) => patchItem({ readonly: !!v })} />
                                </div>
                            </div>

                            {/* Layout (clinician-friendly) */}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Width</Label>
                                    <Select
                                        value={safeStr(effectiveItem?.ui?.width || "FULL")}
                                        onValueChange={(v) => patchItem({ ui: { ...(effectiveItem.ui || {}), width: v } })}
                                    >
                                        <SelectTrigger className="h-11 rounded-2xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FULL">Full</SelectItem>
                                            <SelectItem value="HALF">Half</SelectItem>
                                            <SelectItem value="THIRD">One-third</SelectItem>
                                            <SelectItem value="AUTO">Auto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Label Placement</Label>
                                    <Select
                                        value={safeStr(effectiveItem?.ui?.label_placement || "TOP")}
                                        onValueChange={(v) => patchItem({ ui: { ...(effectiveItem.ui || {}), label_placement: v } })}
                                    >
                                        <SelectTrigger className="h-11 rounded-2xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TOP">Top (default)</SelectItem>
                                            <SelectItem value="LEFT">Left</SelectItem>
                                            <SelectItem value="HIDDEN">Hidden</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            {/* Type-specific */}
                            {type === "text" || type === "textarea" ? (
                                <TextPropsEditor item={effectiveItem} onPatch={patchItem} />
                            ) : null}

                            {type === "number" ? <NumberPropsEditor item={effectiveItem} onPatch={patchItem} /> : null}

                            {type === "date" || type === "time" || type === "datetime" ? (
                                <DateTimePropsEditor item={effectiveItem} onPatch={patchItem} type={type} />
                            ) : null}

                            {type === "boolean" ? <BooleanPropsEditor item={effectiveItem} onPatch={patchItem} /> : null}

                            {["select", "multiselect", "radio", "chips"].includes(type) ? (
                                <ChoicePropsEditor item={effectiveItem} onPatch={patchItem} />
                            ) : null}

                            {type === "table" ? <TablePropsEditor item={effectiveItem} onPatch={patchItem} /> : null}

                            {type === "group" ? (
                                <GroupPropsEditor
                                    item={effectiveItem}
                                    onPatch={patchItem}
                                    candidates={conditionCandidates}
                                    fieldTypes={fieldTypes}
                                    onAddChild={(payload) => addChildToGroup(effectiveItem._rid, payload)}
                                    onDeleteChild={(childRid) => deleteChildFromGroup(effectiveItem._rid, childRid)}
                                    onMoveChild={(childRid, dir) => moveChildInGroup(effectiveItem._rid, childRid, dir)}
                                    onSelectChild={(childRid) => selectGroupChild(effectiveItem._rid, childRid)}
                                />
                            ) : null}


                            {type === "signature" ? <SignaturePropsEditor item={effectiveItem} onPatch={patchItem} /> : null}

                            {type === "file" ? <FilePropsEditor item={effectiveItem} onPatch={patchItem} mode="file" /> : null}
                            {type === "image" ? <FilePropsEditor item={effectiveItem} onPatch={patchItem} mode="image" /> : null}

                            {type === "calculation" ? <CalculationPropsEditor item={effectiveItem} onPatch={patchItem} /> : null}
                            {type === "chart" ? <ChartPropsEditor item={effectiveItem} onPatch={patchItem} /> : null}

                            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced</summary>
                                <div className="mt-3 space-y-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-600">Internal ID (auto)</Label>
                                        <Input className="h-11 rounded-2xl font-mono" value={safeStr(effectiveItem.key)} readOnly />
                                        <div className="text-xs text-slate-500">Used internally for data binding and audit trails.</div>
                                    </div>
                                </div>
                            </details>
                        </CardContent>
                    </Card>

                    <div className="h-6" />
                </div>
            </ScrollArea>
        </div>
    )
})

/* -------------------------------------------------------------------------- */
/*                             TYPE-SPECIFIC EDITORS                          */
/* -------------------------------------------------------------------------- */

const TextPropsEditor = memo(function TextPropsEditor({ item, onPatch }) {
    const rules = item?.rules || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Text Options</div>

            <div className="space-y-2">
                <Label>Placeholder (optional)</Label>
                <Input className="h-11 rounded-2xl" value={safeStr(item.placeholder || "")} onChange={(e) => onPatch({ placeholder: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Max Characters</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        type="number"
                        value={Number(rules.max_length || 0) || ""}
                        onChange={(e) => onPatch({ rules: { ...rules, max_length: Number(e.target.value || 0) || null } })}
                        placeholder="e.g., 200"
                    />
                </div>

                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Spell Check</div>
                        <div className="text-xs text-slate-500">Enabled during documentation</div>
                    </div>
                    <Switch checked={!!rules.spellcheck} onCheckedChange={(v) => onPatch({ rules: { ...rules, spellcheck: !!v } })} />
                </div>
            </div>
        </div>
    )
})

const NumberPropsEditor = memo(function NumberPropsEditor({ item, onPatch }) {
    const rules = item?.rules || {}
    const clinical = item?.clinical || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Number Options</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Min</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        type="number"
                        value={safeStr(rules.min ?? "")}
                        onChange={(e) => onPatch({ rules: { ...rules, min: e.target.value === "" ? null : Number(e.target.value) } })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Max</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        type="number"
                        value={safeStr(rules.max ?? "")}
                        onChange={(e) => onPatch({ rules: { ...rules, max: e.target.value === "" ? null : Number(e.target.value) } })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        value={safeStr(clinical.unit || "")}
                        onChange={(e) => onPatch({ clinical: { ...clinical, unit: e.target.value } })}
                        placeholder="e.g., ml, kg, mmHg"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Decimal Precision</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        type="number"
                        value={safeStr(rules.precision ?? "")}
                        onChange={(e) => onPatch({ rules: { ...rules, precision: e.target.value === "" ? null : Number(e.target.value) } })}
                        placeholder="e.g., 0, 1, 2"
                    />
                </div>
            </div>
        </div>
    )
})

const DateTimePropsEditor = memo(function DateTimePropsEditor({ item, onPatch, type }) {
    const rules = item?.rules || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">{type === "datetime" ? "Date & Time Options" : type === "date" ? "Date Options" : "Time Options"}</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Default: Now</div>
                        <div className="text-xs text-slate-500">Auto-fills current {type === "date" ? "date" : type === "time" ? "time" : "timestamp"}</div>
                    </div>
                    <Switch checked={!!rules.default_now} onCheckedChange={(v) => onPatch({ rules: { ...rules, default_now: !!v } })} />
                </div>

                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Restrict Future</div>
                        <div className="text-xs text-slate-500">Prevents future selection</div>
                    </div>
                    <Switch checked={!!rules.no_future} onCheckedChange={(v) => onPatch({ rules: { ...rules, no_future: !!v } })} />
                </div>
            </div>
        </div>
    )
})

const BooleanPropsEditor = memo(function BooleanPropsEditor({ item, onPatch }) {
    const rules = item?.rules || {}
    const NONE = "__none__"

    const selectValue =
        item?.default_value === true ? "true" :
            item?.default_value === false ? "false" :
                NONE

    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Yes/No Options</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Default</Label>
                    <Select
                        value={selectValue}
                        onValueChange={(v) =>
                            onPatch({
                                default_value: v === NONE ? null : v === "true",
                            })
                        }
                    >
                        <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>No default</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Style</Label>
                    <Select
                        value={safeStr(rules.display_style || "TOGGLE")}
                        onValueChange={(v) =>
                            onPatch({ rules: { ...rules, display_style: v } })
                        }
                    >
                        <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TOGGLE">Toggle</SelectItem>
                            <SelectItem value="CHECKBOX">Checkbox</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
})



const ChoicePropsEditor = memo(function ChoicePropsEditor({ item, onPatch }) {
    const t = String(item?.type || "")
    const options = Array.isArray(item?.options) ? item.options : []
    const choice = item?.choice || {}

    function setOptions(next) {
        onPatch({ options: next })
    }

    function addOption() {
        const next = [...options, { value: normKey(`option_${options.length + 1}`), label: `Option ${options.length + 1}` }]
        setOptions(next)
    }

    function patchOption(idx, patch) {
        const next = options.map((o, i) => (i === idx ? { ...o, ...patch } : o))
        setOptions(next)
    }

    function removeOption(idx) {
        const next = options.filter((_, i) => i !== idx)
        setOptions(next)
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Choices</div>
                <Button variant="outline" className="rounded-2xl" onClick={addOption} type="button">
                    <Plus className="mr-2 h-4 w-4" />
                    Add choice
                </Button>
            </div>

            <div className="space-y-2">
                {options.map((o, idx) => (
                    <div key={`${o.value}-${idx}`} className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-12 md:items-center">
                        <div className="md:col-span-5 space-y-1">
                            <div className="text-xs text-slate-500">Label</div>
                            <Input className="h-10 rounded-2xl" value={safeStr(o.label)} onChange={(e) => patchOption(idx, { label: e.target.value })} />
                        </div>
                        <div className="md:col-span-5 space-y-1">
                            <div className="text-xs text-slate-500">Internal value (auto)</div>
                            <Input className="h-10 rounded-2xl font-mono" value={safeStr(o.value)} onChange={(e) => patchOption(idx, { value: normKey(e.target.value) })} />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 rounded-2xl text-rose-600"
                                onClick={() => removeOption(idx)}
                                type="button"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                ))}

                {!options.length ? <div className="text-sm text-slate-500">No choices added yet.</div> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {t === "radio" ? (
                    <div className="space-y-2">
                        <Label>Orientation</Label>
                        <Select
                            value={safeStr(choice.orientation || "HORIZONTAL")}
                            onValueChange={(v) => onPatch({ choice: { ...choice, orientation: v } })}
                        >
                            <SelectTrigger className="h-11 rounded-2xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="HORIZONTAL">Horizontal</SelectItem>
                                <SelectItem value="VERTICAL">Vertical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}

                {t === "chips" ? (
                    <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                        <div>
                            <div className="text-sm font-medium text-slate-700">Allow free entry</div>
                            <div className="text-xs text-slate-500">Clinicians can type new values</div>
                        </div>
                        <Switch checked={!!choice.allow_custom} onCheckedChange={(v) => onPatch({ choice: { ...choice, allow_custom: !!v } })} />
                    </div>
                ) : null}
            </div>
        </div>
    )
})

const TablePropsEditor = memo(function TablePropsEditor({ item, onPatch }) {
    const table = item?.table || {}
    const columns = Array.isArray(table.columns) ? table.columns : []

    function setTable(next) {
        onPatch({ table: next })
    }

    function addColumn() {
        const next = {
            ...table,
            columns: [
                ...columns,
                { _rid: genRid(), key: normKey(`col_${columns.length + 1}`), label: `Column ${columns.length + 1}`, type: "text", required: false },
            ],
        }
        setTable(next)
    }

    function patchColumn(rid, patch) {
        const nextCols = columns.map((c) => (c?._rid === rid ? { ...c, ...patch } : c))
        setTable({ ...table, columns: nextCols })
    }

    function removeColumn(rid) {
        const nextCols = columns.filter((c) => c?._rid !== rid)
        setTable({ ...table, columns: nextCols })
    }

    function moveColumn(rid, dir) {
        const idx = columns.findIndex((c) => c?._rid === rid)
        const to = idx + dir
        if (idx < 0 || to < 0 || to >= columns.length) return
        setTable({ ...table, columns: moveItem(columns, idx, to) })
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Table Columns</div>
                <Button variant="outline" className="rounded-2xl" onClick={addColumn} type="button">
                    <Plus className="mr-2 h-4 w-4" />
                    Add column
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {columns.map((c) => (
                    <div key={c._rid} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">{safeStr(c.label || "Column")}</div>
                            <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => moveColumn(c._rid, -1)} type="button">
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => moveColumn(c._rid, +1)} type="button">
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-xl text-rose-600"
                                    onClick={() => removeColumn(c._rid)}
                                    type="button"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                            <div className="md:col-span-5 space-y-2">
                                <Label>Column Label</Label>
                                <Input className="h-11 rounded-2xl" value={safeStr(c.label)} onChange={(e) => patchColumn(c._rid, { label: e.target.value })} />
                            </div>

                            <div className="md:col-span-4 space-y-2">
                                <Label>Type</Label>
                                <Select value={safeStr(c.type || "text")} onValueChange={(v) => patchColumn(c._rid, { type: v })}>
                                    <SelectTrigger className="h-11 rounded-2xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {["text", "number", "date", "time", "datetime", "select"].map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {labelForFieldType(t)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-3 flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-700">Required</div>
                                    <div className="text-xs text-slate-500">Per-row</div>
                                </div>
                                <Switch checked={!!c.required} onCheckedChange={(v) => patchColumn(c._rid, { required: !!v })} />
                            </div>
                        </div>

                        {String(c.type || "") === "select" ? (
                            <div className="mt-3 space-y-2">
                                <Label>Choices</Label>
                                <Input
                                    className="h-11 rounded-2xl"
                                    value={(Array.isArray(c.options) ? c.options : []).map((o) => o.label).join(", ")}
                                    onChange={(e) => {
                                        const raw = String(e.target.value || "")
                                            .split(",")
                                            .map((x) => x.trim())
                                            .filter(Boolean)
                                        patchColumn(c._rid, { options: raw.map((x) => ({ value: normKey(x), label: x })) })
                                    }}
                                    placeholder="e.g., Left, Right, Bilateral"
                                />
                                <div className="text-xs text-slate-500">Comma separated.</div>
                            </div>
                        ) : null}

                        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced</summary>
                            <div className="mt-3 space-y-2">
                                <Label className="text-xs text-slate-600">Internal column ID</Label>
                                <Input className="h-11 rounded-2xl font-mono" value={safeStr(c.key)} onChange={(e) => patchColumn(c._rid, { key: normKey(e.target.value) })} />
                            </div>
                        </details>
                    </div>
                ))}

                {!columns.length ? <div className="text-sm text-slate-500">No columns yet.</div> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Allow add row</div>
                        <div className="text-xs text-slate-500">Clinicians can add rows</div>
                    </div>
                    <Switch checked={table.allow_add_row !== false} onCheckedChange={(v) => setTable({ ...table, allow_add_row: !!v })} />
                </div>

                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Allow delete row</div>
                        <div className="text-xs text-slate-500">Clinicians can remove rows</div>
                    </div>
                    <Switch checked={table.allow_delete_row !== false} onCheckedChange={(v) => setTable({ ...table, allow_delete_row: !!v })} />
                </div>
            </div>
        </div>
    )
})

const GroupPropsEditor = memo(function GroupPropsEditor({
    item,
    onPatch,
    candidates,
    fieldTypes,
    onAddChild,
    onDeleteChild,
    onMoveChild,
    onSelectChild,
}) {
    const rules = item?.rules || {}
    const vw = rules.visible_when || null

    const NONE = "__none__"

    const candidateKey = safeStr(vw?.field_key || "")
    const op = safeStr(vw?.op || "eq")

    const selectedCandidate = (candidates || []).find((c) => c.key === candidateKey) || null

    const value =
        selectedCandidate?.type === "boolean"
            ? String(vw?.value === true ? "true" : vw?.value === false ? "false" : "true")
            : safeStr(vw?.value ?? "")

    function setVisibleWhen(next) {
        onPatch({ rules: { ...rules, visible_when: next } })
    }

    const children = Array.isArray(item?.items) ? item.items : []

    const allowedTypes = (fieldTypes || [
        "text", "textarea", "number", "date", "time", "datetime",
        "boolean", "select", "multiselect", "radio", "chips", "table",
        "signature", "file", "image", "calculation", "chart"
    ]).filter((t) => String(t) !== "group")

    const [addType, setAddType] = useState(allowedTypes[0] || "text")

    return (
        <div className="space-y-4">
            <div className="text-sm font-semibold text-slate-900">Visibility</div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                This group appears only when the selected condition is true. Hidden fields never block saving.
            </div>

            {/* Visible When */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Show when (field)</Label>
                    <Select
                        value={candidateKey ? candidateKey : NONE}
                        onValueChange={(v) => {
                            if (v === NONE) return setVisibleWhen(null)
                            setVisibleWhen({ op: "eq", field_key: v, value: true })
                        }}
                    >
                        <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue placeholder="Choose a field…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[260px]">
                            <SelectItem value={NONE}>No condition</SelectItem>
                            {(candidates || []).map((c) => (
                                <SelectItem key={c.key} value={c.key}>
                                    {c.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                        value={op}
                        onValueChange={(v) => setVisibleWhen(candidateKey ? { ...vw, op: v } : null)}
                        disabled={!candidateKey}
                    >
                        <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="eq">Equals</SelectItem>
                            <SelectItem value="neq">Not equals</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {candidateKey ? (
                <div className="space-y-2">
                    <Label>Value</Label>
                    {selectedCandidate?.type === "boolean" ? (
                        <Select value={String(value)} onValueChange={(v) => setVisibleWhen({ ...vw, value: v === "true" })}>
                            <SelectTrigger className="h-11 rounded-2xl">
                                <SelectValue placeholder="Choose…" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input
                            className="h-11 rounded-2xl"
                            value={value}
                            onChange={(e) => setVisibleWhen({ ...vw, value: e.target.value })}
                            placeholder="e.g., Correct"
                        />
                    )}
                </div>
            ) : null}

            {/* Group Layout */}
            <div className="space-y-2">
                <Label>Group Layout</Label>
                <Select
                    value={safeStr(item?.group?.layout || "STACK")}
                    onValueChange={(v) => onPatch({ group: { ...(item.group || {}), layout: v } })}
                >
                    <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="STACK">Stack</SelectItem>
                        <SelectItem value="GRID_2">Grid (2 columns)</SelectItem>
                        <SelectItem value="GRID_3">Grid (3 columns)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ✅ Fields inside group */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">Fields inside group</div>

                    <div className="flex items-center gap-2">
                        <Select value={addType} onValueChange={setAddType}>
                            <SelectTrigger className="h-9 w-[200px] rounded-2xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[280px]">
                                {allowedTypes.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {labelForFieldType(t)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            className="h-9 rounded-2xl"
                            onClick={() => onAddChild?.({ type: addType, label: "Value" })}
                        >
                            + Add inside group
                        </Button>
                    </div>
                </div>

                <div className="mt-3 space-y-2">
                    {children.length === 0 ? (
                        <div className="text-xs text-slate-500">No fields added yet.</div>
                    ) : (
                        children.map((ch, idx) => (
                            <div
                                key={ch._rid}
                                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    onClick={() => onSelectChild?.(ch._rid)}
                                    title="Edit this field"
                                >
                                    <span className="text-xs font-semibold text-slate-900">{ch.label || "(no label)"}</span>
                                    <span className="text-[11px] text-slate-500">• {labelForFieldType(ch.type)}</span>
                                </button>

                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-8 rounded-xl px-2"
                                        onClick={() => onMoveChild?.(ch._rid, -1)}
                                        disabled={idx === 0}
                                    >
                                        ↑
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-8 rounded-xl px-2"
                                        onClick={() => onMoveChild?.(ch._rid, +1)}
                                        disabled={idx === children.length - 1}
                                    >
                                        ↓
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-8 rounded-xl px-2 text-red-600"
                                        onClick={() => onDeleteChild?.(ch._rid)}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
})




const SignaturePropsEditor = memo(function SignaturePropsEditor({ item, onPatch }) {
    const sig = item?.signature || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Signature Options</div>

            <div className="space-y-2">
                <Label>Allowed Role</Label>
                <Select value={safeStr(sig.signer_role || "DOCTOR")} onValueChange={(v) => onPatch({ signature: { ...sig, signer_role: v } })}>
                    <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {["DOCTOR", "SURGEON", "ANESTHETIST", "NURSE", "TECHNICIAN"].map((r) => (
                            <SelectItem key={r} value={r}>
                                {r}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                After signing, the record should lock (handled in documentation runtime).
            </div>
        </div>
    )
})

const FilePropsEditor = memo(function FilePropsEditor({ item, onPatch, mode }) {
    const cfg = mode === "image" ? item?.image || {} : item?.file || {}
    const key = mode === "image" ? "image" : "file"
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">{mode === "image" ? "Image Upload Options" : "File Upload Options"}</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Accept</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        value={safeStr(cfg.accept || (mode === "image" ? "image/*" : "*/*"))}
                        onChange={(e) => onPatch({ [key]: { ...cfg, accept: e.target.value } })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Max size (MB)</Label>
                    <Input
                        className="h-11 rounded-2xl"
                        type="number"
                        value={safeStr(cfg.max_size_mb ?? 10)}
                        onChange={(e) => onPatch({ [key]: { ...cfg, max_size_mb: Number(e.target.value || 0) } })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Max files</Label>
                <Input
                    className="h-11 rounded-2xl"
                    type="number"
                    value={safeStr(cfg.max_files ?? 1)}
                    onChange={(e) => onPatch({ [key]: { ...cfg, max_files: Number(e.target.value || 1) } })}
                />
            </div>
        </div>
    )
})

const CalculationPropsEditor = memo(function CalculationPropsEditor({ item }) {
    const calc = item?.calculation || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Calculation</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Formula stays developer-only. This field is read-only and updates automatically during documentation.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Output type</Label>
                    <Input className="h-11 rounded-2xl" value={safeStr(calc.output_type || "number")} readOnly />
                </div>
                <div className="space-y-2">
                    <Label>Precision</Label>
                    <Input className="h-11 rounded-2xl" value={safeStr(calc.precision ?? 2)} readOnly />
                </div>
            </div>
        </div>
    )
})

const ChartPropsEditor = memo(function ChartPropsEditor({ item, onPatch }) {
    const chart = item?.chart || {}
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Graph / Trend</div>

            <div className="space-y-2">
                <Label>Title</Label>
                <Input className="h-11 rounded-2xl" value={safeStr(chart.title || "")} onChange={(e) => onPatch({ chart: { ...chart, title: e.target.value } })} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Chart Type</Label>
                    <Select value={safeStr(chart.chart_type || "LINE")} onValueChange={(v) => onPatch({ chart: { ...chart, chart_type: v } })}>
                        <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {["LINE", "BAR", "AREA"].map((x) => (
                                <SelectItem key={x} value={x}>
                                    {x}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-end justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Legend</div>
                        <div className="text-xs text-slate-500">Show legend</div>
                    </div>
                    <Switch checked={!!chart.show_legend} onCheckedChange={(v) => onPatch({ chart: { ...chart, show_legend: !!v } })} />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Graph pulls data from tables/number fields at runtime.
            </div>
        </div>
    )
})
