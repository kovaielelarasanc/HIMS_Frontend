// FILE: frontend/src/lis/LisMasters.jsx
import { useEffect, useMemo, useState, useCallback, useRef, Fragment } from 'react'
import {
    listLabDepartments,
    createLabDepartment,
    updateLabDepartment,
    deleteLabDepartment,
    listLabServices,
    bulkCreateLabServices,
    updateLabService,
    deleteLabService,
} from '../api/lisMasters'
import { useBranding } from '../branding/BrandingProvider'
import { useCan } from '../hooks/useCan'
import { toast } from 'sonner'
import {
    FlaskConical,
    Plus,
    Pencil,
    Trash2,
    Save,
    Search,
    Filter,
    X,
    ChevronRight,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Type,
    Bold,
    Underline,
    List,
    ListOrdered,
    Eraser,
} from 'lucide-react'

const defaultPrimary = '#2563eb'

const EMPTY_DEPT_FORM = {
    name: '',
    code: '',
    description: '',
    parent_id: '',
    is_active: true,
    display_order: '',
}

const EMPTY_DRAFT_SERVICE = {
    name: '',
    code: '',
    unit: '',
    normal_range: '', // ✅ single field only
    comments_template: '',
    sample_type: '',
    method: '',
    display_order: '', // keep as string (no cursor jump)
    __advanced: false,
    __rangeOpen: false,
    __key: '',
}

// ---------- helpers ----------
function mkKey() {
    return (
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
}

function hexToRgba(hex, alpha = 0.12) {
    try {
        const h = (hex || '').replace('#', '').trim()
        if (h.length !== 6) return `rgba(37,99,235,${alpha})`
        const r = parseInt(h.slice(0, 2), 16)
        const g = parseInt(h.slice(2, 4), 16)
        const b = parseInt(h.slice(4, 6), 16)
        return `rgba(${r},${g},${b},${alpha})`
    } catch {
        return `rgba(37,99,235,${alpha})`
    }
}

function isProbablyHtml(s) {
    const v = (s || '').trim()
    if (!v) return false
    return /<\/?[a-z][\s\S]*>/i.test(v)
}

function htmlToText(html) {
    try {
        const doc = new DOMParser().parseFromString(html || '', 'text/html')
        const text = doc.body?.innerText ?? ''
        return text.replace(/\r\n/g, '\n').trim()
    } catch {
        return (html || '').replace(/\r\n/g, '\n').trim()
    }
}

function textToLines(s) {
    return (s || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((x) => x.trimEnd())
        .filter((x) => x.trim() !== '')
}

function normalRangePreview(v, max = 90) {
    const raw = (v || '').trim()
    if (!raw) return '-'
    const txt = isProbablyHtml(raw) ? htmlToText(raw) : raw
    const oneLine = txt.replace(/\s+/g, ' ').trim()
    return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}

// Very small sanitizer for stored HTML (avoid scripts/attrs)
function sanitizeHtml(inputHtml) {
    try {
        const allowedTags = new Set([
            'B',
            'STRONG',
            'U',
            'BR',
            'P',
            'DIV',
            'H1',
            'H2',
            'H3',
            'UL',
            'OL',
            'LI',
            'SPAN',
        ])
        const allowedAttrs = new Set(['style']) // if you want none, remove this

        const doc = new DOMParser().parseFromString(inputHtml || '', 'text/html')
        const all = doc.body.querySelectorAll('*')
        all.forEach((el) => {
            if (!allowedTags.has(el.tagName)) {
                // unwrap unknown tags
                const parent = el.parentNode
                while (el.firstChild) parent?.insertBefore(el.firstChild, el)
                parent?.removeChild(el)
                return
            }
            // remove dangerous attrs
            ;[...el.attributes].forEach((a) => {
                const name = a.name.toLowerCase()
                if (!allowedAttrs.has(name)) el.removeAttribute(a.name)
                if (name.startsWith('on')) el.removeAttribute(a.name)
            })
        })
        // remove scripts just in case
        doc.querySelectorAll('script').forEach((s) => s.remove())
        return doc.body.innerHTML
    } catch {
        return (inputHtml || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    }
}

function RichTextBox({ value, onChange }) {
    const ref = useRef(null)
    const lastSet = useRef('')

    // init / sync when external value changes
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const next = sanitizeHtml(value || '')
        if (next !== lastSet.current) {
            el.innerHTML = next
            lastSet.current = next
        }
    }, [value])

    function exec(cmd, arg) {
        try {
            document.execCommand(cmd, false, arg)
        } catch {
            // ignore
        }
        // trigger save
        const el = ref.current
        if (el) {
            const next = sanitizeHtml(el.innerHTML)
            lastSet.current = next
            onChange(next)
        }
    }

    return (
        <div className="rounded-3xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-2">
                <button
                    type="button"
                    onClick={() => exec('formatBlock', 'H1')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="H1"
                >
                    <Type className="h-3.5 w-3.5" /> H1
                </button>
                <button
                    type="button"
                    onClick={() => exec('bold')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Bold"
                >
                    <Bold className="h-3.5 w-3.5" /> B
                </button>
                <button
                    type="button"
                    onClick={() => exec('underline')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Underline"
                >
                    <Underline className="h-3.5 w-3.5" /> U
                </button>
                <button
                    type="button"
                    onClick={() => exec('insertUnorderedList')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Bullets"
                >
                    <List className="h-3.5 w-3.5" /> •
                </button>
                <button
                    type="button"
                    onClick={() => exec('insertOrderedList')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Numbered list"
                >
                    <ListOrdered className="h-3.5 w-3.5" /> 1.
                </button>
                <button
                    type="button"
                    onClick={() => exec('removeFormat')}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Clear formatting"
                >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                </button>

                <div className="ml-auto text-[11px] text-slate-500">
                    (Saved as HTML inside <span className="font-semibold">normal_range</span>)
                </div>
            </div>

            <div
                ref={ref}
                className="min-h-[120px] p-3 text-sm text-slate-900 outline-none"
                contentEditable
                suppressContentEditableWarning
                onInput={() => {
                    const el = ref.current
                    if (!el) return
                    const next = sanitizeHtml(el.innerHTML)
                    lastSet.current = next
                    onChange(next)
                }}
            />
        </div>
    )
}

function NormalRangeEditor({ value, onChange }) {
    const [tab, setTab] = useState('quick') // quick | text | rich

    const plain = useMemo(() => {
        const raw = (value || '').trim()
        if (!raw) return ''
        return isProbablyHtml(raw) ? htmlToText(raw) : raw
    }, [value])

    const [prefix, setPrefix] = useState('M')
    const [lineVal, setLineVal] = useState('')
    const [bullet, setBullet] = useState(false)

    const presets = [
        'M',
        'F',
        'Male',
        'Female',
        'Men',
        'Women',
        'Adult',
        'Child',
        'Pediatric',
        'Neonate',
        'Pregnant',
        'Ovulation peak',
        'Follicular phase',
        'Luteal Phase',
        'Menopause',
    ]

    function addLine() {
        const v = (lineVal || '').trim()
        if (!v) return

        const p = (prefix || '').trim()
        let line = ''
        if (p) line = `${p} - ${v}`
        else line = v

        if (bullet) line = `• ${line}`

        const nextLines = [...textToLines(plain), line]
        onChange(nextLines.join('\n'))
        setLineVal('')
    }

    function onKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault()
            addLine()
        }
    }

    function removeLineAt(i) {
        const lines = textToLines(plain)
        const next = lines.filter((_, idx) => idx !== i)
        onChange(next.join('\n'))
    }

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-semibold text-slate-800">Normal Range</div>
                    <div className="text-[11px] text-slate-500">
                        Enter quick lines like <span className="font-semibold">M - 27-55</span> or paste full block.
                    </div>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                    {[
                        { id: 'quick', label: 'Quick Add' },
                        { id: 'text', label: 'Free Text' },
                        { id: 'rich', label: 'Rich Editor' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                tab === t.id
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-700 hover:bg-white'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'quick' && (
                <>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-12">
                        <div className="md:col-span-3">
                            <label className="text-[11px] font-semibold text-slate-600">Prefix</label>
                            <input
                                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                placeholder="M / F / Women / Week 5…"
                                value={prefix}
                                onChange={(e) => setPrefix(e.target.value)}
                                onKeyDown={onKeyDown}
                            />
                            <div className="mt-2 flex flex-wrap gap-1">
                                {presets.slice(0, 8).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPrefix(p)}
                                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-7">
                            <label className="text-[11px] font-semibold text-slate-600">Value</label>
                            <input
                                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                placeholder="27-55  OR  Ovulation peak: 6.3-24.0  OR  < 5.00"
                                value={lineVal}
                                onChange={(e) => setLineVal(e.target.value)}
                                onKeyDown={onKeyDown}
                            />
                            <div className="mt-2 flex items-center gap-2">
                                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={bullet}
                                        onChange={(e) => setBullet(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                    />
                                    Bullet line
                                </label>
                                <div className="text-[11px] text-slate-500">
                                    Press <span className="font-semibold">Enter</span> to add
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex items-end">
                            <button
                                type="button"
                                onClick={addLine}
                                disabled={!lineVal.trim()}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Existing lines */}
                    <div className="mt-3">
                        {textToLines(plain).length ? (
                            <div className="space-y-2">
                                {textToLines(plain).map((l, idx) => (
                                    <div
                                        key={`${idx}-${l}`}
                                        className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                                    >
                                        <div className="min-w-0 whitespace-pre-line text-[11px] text-slate-700">
                                            {l}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeLineAt(idx)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                            title="Remove line"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                                No normal range lines yet.
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === 'text' && (
                <div className="mt-3">
                    <label className="text-[11px] font-semibold text-slate-600">
                        Free text (multi-line)
                    </label>
                    <textarea
                        rows={7}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        placeholder={`Example:\nWomen\nOvulation peak: 6.3-24.0\nFollicular phase\n1st half: 3.9-12\n2nd half: 2.9-9.0\n...`}
                        value={plain}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <div className="mt-2 text-[11px] text-slate-500">
                        Tip: This matches your printed report style (line by line).
                    </div>
                </div>
            )}

            {tab === 'rich' && (
                <div className="mt-3">
                    <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        Rich editor saves HTML inside <span className="font-semibold">normal_range</span>. Your PDF/print
                        should render HTML (or convert to text) to avoid showing tags.
                    </div>
                    <RichTextBox value={value || ''} onChange={onChange} />
                </div>
            )}
        </div>
    )
}

export default function LisMasters() {
    const { branding } = useBranding() || {}
    const primary = branding?.primary_color || defaultPrimary
    const primaryTint = hexToRgba(primary, 0.10)
    const primaryTint2 = hexToRgba(primary, 0.06)

    // Permissions
    const canViewDepts = useCan('lis.masters.departments.view')
    const canManageDeptsCreate = useCan('lis.masters.departments.create')
    const canManageDeptsUpdate = useCan('lis.masters.departments.update')
    const canManageDeptsDelete = useCan('lis.masters.departments.delete')

    const canViewServices = useCan('lis.masters.services.view')
    const canCreateServices = useCan('lis.masters.services.create')
    const canUpdateServices = useCan('lis.masters.services.update')
    const canDeleteServices = useCan('lis.masters.services.delete')

    // Departments state
    const [departments, setDepartments] = useState([])
    const [loadingDepts, setLoadingDepts] = useState(false)
    const [deptSearch, setDeptSearch] = useState('')
    const [selectedDeptId, setSelectedDeptId] = useState(null)

    // Dept modal
    const [deptModalOpen, setDeptModalOpen] = useState(false)
    const [editingDept, setEditingDept] = useState(null)
    const [deptForm, setDeptForm] = useState(EMPTY_DEPT_FORM)
    const [savingDept, setSavingDept] = useState(false)

    // Services state
    const [services, setServices] = useState([])
    const [draftRows, setDraftRows] = useState([])
    const [loadingServices, setLoadingServices] = useState(false)
    const [serviceSearch, setServiceSearch] = useState('')
    const [showInactiveServices, setShowInactiveServices] = useState(false)

    const [editingServiceId, setEditingServiceId] = useState(null)
    const [serviceEditBuffer, setServiceEditBuffer] = useState(null)
    const [savingServiceId, setSavingServiceId] = useState(null)
    const [bulkSaving, setBulkSaving] = useState(false)

    // inline normal range editor (single open at a time)
    const [rangeOpenServiceId, setRangeOpenServiceId] = useState(null)

    // Ensure every draft row always has a unique key
    useEffect(() => {
        setDraftRows((prev) => {
            let changed = false
            const next = prev.map((r) => {
                if (r?.__key) return r
                changed = true
                return { ...EMPTY_DRAFT_SERVICE, ...r, __key: mkKey() }
            })
            return changed ? next : prev
        })
    }, [draftRows.length])

    // ------------- Derived -------------

    const topLevelDepts = useMemo(
        () => departments.filter((d) => !d.parent_id),
        [departments]
    )

    const subDeptsByParent = useMemo(() => {
        const map = {}
        departments.forEach((d) => {
            if (d.parent_id) {
                if (!map[d.parent_id]) map[d.parent_id] = []
                map[d.parent_id].push(d)
            }
        })
        return map
    }, [departments])

    const filteredTopLevelDepts = useMemo(() => {
        const term = deptSearch.trim().toLowerCase()
        if (!term) return topLevelDepts
        return topLevelDepts.filter((d) =>
            [d.name, d.code].some((x) => (x || '').toString().toLowerCase().includes(term))
        )
    }, [deptSearch, topLevelDepts])

    const selectedDept = useMemo(
        () => departments.find((d) => d.id === selectedDeptId) || null,
        [departments, selectedDeptId]
    )

    const filteredServices = useMemo(() => {
        const term = serviceSearch.trim().toLowerCase()
        return services.filter((s) => {
            if (!showInactiveServices && !s.is_active) return false
            if (!term) return true
            return [s.name, s.code, s.sample_type, s.method].some((x) =>
                (x || '').toString().toLowerCase().includes(term)
            )
        })
    }, [services, serviceSearch, showInactiveServices])

    // ------------- Loaders -------------

    useEffect(() => {
        if (!canViewDepts) return
        loadDepartments()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canViewDepts])

    useEffect(() => {
        if (!selectedDept || !canViewServices) {
            setServices([])
            setDraftRows([])
            setEditingServiceId(null)
            setServiceEditBuffer(null)
            setRangeOpenServiceId(null)
            return
        }
        loadServicesForDept(selectedDept.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeptId, canViewServices, showInactiveServices])

    async function loadDepartments() {
        try {
            setLoadingDepts(true)
            const res = await listLabDepartments({ active_only: true })
            setDepartments(res.data || [])
            if (!selectedDeptId && res.data?.length) {
                setSelectedDeptId(res.data[0].id)
            }
        } catch (err) {
            console.error('Failed to load lab departments', err)
            toast.error('Failed to load lab departments')
        } finally {
            setLoadingDepts(false)
        }
    }

    async function loadServicesForDept(deptId) {
        try {
            setLoadingServices(true)
            const res = await listLabServices({
                department_id: deptId,
                active_only: !showInactiveServices,
            })
            setServices(res.data || [])
            setDraftRows([])
            setEditingServiceId(null)
            setServiceEditBuffer(null)
            setRangeOpenServiceId(null)
        } catch (err) {
            console.error('Failed to load lab services', err)
            toast.error('Failed to load lab services')
        } finally {
            setLoadingServices(false)
        }
    }

    // ------------- Dept Modal -------------

    function openNewDeptModal(parentId = null) {
        setEditingDept(null)
        setDeptForm({ ...EMPTY_DEPT_FORM, parent_id: parentId || '' })
        setDeptModalOpen(true)
    }

    function openEditDeptModal(dept) {
        setEditingDept(dept)
        setDeptForm({
            name: dept.name || '',
            code: dept.code || '',
            description: dept.description || '',
            parent_id: dept.parent_id || '',
            is_active: dept.is_active,
            display_order: dept.display_order ?? '',
        })
        setDeptModalOpen(true)
    }

    function handleDeptFormChange(e) {
        const { name, value, type, checked } = e.target
        setDeptForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    async function handleDeptSave(e) {
        e?.preventDefault()
        if (!deptForm.name.trim()) {
            toast.error('Department name is required')
            return
        }

        const payload = {
            name: deptForm.name.trim(),
            code: deptForm.code?.trim() || null,
            description: deptForm.description?.trim() || null,
            parent_id: deptForm.parent_id || null,
            is_active: deptForm.is_active,
            display_order: deptForm.display_order !== '' ? Number(deptForm.display_order) : null,
        }

        try {
            setSavingDept(true)
            if (editingDept) {
                await updateLabDepartment(editingDept.id, payload)
                toast.success('Department updated')
            } else {
                await createLabDepartment(payload)
                toast.success('Department created')
            }
            setDeptModalOpen(false)
            setEditingDept(null)
            setDeptForm(EMPTY_DEPT_FORM)
            await loadDepartments()
        } catch (err) {
            console.error('Failed to save department', err)
            toast.error('Failed to save department')
        } finally {
            setSavingDept(false)
        }
    }

    async function handleDeptDelete(dept) {
        if (!window.confirm(`Delete department "${dept.name}"?`)) return
        try {
            await deleteLabDepartment(dept.id)
            toast.success('Department deleted')
            if (dept.id === selectedDeptId) setSelectedDeptId(null)
            await loadDepartments()
        } catch (err) {
            console.error('Failed to delete department', err)
            toast.error('Failed to delete department')
        }
    }

    // ------------- Draft rows (Bulk Add) -------------

    const stopKeys = useCallback((e) => {
        e.stopPropagation()
    }, [])

    const addDraftRow = useCallback(() => {
        if (!selectedDept) {
            toast.error('Select a department first')
            return
        }
        setDraftRows((prev) => [...prev, { ...EMPTY_DRAFT_SERVICE, __key: mkKey() }])
    }, [selectedDept])

    const updateDraft = useCallback((key, field, value) => {
        setDraftRows((prev) => prev.map((r) => (r.__key === key ? { ...r, [field]: value } : r)))
    }, [])

    const toggleDraftAdv = useCallback((key) => {
        setDraftRows((prev) =>
            prev.map((r) => (r.__key === key ? { ...r, __advanced: !r.__advanced } : r))
        )
    }, [])

    const toggleDraftRange = useCallback((key) => {
        setDraftRows((prev) =>
            prev.map((r) => (r.__key === key ? { ...r, __rangeOpen: !r.__rangeOpen } : r))
        )
    }, [])

    const removeDraft = useCallback((key) => {
        setDraftRows((prev) => prev.filter((r) => r.__key !== key))
    }, [])

    async function handleBulkSave() {
        if (!selectedDept) return

        const cleaned = draftRows
            .map((r) => {
                return {
                    name: (r.name || '').trim(),
                    department_id: selectedDept.id,

                    code: r.code?.trim() || null,
                    unit: (r.unit || '').trim() || '-', // NABH friendly: keep "-"

                    // ✅ Single field only
                    normal_range: (r.normal_range || '').trim() || '-',

                    comments_template: (r.comments_template || '').trim() || null,
                    sample_type: (r.sample_type || '').trim() || null,
                    method: (r.method || '').trim() || null,
                    display_order: r.display_order !== '' ? Number(r.display_order) : null,
                }
            })
            .filter((r) => r.name)

        if (!cleaned.length) {
            toast.error('Add at least one row with Name')
            return
        }

        try {
            setBulkSaving(true)
            await bulkCreateLabServices(cleaned)
            toast.success('Services saved')
            await loadServicesForDept(selectedDept.id)
        } catch (err) {
            console.error('Failed to bulk-create services', err)
            toast.error('Failed to save services')
        } finally {
            setBulkSaving(false)
        }
    }

    // ------------- Existing services edit -------------

    function startEditService(svc) {
        setEditingServiceId(svc.id)
        setRangeOpenServiceId(null)
        setServiceEditBuffer({
            ...svc,
            display_order: svc.display_order ?? '',
            normal_range: svc.normal_range ?? '',
        })
    }

    function cancelEditService() {
        setEditingServiceId(null)
        setServiceEditBuffer(null)
        setRangeOpenServiceId(null)
    }

    function handleServiceEditChange(field, value) {
        setServiceEditBuffer((prev) => ({ ...prev, [field]: value }))
    }

    function toggleServiceRange(svcId) {
        if (editingServiceId !== svcId) return
        setRangeOpenServiceId((cur) => (cur === svcId ? null : svcId))
    }

    async function saveServiceEdit() {
        if (!editingServiceId || !serviceEditBuffer) return

        const payload = {
            name: serviceEditBuffer.name?.trim() || '',
            code: serviceEditBuffer.code?.trim() || null,
            unit: serviceEditBuffer.unit?.trim() || '-',

            // ✅ Single field only
            normal_range: (serviceEditBuffer.normal_range || '').trim() || '-',

            sample_type: serviceEditBuffer.sample_type?.trim() || null,
            method: serviceEditBuffer.method?.trim() || null,
            comments_template: serviceEditBuffer.comments_template?.trim() || null,

            is_active: !!serviceEditBuffer.is_active,
            display_order:
                serviceEditBuffer.display_order !== ''
                    ? Number(serviceEditBuffer.display_order)
                    : null,
        }

        if (!payload.name) {
            toast.error('Service name is required')
            return
        }

        try {
            setSavingServiceId(editingServiceId)
            await updateLabService(editingServiceId, payload)
            toast.success('Service updated')
            await loadServicesForDept(selectedDept.id)
            cancelEditService()
        } catch (err) {
            console.error('Failed to update service', err)
            toast.error('Failed to update service')
        } finally {
            setSavingServiceId(null)
        }
    }

    async function handleServiceDelete(svc) {
        if (!window.confirm(`Delete service "${svc.name}"?`)) return
        try {
            await deleteLabService(svc.id)
            toast.success('Service deleted')
            await loadServicesForDept(selectedDept.id)
        } catch (err) {
            console.error('Failed to delete service', err)
            toast.error('Failed to delete service')
        }
    }

    // ------------- Render helpers -------------

    function renderDeptRow(dept) {
        const subDepts = subDeptsByParent[dept.id] || []
        const isSelected = dept.id === selectedDeptId

        return (
            <div key={dept.id} className="mb-1">
                <div
                    className={`group flex items-center justify-between rounded-2xl px-3 py-2 text-sm cursor-pointer border transition-all ${
                        isSelected
                            ? 'border-transparent'
                            : 'border-transparent hover:border-slate-200'
                    }`}
                    style={{
                        background: isSelected
                            ? `linear-gradient(180deg, ${hexToRgba(primary, 0.12)}, rgba(255,255,255,0.55))`
                            : 'transparent',
                    }}
                    onClick={() => setSelectedDeptId(dept.id)}
                >
                    <div className="flex items-center gap-2">
                        <ChevronRight
                            className={`h-3 w-3 text-slate-400 transition-transform ${
                                subDepts.length ? 'group-hover:translate-x-0.5' : 'opacity-0'
                            }`}
                        />
                        <div>
                            <div className="font-medium text-slate-800 flex items-center gap-2">
                                {dept.name}
                                {!dept.is_active && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            {dept.code && (
                                <div className="text-[11px] text-slate-500">Code: {dept.code}</div>
                            )}
                        </div>
                    </div>

                    {(canManageDeptsUpdate || canManageDeptsDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canManageDeptsUpdate && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        openEditDeptModal(dept)
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50"
                                    title="Edit department"
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                            )}
                            {canManageDeptsDelete && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeptDelete(dept)
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-100 bg-white text-xs text-rose-600 hover:bg-rose-50"
                                    title="Delete department"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {subDepts.length > 0 && (
                    <div className="ml-4 border-l border-dashed border-slate-200 pl-3">
                        {subDepts.map((child) => renderDeptRow(child))}
                    </div>
                )}
            </div>
        )
    }

    if (!canViewDepts && !canViewServices) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                You do not have permission to view LIS Masters.
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: hexToRgba(primary, 0.12) }}
                    >
                        <FlaskConical className="h-5 w-5" style={{ color: primary }} />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-900">
                            Laboratory Report Masters
                        </h1>
                        <p className="text-xs text-slate-500">
                            Configure LIS departments and test master services for NABH-compliant lab reports.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid flex-1 gap-4 xl:grid-cols-[340px,1fr] lg:grid-cols-[300px,1fr]">
                {/* Left – Departments */}
                <div className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-800">
                            Departments & Sub-departments
                        </h2>
                        {canManageDeptsCreate && (
                            <button
                                type="button"
                                onClick={() => openNewDeptModal(null)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-slate-800"
                            >
                                <Plus className="h-3 w-3" />
                                Add
                            </button>
                        )}
                    </div>

                    <div className="mb-3 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                className="h-8 w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                                placeholder="Search departments..."
                                value={deptSearch}
                                onChange={(e) => setDeptSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={loadDepartments}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            title="Refresh"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="scrollbar-thin flex-1 overflow-y-auto rounded-3xl bg-slate-50/60 p-2">
                        {loadingDepts ? (
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                Loading departments…
                            </div>
                        ) : filteredTopLevelDepts.length ? (
                            filteredTopLevelDepts.map((d) => renderDeptRow(d))
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center text-xs text-slate-500">
                                <FlaskConical className="h-4 w-4 text-slate-300" />
                                <p>No departments yet.</p>
                                {canManageDeptsCreate && (
                                    <button
                                        type="button"
                                        onClick={() => openNewDeptModal(null)}
                                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add first department
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedDept && canManageDeptsCreate && (
                        <button
                            type="button"
                            onClick={() => openNewDeptModal(selectedDept.id)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-white"
                        >
                            <Plus className="h-3 w-3" />
                            Add sub-department under{' '}
                            <span className="font-semibold">{selectedDept.name}</span>
                        </button>
                    )}
                </div>

                {/* Right – Services */}
                <div className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">
                                {selectedDept
                                    ? `Services for ${selectedDept.name}`
                                    : 'Select a department'}
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Normal range is stored as a single field (supports multiline / optional rich text).
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Filter className="pointer-events-none absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                                <input
                                    type="text"
                                    className="h-8 w-44 rounded-full border border-slate-200 bg-slate-50 pl-7 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                                    placeholder="Filter services…"
                                    value={serviceSearch}
                                    onChange={(e) => setServiceSearch(e.target.value)}
                                    disabled={!selectedDept || !canViewServices}
                                />
                            </div>

                            <button
                                type="button"
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                                    showInactiveServices
                                        ? 'border-slate-800 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-600'
                                }`}
                                onClick={() => setShowInactiveServices((prev) => !prev)}
                                disabled={!selectedDept || !canViewServices}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Inactive
                            </button>
                        </div>
                    </div>

                    {/* Bulk Add */}
                    {selectedDept && canCreateServices && (
                        <div
                            className="mb-3 overflow-hidden rounded-3xl border border-slate-200/70 shadow-sm"
                            style={{
                                backgroundImage: `linear-gradient(180deg, ${primaryTint}, rgba(255,255,255,0.92))`,
                            }}
                        >
                            <div className="flex flex-col gap-2 border-b border-slate-200/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        Bulk Add
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        Main: Name / Code / Unit / Normal Range / Comments.
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-700"
                                        style={{ backgroundColor: primaryTint2 }}
                                    >
                                        • Dept:{' '}
                                        <span className="font-semibold">{selectedDept.name}</span>
                                    </span>

                                    <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-700">
                                        Rows: <span className="font-semibold">{draftRows.length}</span>
                                    </span>

                                    <button
                                        type="button"
                                        onClick={addDraftRow}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Row
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleBulkSave}
                                        disabled={!draftRows.length || bulkSaving}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {bulkSaving ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4" />
                                        )}
                                        Save All
                                    </button>
                                </div>
                            </div>

                            <div className="px-4 py-4">
                                {!draftRows.length ? (
                                    <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-600">
                                        Click <span className="font-semibold">Add Row</span> to start adding tests.
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        <div className="hidden xl:grid grid-cols-12 gap-3 px-2 text-[11px] font-semibold text-slate-600">
                                            <div className="col-span-4">Name *</div>
                                            <div className="col-span-2">Code</div>
                                            <div className="col-span-2">Unit</div>
                                            <div className="col-span-2">Normal Range</div>
                                            <div className="col-span-2 text-right">Actions</div>
                                        </div>

                                        {draftRows.map((r) => {
                                            const preview = normalRangePreview(r.normal_range)
                                            return (
                                                <div
                                                    key={r.__key}
                                                    className="rounded-3xl border border-slate-200 bg-white/75 p-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
                                                    onKeyDownCapture={stopKeys}
                                                >
                                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-3">
                                                        <div className="xl:col-span-4">
                                                            <label className="xl:hidden text-[11px] font-semibold text-slate-600">
                                                                Name *
                                                            </label>
                                                            <input
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                placeholder="Service name (required)"
                                                                value={r.name}
                                                                onChange={(e) =>
                                                                    updateDraft(r.__key, 'name', e.target.value)
                                                                }
                                                            />
                                                        </div>

                                                        <div className="xl:col-span-2">
                                                            <label className="xl:hidden text-[11px] font-semibold text-slate-600">
                                                                Code
                                                            </label>
                                                            <input
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                placeholder="Optional"
                                                                value={r.code}
                                                                onChange={(e) =>
                                                                    updateDraft(r.__key, 'code', e.target.value)
                                                                }
                                                            />
                                                        </div>

                                                        <div className="xl:col-span-2">
                                                            <label className="xl:hidden text-[11px] font-semibold text-slate-600">
                                                                Unit
                                                            </label>
                                                            <input
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                placeholder="-"
                                                                value={r.unit}
                                                                onChange={(e) =>
                                                                    updateDraft(r.__key, 'unit', e.target.value)
                                                                }
                                                            />
                                                        </div>

                                                        <div className="xl:col-span-2">
                                                            <label className="xl:hidden text-[11px] font-semibold text-slate-600">
                                                                Normal Range
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleDraftRange(r.__key)}
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50"
                                                                title={preview === '-' ? '' : preview}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-semibold text-slate-700">
                                                                            {r.normal_range?.trim()
                                                                                ? 'Edit normal range'
                                                                                : 'Add normal range'}
                                                                        </div>
                                                                        <div className="truncate text-[11px] text-slate-500">
                                                                            {preview}
                                                                        </div>
                                                                    </div>
                                                                    {r.__rangeOpen ? (
                                                                        <ChevronUp className="h-4 w-4 text-slate-500" />
                                                                    ) : (
                                                                        <ChevronDown className="h-4 w-4 text-slate-500" />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        </div>

                                                        <div className="xl:col-span-2 flex items-center justify-between xl:justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleDraftAdv(r.__key)}
                                                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                {r.__advanced ? (
                                                                    <>
                                                                        <ChevronUp className="h-4 w-4" /> Details
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <ChevronDown className="h-4 w-4" /> Details
                                                                    </>
                                                                )}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => removeDraft(r.__key)}
                                                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                                                title="Remove row"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3">
                                                        <label className="text-[11px] font-semibold text-slate-600">
                                                            Comments
                                                        </label>
                                                        <input
                                                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                            placeholder="Optional default comments for report…"
                                                            value={r.comments_template}
                                                            onChange={(e) =>
                                                                updateDraft(
                                                                    r.__key,
                                                                    'comments_template',
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    {r.__rangeOpen && (
                                                        <div className="mt-3">
                                                            <NormalRangeEditor
                                                                value={r.normal_range}
                                                                onChange={(next) =>
                                                                    updateDraft(r.__key, 'normal_range', next)
                                                                }
                                                            />
                                                        </div>
                                                    )}

                                                    {r.__advanced && (
                                                        <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50/60 p-3">
                                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                                <div>
                                                                    <label className="text-[11px] font-semibold text-slate-600">
                                                                        Sample Type
                                                                    </label>
                                                                    <input
                                                                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                        placeholder="Serum / Plasma…"
                                                                        value={r.sample_type}
                                                                        onChange={(e) =>
                                                                            updateDraft(
                                                                                r.__key,
                                                                                'sample_type',
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="text-[11px] font-semibold text-slate-600">
                                                                        Method
                                                                    </label>
                                                                    <input
                                                                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                        placeholder="Analyzer / Manual…"
                                                                        value={r.method}
                                                                        onChange={(e) =>
                                                                            updateDraft(
                                                                                r.__key,
                                                                                'method',
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="text-[11px] font-semibold text-slate-600">
                                                                        Display Order
                                                                    </label>
                                                                    <input
                                                                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                        placeholder="Optional"
                                                                        inputMode="numeric"
                                                                        value={r.display_order}
                                                                        onChange={(e) => {
                                                                            const v = e.target.value
                                                                            if (!/^[0-9]*$/.test(v)) return
                                                                            updateDraft(r.__key, 'display_order', v)
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 text-[11px] text-slate-500">
                                                                Advanced fields are optional — keep default entry fast and clean.
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Existing Services Table */}
                    <div className="scrollbar-thin flex-1 overflow-auto rounded-3xl border border-slate-100">
                        {!selectedDept ? (
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                Select a department on the left to view / add services.
                            </div>
                        ) : loadingServices ? (
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                Loading services…
                            </div>
                        ) : (
                            <table className="min-w-full border-separate border-spacing-0 text-xs">
                                <thead className="sticky top-0 z-10 bg-slate-50">
                                    <tr>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            #
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Service Name
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Code
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Unit
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Normal Range
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Sample Type
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Method
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Comments
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                                            Active
                                        </th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-right font-medium text-slate-600">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredServices.map((svc, idx) => {
                                        const isEditing = editingServiceId === svc.id
                                        const buf = isEditing ? serviceEditBuffer : svc
                                        const preview = normalRangePreview(buf?.normal_range)
                                        const isOpen = rangeOpenServiceId === svc.id

                                        return (
                                            <Fragment key={svc.id}>
                                                <tr className={idx % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                                                    <td className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                                                        {idx + 1}
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            value={buf?.name || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('name', e.target.value)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            value={buf?.code || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('code', e.target.value)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            placeholder="-"
                                                            value={buf?.unit || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('unit', e.target.value)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <div className="flex items-center gap-2">
                                                            {/* <div className="min-w-0 flex-1">
                                                                <div
                                                                    className="truncate text-[11px] text-slate-700"
                                                                    title={preview === '-' ? '' : preview}
                                                                >
                                                                    {preview}
                                                                </div>
                                                            </div> */}

                                                            {isEditing && canUpdateServices ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleServiceRange(svc.id)}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                                                    title="Edit normal range"
                                                                >
                                                                    {isOpen ? (
                                                                        <>
                                                                            <ChevronUp className="h-3 w-3" /> Range
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <ChevronDown className="h-3 w-3" /> Range
                                                                        </>
                                                                    )}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            value={buf?.sample_type || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('sample_type', e.target.value)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            value={buf?.method || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('method', e.target.value)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <textarea
                                                            rows={1}
                                                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                            value={buf?.comments_template || ''}
                                                            onChange={(e) =>
                                                                handleServiceEditChange(
                                                                    'comments_template',
                                                                    e.target.value
                                                                )
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5">
                                                        <input
                                                            type="checkbox"
                                                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                                            checked={!!buf?.is_active}
                                                            onChange={(e) =>
                                                                handleServiceEditChange('is_active', e.target.checked)
                                                            }
                                                            disabled={!canUpdateServices || !isEditing}
                                                        />
                                                    </td>

                                                    <td className="border-b border-slate-100 px-3 py-1.5 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {canUpdateServices && (
                                                                <>
                                                                    {isEditing ? (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={saveServiceEdit}
                                                                                disabled={savingServiceId === svc.id}
                                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                                                                                title="Save"
                                                                            >
                                                                                <Save className="h-3 w-3" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditService}
                                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                                                title="Cancel"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => startEditService(svc)}
                                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                                            title="Edit"
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {canDeleteServices && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleServiceDelete(svc)}
                                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isEditing && isOpen && (
                                                    <tr className={idx % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                                                        <td colSpan={10} className="border-b border-slate-100 px-3 py-3">
                                                            <NormalRangeEditor
                                                                value={serviceEditBuffer?.normal_range}
                                                                onChange={(next) => {
                                                                    handleServiceEditChange('normal_range', next)
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })}

                                    {!filteredServices.length && (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-6 text-center text-[11px] text-slate-500">
                                                No services found for this department.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Dept modal */}
            {deptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-3xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    {editingDept ? 'Edit Department' : 'Add Department'}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {deptForm.parent_id
                                        ? 'This will be created as a sub-department.'
                                        : 'Top level department.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setDeptModalOpen(false)
                                    setEditingDept(null)
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleDeptSave} className="space-y-3 px-4 py-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700">
                                    Department name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
                                    value={deptForm.name}
                                    onChange={handleDeptFormChange}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-700">Code</label>
                                    <input
                                        name="code"
                                        type="text"
                                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
                                        value={deptForm.code}
                                        onChange={handleDeptFormChange}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-700">
                                        Display Order
                                    </label>
                                    <input
                                        name="display_order"
                                        type="number"
                                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
                                        value={deptForm.display_order || ''}
                                        onChange={handleDeptFormChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700">
                                    Parent Department (for sub-department)
                                </label>
                                <select
                                    name="parent_id"
                                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
                                    value={deptForm.parent_id || ''}
                                    onChange={handleDeptFormChange}
                                >
                                    <option value="">None (Top level)</option>
                                    {topLevelDepts.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700">Description</label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
                                    value={deptForm.description}
                                    onChange={handleDeptFormChange}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 text-[12px] text-slate-700">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                        checked={deptForm.is_active}
                                        onChange={handleDeptFormChange}
                                    />
                                    Active department
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeptModalOpen(false)
                                            setEditingDept(null)
                                        }}
                                        className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingDept}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {savingDept && <RefreshCw className="h-4 w-4 animate-spin" />}
                                        {editingDept ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
