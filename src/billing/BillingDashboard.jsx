// FILE: src/billing/BillingDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { billingListCases, isCanceledError } from "@/api/billings"
import { billingSearchPatients, billingListPatientEncounters, billingCreateCaseManual } from "@/api/billings"
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    EmptyState,
    Field,
    Input,
    Select,
    StatusBadge,
    cn,
} from "./_ui"
import { ArrowRight, RefreshCcw, Search, Filter, Plus, X, CheckCircle2 } from "lucide-react"

const ENCOUNTERS = ["ALL", "OP", "IP", "OT", "ER"]
const CASE_STATUSES = ["ALL", "OPEN", "READY_FOR_POST", "CLOSED", "CANCELLED"]
const MANUAL_TYPES = ["OP", "IP", "OT", "ER"]

function safeApiDetail(err) {
    // axios error shape: err.response.data.detail
    const d = err?.response?.data?.detail
    if (!d) return null
    return d
}

function formatDT(dt) {
    if (!dt) return "—"
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d)
}

export default function BillingDashboard() {
    const nav = useNavigate()
    const [sp] = useSearchParams()

    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [meta, setMeta] = useState({ total: 0, page: 1, page_size: 20 })

    const abortRef = useRef(null)

    // Manual Create Case modal
    const [openCreate, setOpenCreate] = useState(false)

    const filters = useMemo(() => {
        return {
            q: sp.get("q") || "",
            encounter_type: sp.get("encounter_type") || "ALL",
            status: sp.get("status") || "ALL",
            page: Number(sp.get("page") || 1),
            page_size: Number(sp.get("page_size") || 20),
        }
    }, [sp])

    function setFilter(key, value) {
        const u = new URLSearchParams(sp)
        if (value === "" || value == null) u.delete(key)
        else u.set(key, String(value))
        if (key !== "page") u.set("page", "1")
        nav({ search: u.toString() })
    }

    async function load() {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const params = {
                q: filters.q || undefined,
                encounter_type: filters.encounter_type !== "ALL" ? filters.encounter_type : undefined,
                status: filters.status !== "ALL" ? filters.status : undefined,
                page: filters.page,
                page_size: filters.page_size,
            }

            const data = await billingListCases(params, { signal: ac.signal })
            const items = Array.isArray(data) ? data : (data?.items ?? [])

            setRows(items)
            setMeta({
                total: Number(data?.total ?? items.length ?? 0),
                page: Number(data?.page ?? filters.page),
                page_size: Number(data?.page_size ?? filters.page_size),
            })
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load billing cases")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q, filters.encounter_type, filters.status, filters.page, filters.page_size])

    const quick = useMemo(() => {
        const total = meta.total || rows.length
        const open = rows.filter((r) => String(r.status || "").toUpperCase() === "OPEN").length
        const ready = rows.filter((r) => String(r.status || "").toUpperCase().includes("READY")).length
        const closed = rows.filter((r) => String(r.status || "").toUpperCase() === "CLOSED").length
        return { total, open, ready, closed }
    }, [rows, meta.total])

    const disableNext = rows.length < meta.page_size

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-xl font-extrabold text-slate-900">Billing</div>
                    <div className="text-xs text-slate-500">Cases, invoices, payments and posting — all in one place.</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setOpenCreate(true)}>
                        <Plus className="h-4 w-4" />
                        New Case
                    </Button>

                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Quick stats */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card>
                    <CardBody className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500">Total</div>
                            <div className="text-lg font-extrabold text-slate-900">{quick.total}</div>
                        </div>
                        <Badge tone="violet">Cases</Badge>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500">Open (this page)</div>
                            <div className="text-lg font-extrabold text-slate-900">{quick.open}</div>
                        </div>
                        <Badge tone="blue">Active</Badge>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500">Ready (this page)</div>
                            <div className="text-lg font-extrabold text-slate-900">{quick.ready}</div>
                        </div>
                        <Badge tone="amber">Posting</Badge>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500">Closed (this page)</div>
                            <div className="text-lg font-extrabold text-slate-900">{quick.closed}</div>
                        </div>
                        <Badge tone="green">Done</Badge>
                    </CardBody>
                </Card>
            </div>

            {/* Filters */}
            <Card className="mb-4">
                <CardHeader
                    title="Search & Filters"
                    right={
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Filter className="h-4 w-4" /> Use filters to narrow results
                        </div>
                    }
                />
                <CardBody>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Field label="Search">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Case no / Patient / UHID / Phone / Encounter id"
                                    value={filters.q}
                                    onChange={(e) => setFilter("q", e.target.value)}
                                />
                            </div>
                        </Field>

                        <Field label="Encounter Type">
                            <Select value={filters.encounter_type} onChange={(e) => setFilter("encounter_type", e.target.value)}>
                                <EncounterOptions />
                            </Select>
                        </Field>

                        <Field label="Status">
                            <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                                {CASE_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        <Field label="Page Size">
                            <Select value={filters.page_size} onChange={(e) => setFilter("page_size", e.target.value)}>
                                {[10, 20, 30, 50, 100].map((n) => (
                                    <option key={n} value={n}>
                                        {n} / page
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                </CardBody>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader title="Billing Cases" subtitle="Open a case to manage invoices, payments and advances" />
                <CardBody>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <EmptyState title="No billing cases" desc="Try changing filters or search." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Case</th>
                                        <th className="py-3 pr-4">Patient</th>
                                        <th className="py-3 pr-4">Encounter</th>
                                        <th className="py-3 pr-4">Payer</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-0 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4">
                                                <div className="font-bold text-slate-900">{r.case_number || `#${r.id}`}</div>
                                                <div className="text-xs text-slate-500">Case ID: {r.id}</div>
                                            </td>

                                            <td className="py-3 pr-4">
                                                <div className="font-semibold text-slate-800">{r.patient_name || "—"}</div>
                                                <div className="text-xs text-slate-500">
                                                    UHID: {r.uhid || "—"} · Phone: {r.phone || "—"}
                                                </div>
                                                <div className="text-xs text-slate-500">Patient ID: {r.patient_id ?? "—"}</div>
                                            </td>

                                            <td className="py-3 pr-4">
                                                <div className="font-semibold text-slate-800">
                                                    {r.encounter_type || "—"} / {r.encounter_id ?? "—"}
                                                </div>
                                                <div className="text-xs text-slate-500">Tariff: {r.tariff_plan_id ?? "—"}</div>
                                            </td>

                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{r.payer_mode || "SELF"}</Badge>
                                            </td>

                                            <td className="py-3 pr-4">
                                                <StatusBadge status={r.status} />
                                            </td>

                                            <td className="py-3 pr-0 text-right">
                                                <Button variant="outline" onClick={() => nav(`/billing/cases/${r.id}`)}>
                                                    Open <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-slate-500">
                                    Showing page <b>{meta.page}</b> · Total <b>{meta.total}</b>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" disabled={meta.page <= 1} onClick={() => setFilter("page", Math.max(1, meta.page - 1))}>
                                        Prev
                                    </Button>
                                    <Button variant="outline" disabled={disableNext} onClick={() => setFilter("page", meta.page + 1)}>
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Manual Create Case Modal */}
            {openCreate && (
                <CreateCaseModal
                    onClose={() => setOpenCreate(false)}
                    onCreated={(caseId) => {
                        setOpenCreate(false)
                        load()
                        nav(`/billing/cases/${caseId}`)
                    }}
                    onOpenExisting={(caseId) => {
                        setOpenCreate(false)
                        nav(`/billing/cases/${caseId}`)
                    }}
                />
            )}
        </div>
    )
}

function EncounterOptions() {
    return ENCOUNTERS.map((e) => (
        <option key={e} value={e}>
            {e}
        </option>
    ))
}

function CreateCaseModal({ onClose, onCreated, onOpenExisting }) {
    const [step, setStep] = useState(1)

    // Patient search
    const [pq, setPq] = useState("")
    const [pLoading, setPLoading] = useState(false)
    const [patients, setPatients] = useState([])
    const [patient, setPatient] = useState(null)

    // Encounter
    const [etype, setEtype] = useState("OP")
    const [eLoading, setELoading] = useState(false)
    const [encounters, setEncounters] = useState([])
    const [encounterId, setEncounterId] = useState(null)

    const pAbort = useRef(null)
    const eAbort = useRef(null)
    const debounceRef = useRef(null)

    useEffect(() => {
        // debounce patient search
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            const q = (pq || "").trim()
            if (q.length < 2) {
                setPatients([])
                return
            }
            pAbort.current?.abort?.()
            const ac = new AbortController()
            pAbort.current = ac

            setPLoading(true)
            try {
                const data = await billingSearchPatients({ q, limit: 20 }, { signal: ac.signal })
                setPatients(data?.items ?? [])
            } catch (e) {
                if (!isCanceledError(e)) toast.error(e?.message || "Failed to search patients")
            } finally {
                setPLoading(false)
            }
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [pq])

    async function loadEncounters(pid, t) {
        if (!pid || !t) return
        eAbort.current?.abort?.()
        const ac = new AbortController()
        eAbort.current = ac

        setELoading(true)
        setEncounters([])
        setEncounterId(null)

        try {
            const data = await billingListPatientEncounters(pid, { encounter_type: t, limit: 100 }, { signal: ac.signal })
            setEncounters(data?.items ?? [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load encounters")
        } finally {
            setELoading(false)
        }
    }

    useEffect(() => {
        if (patient?.id && etype) loadEncounters(patient.id, etype)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id, etype])

    async function proceedCreate() {
        if (!patient?.id || !etype || !encounterId) return
        try {
            const res = await billingCreateCaseManual({
                patient_id: patient.id,
                encounter_type: etype,
                encounter_id: Number(encounterId),
            })

            const newId = res?.id || res?.case_id || res?.case?.id
            toast.success("Billing case created")
            onCreated?.(newId)
        } catch (e) {
            const detail = safeApiDetail(e)

            // Our backend sends 409 with dict detail for duplicate
            if (e?.response?.status === 409 && detail && typeof detail === "object") {
                const caseId = detail?.case_id
                const msg = detail?.message || "The selected patient and encounter id based Case Already available."
                toast(msg, {
                    action: caseId
                        ? {
                            label: "Open Case",
                            onClick: () => onOpenExisting?.(caseId),
                        }
                        : undefined,
                })
                return
            }

            toast.error(e?.message || "Failed to create case")
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <div className="text-sm font-extrabold text-slate-900">Create New Billing Case</div>
                        <div className="text-xs text-slate-500">Select patient → encounter type → encounter id → proceed</div>
                    </div>
                    <Button variant="outline" onClick={onClose}>
                        <X className="h-4 w-4" /> Close
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                    {/* Left: Patient */}
                    <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-bold text-slate-900">1) Select Patient</div>
                            <Badge tone="slate">Manual</Badge>
                        </div>

                        {patient ? (
                            <Card className="border border-emerald-100">
                                <CardBody className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <div className="font-bold text-slate-900">{patient.name || "—"}</div>
                                    </div>
                                    <div className="text-xs text-slate-500">UHID: {patient.uhid || "—"} · Phone: {patient.phone || "—"}</div>
                                    <div className="text-xs text-slate-500">Patient ID: {patient.id}</div>
                                    <div className="pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setPatient(null)
                                                setStep(1)
                                                setEncounters([])
                                                setEncounterId(null)
                                            }}
                                        >
                                            Change Patient
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ) : (
                            <>
                                <Field label="Search Patient (name / UHID / phone)">
                                    <Input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Type minimum 2 characters..." />
                                </Field>

                                <div className="mt-3">
                                    {pLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                                            ))}
                                        </div>
                                    ) : patients.length === 0 ? (
                                        <div className="text-xs text-slate-500">Search to see matching patients.</div>
                                    ) : (
                                        <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
                                            {patients.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setPatient(p)
                                                        setStep(2)
                                                    }}
                                                    className="flex w-full items-start justify-between gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                                                >
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900">{p.name || "—"}</div>
                                                        <div className="text-xs text-slate-500">
                                                            UHID: {p.uhid || "—"} · Phone: {p.phone || "—"}
                                                        </div>
                                                    </div>
                                                    <Badge tone="violet">Select</Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Encounter selection */}
                    <div className="p-5">
                        <div className="mb-3 text-sm font-bold text-slate-900">2) Select Encounter</div>

                        <div className="grid grid-cols-1 gap-3">
                            <Field label="Encounter Type">
                                <Select value={etype} onChange={(e) => setEtype(e.target.value)} disabled={!patient}>
                                    {MANUAL_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Encounter IDs (with Date & Time)">
                                <div className={cn("rounded-xl border border-slate-100 p-2", !patient ? "opacity-60" : "")}>
                                    {!patient ? (
                                        <div className="text-xs text-slate-500">Select a patient first.</div>
                                    ) : eLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                                            ))}
                                        </div>
                                    ) : encounters.length === 0 ? (
                                        <div className="text-xs text-slate-500">No encounters found for this patient and type.</div>
                                    ) : (
                                        <div className="max-h-72 overflow-auto">
                                            {encounters.map((e) => {
                                                const selected = String(encounterId) === String(e.encounter_id)
                                                return (
                                                    <button
                                                        key={String(e.encounter_id)}
                                                        type="button"
                                                        onClick={() => setEncounterId(e.encounter_id)}
                                                        className={cn(
                                                            "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left",
                                                            selected ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-900">
                                                                {etype} / {e.encounter_id}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{formatDT(e.encounter_at)}</div>
                                                        </div>
                                                        <div className={cn("text-xs", selected ? "text-emerald-700" : "text-slate-400")}>
                                                            {selected ? "Selected" : "Select"}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Field>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={proceedCreate}
                                    disabled={!patient?.id || !etype || !encounterId}
                                >
                                    Proceed & Create Case
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="text-xs text-slate-500">
                                Note: If a case already exists for the selected encounter, system will block duplicate and show “Open Case”.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
