import { useCallback, useRef, useSyncExternalStore } from "react"


/**
 * Tiny external store with selector subscriptions.
 * Goal: avoid re-rendering the whole builder while typing inside an input.
 */

function shallowEqual(a, b) {
    if (Object.is(a, b)) return true
    if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (const k of ak) if (!Object.is(a[k], b[k])) return false
    return true
}

export function createTemplateBuilderStore(initialState) {
    let state = initialState
    const listeners = new Set()

    const getState = () => state

    const setState = (updater) => {
        const next = typeof updater === "function" ? updater(state) : updater
        if (Object.is(next, state)) return
        state = next
        for (const l of listeners) l()
    }

    const subscribe = (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
    }

    /**
     * Hook: subscribe to a slice only. Component re-renders only if slice changes.
     */
    const useStore = (selector = (s) => s, equalityFn = Object.is) => {
        // keep latest selector/equality without changing getSnapshot identity
        const selectorRef = useRef(selector)
        selectorRef.current = selector

        const eqRef = useRef(equalityFn)
        eqRef.current = equalityFn

        // cache the last selected value so getSnapshot returns a stable reference
        const cacheRef = useRef({ has: false, value: undefined })

        const getSnapshot = useCallback(() => {
            const next = selectorRef.current(getState())

            // IMPORTANT: if equal, return the previous reference (cached)
            if (cacheRef.current.has && eqRef.current(cacheRef.current.value, next)) {
                return cacheRef.current.value
            }

            cacheRef.current.has = true
            cacheRef.current.value = next
            return next
        }, [])

        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }



    return { getState, setState, subscribe, useStore }
}

/* ----------------------------- Schema helpers ---------------------------- */

export function genRid() {
    return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(2, 8)}`
}

export function normCode(v) {
    return String(v || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "_")
}

export function normKey(v) {
    return String(v || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
}

export function ensureSchemaShape(input) {
    const s = input && typeof input === "object" ? input : {}
    const out = { ...s }
    if (!out.schema_version) out.schema_version = 1
    if (!Array.isArray(out.sections)) out.sections = []
    return out
}

export function ensureUiIds(schema) {
    const s = ensureSchemaShape(schema)
    return {
        ...s,
        sections: (s.sections || []).map((sec) => ({
            ...sec,
            _rid: sec?._rid || genRid(),
            items: Array.isArray(sec?.items) ? sec.items.map(ensureItemIds) : [],
        })),
    }
}

export function ensureItemIds(item) {
    const it = item && typeof item === "object" ? { ...item } : {}
    if (!it._rid) it._rid = genRid()

    const kind = String(it.kind || "field")
    const type = String(it.type || "")

    if (kind === "field" && type === "group") {
        it.items = Array.isArray(it.items) ? it.items.map(ensureItemIds) : []
    }

    if (kind === "field" && type === "table" && it.table && Array.isArray(it.table.columns)) {
        it.table = { ...it.table, columns: it.table.columns.map((c) => ({ ...c, _rid: c?._rid || genRid() })) }
    }

    return it
}

/** Remove UI-only keys before sending to backend */
export function stripUiFields(node) {
    if (Array.isArray(node)) return node.map(stripUiFields)
    if (node && typeof node === "object") {
        const out = {}
        for (const [k, v] of Object.entries(node)) {
            if (k === "_rid") continue
            if (k.startsWith("__")) continue
            out[k] = stripUiFields(v)
        }
        return out
    }
    return node
}

export function mkDefaultSection(code = "NEW_SECTION") {
    return {
        _rid: genRid(),
        code: normCode(code),
        label: "",
        phase: "OTHER",
        layout: "STACK",
        repeatable: false,
        items: [],
    }
}

export function mkDefaultField(type = "text") {
    const t = String(type || "text").toLowerCase()
    const base = {
        _rid: genRid(),
        kind: "field",
        type: t,
        key: normKey(`field_${Math.random().toString(16).slice(2, 8)}`),
        label: "New Field",
        required: false,
        placeholder: "",
        help_text: "",
        default_value: null,
        readonly: false,
        ui: { width: "FULL", hint: "" },
        rules: {},
        clinical: { concept_code: "", unit: "", normal_low: "", normal_high: "", terminology: "" },
    }

    if (["select", "multiselect", "radio", "chips"].includes(t)) {
        base.options = [{ value: "option_1", label: "Option 1" }]
        base.choice = { allow_custom: t === "chips", display: "LIST" }
    }

    if (t === "table") {
        base.table = {
            min_rows: 0,
            max_rows: 0,
            allow_add_row: true,
            allow_delete_row: true,
            columns: [
                { _rid: genRid(), key: "col_1", label: "Column 1", type: "text", required: false },
                { _rid: genRid(), key: "col_2", label: "Column 2", type: "text", required: false },
            ],
        }
    }

    if (t === "group") {
        base.group = { layout: "STACK", collapsible: false, collapsed_by_default: false }
        base.items = [mkDefaultField("text")]
    }

    if (t === "signature") {
        base.signature = { signer_role: "DOCTOR", capture_mode: "DRAW", watermark: true }
    }

    if (t === "file") {
        base.file = { accept: "*/*", max_files: 1, max_size_mb: 10 }
    }

    if (t === "image") {
        base.image = { accept: "image/*", max_files: 1, max_size_mb: 10, allow_crop: false }
    }

    if (t === "calculation") {
        base.calculation = { expression: "", output_type: "number", precision: 2, readonly: true }
        base.readonly = true
    }

    // First-class chart/graph field
    if (t === "chart" || t === "graph") {
        base.type = "chart"
        base.chart = {
            chart_type: "LINE", // LINE | BAR | AREA
            source: "FIELDS", // FIELDS | QUERY
            x_key: "",
            y_keys: [],
            title: "Vitals Trend",
            show_legend: true,
        }
        base.readonly = true
    }

    if (t === "boolean" || t === "checkbox") base.default_value = false

    return base
}

export function moveItem(arr, fromIdx, toIdx) {
    const a = [...(arr || [])]
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= a.length || toIdx >= a.length) return a
    const [it] = a.splice(fromIdx, 1)
    a.splice(toIdx, 0, it)
    return a
}

export function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean)))
}

export function derivedSectionsFromSchema(schemaObj) {
    const codes = (schemaObj?.sections || []).map((s) => s?.code).filter(Boolean)
    return uniq(codes)
}

export function pickFieldTypes(builderMeta, presets) {
    const pick = (x) => (typeof x === "string" ? x : x?.code || x?.type || x?.value || "")
    const normalize = (arr) =>
        (Array.isArray(arr) ? arr : []).map(pick).map((s) => String(s || "").trim()).filter(Boolean)

    const fromMeta = normalize(builderMeta?.field_types)
    if (fromMeta.length) return fromMeta

    const fromPresets = normalize(presets?.field_types)
    if (fromPresets.length) return fromPresets

    return [
        "text",
        "textarea",
        "number",
        "date",
        "time",
        "datetime",
        "boolean",
        "select",
        "multiselect",
        "radio",
        "chips",
        "table",
        "group",
        "signature",
        "file",
        "image",
        "calculation",
        "chart", // graph/chart first class
    ]
}

export function shallowSliceEqual(a, b) {
    return shallowEqual(a, b)
}
