// FILE: frontend/src/ot/OtMasters.jsx
import { useEffect, useMemo, useState, useCallback } from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    Search,
    Filter,
    Stethoscope,
    Building2,
    Boxes,
    Activity,
    ShieldCheck,
    Wrench,
} from "lucide-react"

import { useCanAny } from "../hooks/useCan"

import {
    listOtSurgeries,
    createOtSurgery,
    updateOtSurgery,
    deleteOtSurgery,
    listOtTheaters,
    createOtTheater,
    updateOtTheater,
    deleteOtTheater,
    listOtInstruments,
    createOtInstrument,
    updateOtInstrument,
    deleteOtInstrument,
    listOtDevices,
    createOtDevice,
    updateOtDevice,
    deleteOtDevice,
    listOtProcedures,
    createOtProcedure,
    updateOtProcedure,
    deleteOtProcedure,
    listOtSpecialities,
    createOtSpeciality,
    updateOtSpeciality,
    deleteOtSpeciality,
    listOtEquipment,
    createOtEquipment,
    updateOtEquipment,
    deleteOtEquipment,
} from "../api/otMasters"

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"

/* =========================================================
   Helpers
   ========================================================= */
const money = (v) => {
    const n = Number(v || 0)
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(n)
    } catch {
        return `₹ ${n.toFixed(2)}`
    }
}

const cx = (...a) => a.filter(Boolean).join(" ")

// sentinel for Radix Select "None" option (Radix forbids empty string for SelectItem)
const NONE = "__NONE__"

function Pill({ children, variant = "default" }) {
    return (
        <Badge
            variant={variant}
            className="rounded-full px-2.5 py-0.5 text-[11px]"
        >
            {children}
        </Badge>
    )
}

function EmptyState({
    title = "No items",
    hint = "Try changing filters or create a new one.",
}) {
    return (
        <div className="py-10 text-center">
            <div className="text-sm font-medium text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{hint}</div>
        </div>
    )
}

/* =========================================================
   Generic table shell
   ========================================================= */
function DataTable({
    columns = [],
    rows = [],
    loading = false,
    onEdit,
    onDelete,
    canUpdate,
    canDelete,
}) {
    return (
        <div className="rounded-2xl border bg-white overflow-x-auto shadow-sm">
            <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                className={cx(
                                    "px-2 sm:px-3 py-2 text-left text-[11px] sm:text-[12px] font-medium whitespace-nowrap",
                                    c.className
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                        {(canUpdate || canDelete) && (
                            <th className="px-2 sm:px-3 py-2 text-right text-[11px] sm:text-[12px] font-medium whitespace-nowrap">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>

                <tbody>
                    {loading && (
                        <tr>
                            <td className="px-3 py-4" colSpan={columns.length + 1}>
                                <div className="grid gap-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            </td>
                        </tr>
                    )}

                    {!loading && rows?.length === 0 && (
                        <tr>
                            <td className="px-3" colSpan={columns.length + 1}>
                                <EmptyState />
                            </td>
                        </tr>
                    )}

                    {!loading &&
                        rows?.map((r) => (
                            <tr key={r.id} className="border-t align-top hover:bg-slate-50/60">
                                {columns.map((c) => (
                                    <td
                                        key={c.key}
                                        className={cx(
                                            "px-2 sm:px-3 py-2 whitespace-nowrap",
                                            c.tdClassName
                                        )}
                                    >
                                        {c.render ? c.render(r) : r[c.key]}
                                    </td>
                                ))}

                                {(canUpdate || canDelete) && (
                                    <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl"
                                                onClick={() => onEdit?.(r)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl text-red-600 hover:text-red-600"
                                                onClick={() => onDelete?.(r)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    )
}

/* =========================================================
   Main page
   ========================================================= */
export default function OtMasters() {
    // =========================================================
    // Permissions
    // =========================================================
    const canViewAny = useCanAny([
        "ot.masters.view",
        "ot.procedures.view",
        "ot.theaters.view",
        "ot.instruments.view",
        "ot.devices.view",
        "ot.specialities.view",
        "ot.equipment.view",
        "ot.surgeries.view",
    ])

    const perms = {
        procedures: {
            view: useCanAny(["ot.masters.view", "ot.procedures.view"]),
            create: useCanAny(["ot.masters.manage", "ot.procedures.create"]),
            update: useCanAny(["ot.masters.manage", "ot.procedures.update"]),
            delete: useCanAny(["ot.masters.manage", "ot.procedures.delete"]),
        },
        theaters: {
            view: useCanAny(["ot.masters.view", "ot.theaters.view"]),
            create: useCanAny(["ot.masters.create", "ot.theaters.create"]),
            update: useCanAny(["ot.masters.update", "ot.theaters.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.theaters.delete"]),
        },
        instruments: {
            view: useCanAny(["ot.masters.view", "ot.instruments.view"]),
            create: useCanAny(["ot.masters.create", "ot.instruments.create"]),
            update: useCanAny(["ot.masters.update", "ot.instruments.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.instruments.delete"]),
        },
        devices: {
            view: useCanAny(["ot.masters.view", "ot.devices.view"]),
            create: useCanAny(["ot.masters.create", "ot.devices.create"]),
            update: useCanAny(["ot.masters.update", "ot.devices.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.devices.delete"]),
        },
        specialities: {
            view: useCanAny(["ot.masters.view", "ot.specialities.view"]),
            create: useCanAny(["ot.masters.create", "ot.specialities.create"]),
            update: useCanAny(["ot.masters.update", "ot.specialities.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.specialities.delete"]),
        },
        equipment: {
            view: useCanAny(["ot.masters.view", "ot.equipment.view"]),
            create: useCanAny(["ot.masters.create", "ot.equipment.create"]),
            update: useCanAny(["ot.masters.update", "ot.equipment.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.equipment.delete"]),
        },
        surgeries: {
            view: useCanAny(["ot.masters.view", "ot.surgeries.view"]),
            create: useCanAny(["ot.masters.create", "ot.surgeries.create"]),
            update: useCanAny(["ot.masters.update", "ot.surgeries.update"]),
            delete: useCanAny(["ot.masters.delete", "ot.surgeries.delete"]),
        },
    }

    // =========================================================
    // Shared UI state
    // =========================================================
    const [tab, setTab] = useState("procedures")
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState("")
    const [activeOnly, setActiveOnly] = useState(true)

    // options for procedure form
    const [specialities, setSpecialities] = useState([])

    // rows per tab
    const [rows, setRows] = useState([])

    // =========================================================
    // Dialog state
    // =========================================================
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState("create") // create | edit
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({})

    const closeDialog = () => {
        setOpen(false)
        setMode("create")
        setEditing(null)
        setForm({})
    }

    const openCreate = () => {
        const p = perms[tab]
        if (!p?.create) return toast.error("No permission to create")
        setMode("create")
        setEditing(null)

        if (tab === "procedures") {
            setForm({
                code: "",
                name: "",
                speciality_id: "", // keep "" for placeholder
                default_duration_min: "",
                rate_per_hour: "",
                base_cost: "",
                anesthesia_cost: "",
                surgeon_cost: "",
                petitory_cost: "",
                asst_doctor_cost: "",
                description: "",
                is_active: true,
            })
        } else if (tab === "theaters") {
            setForm({ code: "", name: "", cost_per_hour: "", description: "", is_active: true })
        } else if (tab === "instruments") {
            setForm({
                code: "",
                name: "",
                available_qty: 0,
                cost_per_qty: "",
                uom: "Nos",
                description: "",
                is_active: true,
            })
        } else if (tab === "devices") {
            setForm({ category: "AIRWAY", code: "", name: "", cost: "", description: "", is_active: true })
        } else if (tab === "specialities") {
            setForm({ code: "", name: "", description: "", is_active: true })
        } else if (tab === "equipment") {
            setForm({ code: "", name: "", category: "", description: "", is_critical: false, is_active: true })
        } else if (tab === "surgeries") {
            setForm({ code: "", name: "", default_cost: "", hourly_cost: "", description: "", active: true })
        }

        setOpen(true)
    }

    const openEdit = (r) => {
        const p = perms[tab]
        if (!p?.update) return toast.error("No permission to update")

        setMode("edit")
        setEditing(r)

        if (tab === "procedures") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                speciality_id: r.speciality_id ? String(r.speciality_id) : "",
                default_duration_min: r.default_duration_min ?? "",
                rate_per_hour: r.rate_per_hour ?? "",
                base_cost: r.base_cost ?? "",
                anesthesia_cost: r.anesthesia_cost ?? "",
                surgeon_cost: r.surgeon_cost ?? "",
                petitory_cost: r.petitory_cost ?? "",
                asst_doctor_cost: r.asst_doctor_cost ?? "",
                description: r.description || "",
                is_active: !!r.is_active,
            })
        } else if (tab === "theaters") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                cost_per_hour: r.cost_per_hour ?? "",
                description: r.description || "",
                is_active: !!r.is_active,
            })
        } else if (tab === "instruments") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                available_qty: r.available_qty ?? 0,
                cost_per_qty: r.cost_per_qty ?? "",
                uom: r.uom || "Nos",
                description: r.description || "",
                is_active: !!r.is_active,
            })
        } else if (tab === "devices") {
            setForm({
                category: r.category || "AIRWAY",
                code: r.code || "",
                name: r.name || "",
                cost: r.cost ?? "",
                description: r.description || "",
                is_active: !!r.is_active,
            })
        } else if (tab === "specialities") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                description: r.description || "",
                is_active: !!r.is_active,
            })
        } else if (tab === "equipment") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                category: r.category || "",
                description: r.description || "",
                is_critical: !!r.is_critical,
                is_active: !!r.is_active,
            })
        } else if (tab === "surgeries") {
            setForm({
                code: r.code || "",
                name: r.name || "",
                default_cost: r.default_cost ?? "",
                hourly_cost: r.hourly_cost ?? "",
                description: r.description || "",
                active: !!r.active,
            })
        }

        setOpen(true)
    }

    const onDelete = async (r) => {
        const p = perms[tab]
        if (!p?.delete) return toast.error("No permission to delete")

        const ok = confirm("Are you sure you want to delete / deactivate this item?")
        if (!ok) return

        try {
            if (tab === "procedures") await deleteOtProcedure(r.id)
            if (tab === "theaters") await deleteOtTheater(r.id)
            if (tab === "instruments") await deleteOtInstrument(r.id)
            if (tab === "devices") await deleteOtDevice(r.id)
            if (tab === "specialities") await deleteOtSpeciality(r.id)
            if (tab === "equipment") await deleteOtEquipment(r.id)
            if (tab === "surgeries") await deleteOtSurgery(r.id)

            toast.success("Deleted")
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Delete failed")
        }
    }

    // =========================================================
    // Loaders
    // =========================================================
    const loadSpecialities = useCallback(async () => {
        try {
            const { data } = await listOtSpecialities({ active: true })
            setSpecialities(data || [])
        } catch {
            // silent
        }
    }, [])

    const load = useCallback(async () => {
        const p = perms[tab]
        if (!p?.view) return

        setLoading(true)
        try {
            if (tab === "procedures") {
                const { data } = await listOtProcedures({
                    search: q || undefined,
                    is_active: activeOnly ? true : undefined,
                    limit: 200,
                })
                setRows(data || [])
            }

            if (tab === "theaters") {
                const { data } = await listOtTheaters({
                    search: q || undefined,
                    active: activeOnly ? true : undefined,
                    limit: 200,
                })
                setRows(data || [])
            }

            if (tab === "instruments") {
                // ✅ listOtInstruments now lists from /ot/instrument-masters (via api file)
                const { data } = await listOtInstruments({
                    search: q || undefined,
                    active: activeOnly ? true : undefined,
                    limit: 200,
                })
                setRows(data || [])
            }

            if (tab === "devices") {
                const { data } = await listOtDevices({
                    search: q || undefined,
                    active: activeOnly ? true : undefined,
                    limit: 200,
                })
                setRows(data || [])
            }

            if (tab === "specialities") {
                const { data } = await listOtSpecialities({
                    search: q || undefined,
                    active: activeOnly ? true : undefined,
                })
                setRows(data || [])
            }

            if (tab === "equipment") {
                const { data } = await listOtEquipment({
                    search: q || undefined,
                    active: activeOnly ? true : undefined,
                })
                setRows(data || [])
            }

            if (tab === "surgeries") {
                const { data } = await listOtSurgeries({
                    q: q || undefined,
                    active: activeOnly ? true : undefined,
                    page: 1,
                    page_size: 200,
                })
                setRows(data?.items || [])
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to load")
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [tab, q, activeOnly]) // eslint-disable-line

    useEffect(() => {
        if (tab === "procedures") loadSpecialities()
        load()
    }, [tab]) // eslint-disable-line

    // ✅ Debounced reload when search / active filter changes
    useEffect(() => {
        const t = setTimeout(() => {
            load()
        }, 350)
        return () => clearTimeout(t)
    }, [q, activeOnly, tab]) // eslint-disable-line

    // =========================================================
    // Save
    // =========================================================
    const onSave = async () => {
        const p = perms[tab]
        const isEdit = mode === "edit"
        if (isEdit && !p?.update) return toast.error("No permission to update")
        if (!isEdit && !p?.create) return toast.error("No permission to create")

        try {
            if (tab === "procedures") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    speciality_id: form.speciality_id ? Number(form.speciality_id) : null,
                    default_duration_min: form.default_duration_min === "" ? null : Number(form.default_duration_min || 0),
                    rate_per_hour: form.rate_per_hour === "" ? null : Number(form.rate_per_hour || 0),
                    description: form.description || null,
                    is_active: !!form.is_active,

                    base_cost: Number(form.base_cost || 0),
                    anesthesia_cost: Number(form.anesthesia_cost || 0),
                    surgeon_cost: Number(form.surgeon_cost || 0),
                    petitory_cost: Number(form.petitory_cost || 0),
                    asst_doctor_cost: Number(form.asst_doctor_cost || 0),
                }

                if (isEdit) await updateOtProcedure(editing.id, payload)
                else await createOtProcedure(payload)
            }

            if (tab === "theaters") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    cost_per_hour: Number(form.cost_per_hour || 0),
                    description: form.description || "",
                    is_active: !!form.is_active,
                }

                if (isEdit) await updateOtTheater(editing.id, payload)
                else await createOtTheater(payload)
            }

            if (tab === "instruments") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    available_qty: Number(form.available_qty || 0),
                    cost_per_qty: Number(form.cost_per_qty || 0),
                    uom: (form.uom || "Nos").trim(),
                    description: form.description || "",
                    is_active: !!form.is_active,
                }

                if (isEdit) await updateOtInstrument(editing.id, payload)
                else await createOtInstrument(payload)
            }

            if (tab === "devices") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    category: (form.category || "AIRWAY").toUpperCase(),
                    code: form.code.trim(),
                    name: form.name.trim(),
                    cost: Number(form.cost || 0),
                    description: form.description || "",
                    is_active: !!form.is_active,
                }

                if (isEdit) await updateOtDevice(editing.id, payload)
                else await createOtDevice(payload)
            }

            if (tab === "specialities") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    description: form.description || null,
                    is_active: !!form.is_active,
                }

                if (isEdit) await updateOtSpeciality(editing.id, payload)
                else await createOtSpeciality(payload)
            }

            if (tab === "equipment") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    category: form.category || null,
                    description: form.description || null,
                    is_critical: !!form.is_critical,
                    is_active: !!form.is_active,
                }

                if (isEdit) await updateOtEquipment(editing.id, payload)
                else await createOtEquipment(payload)
            }

            if (tab === "surgeries") {
                if (!form.code?.trim() || !form.name?.trim()) return toast.error("Code & Name required")

                const payload = {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    default_cost: Number(form.default_cost || 0),
                    hourly_cost: Number(form.hourly_cost || 0),
                    description: form.description || "",
                    active: !!form.active,
                }

                if (isEdit) await updateOtSurgery(editing.id, payload)
                else await createOtSurgery(payload)
            }

            toast.success(isEdit ? "Updated" : "Created")
            closeDialog()
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Save failed")
        }
    }

    // =========================================================
    // Columns per tab
    // =========================================================
    const columns = useMemo(() => {
        if (tab === "procedures") {
            return [
                { key: "code", header: "Code" },
                { key: "name", header: "Procedure" },
                {
                    key: "total_fixed_cost",
                    header: "Total Fixed Cost",
                    render: (r) => <span className="font-medium">{money(r.total_fixed_cost || 0)}</span>,
                },
                { key: "anesthesia_cost", header: "Anesthesia", render: (r) => money(r.anesthesia_cost || 0) },
                { key: "surgeon_cost", header: "Surgeon", render: (r) => money(r.surgeon_cost || 0) },
                { key: "petitory_cost", header: "Petitory", render: (r) => money(r.petitory_cost || 0) },
                { key: "asst_doctor_cost", header: "Asst", render: (r) => money(r.asst_doctor_cost || 0) },
                {
                    key: "is_active",
                    header: "Active",
                    render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>),
                },
            ]
        }

        if (tab === "theaters") {
            return [
                { key: "code", header: "Code" },
                { key: "name", header: "Theater" },
                {
                    key: "cost_per_hour",
                    header: "Cost / Hour",
                    render: (r) => <span className="font-medium">{money(r.cost_per_hour || 0)}</span>,
                },
                {
                    key: "is_active",
                    header: "Active",
                    render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>),
                },
            ]
        }

        if (tab === "instruments") {
            return [
                { key: "code", header: "Code" },
                { key: "name", header: "Instrument" },
                { key: "available_qty", header: "Available", render: (r) => <span className="font-medium">{r.available_qty ?? 0}</span> },
                { key: "uom", header: "UOM", render: (r) => <Pill variant="secondary">{r.uom || "Nos"}</Pill> },
                { key: "cost_per_qty", header: "Cost / Qty", render: (r) => money(r.cost_per_qty || 0) },
                {
                    key: "is_active",
                    header: "Active",
                    render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>),
                },
            ]
        }

        if (tab === "devices") {
            return [
                { key: "category", header: "Category", render: (r) => <Pill variant="secondary">{r.category}</Pill> },
                { key: "code", header: "Code" },
                { key: "name", header: "Device" },
                { key: "cost", header: "Cost", render: (r) => <span className="font-medium">{money(r.cost || 0)}</span> },
                {
                    key: "is_active",
                    header: "Active",
                    render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>),
                },
            ]
        }

        if (tab === "specialities") {
            return [
                { key: "code", header: "Code" },
                { key: "name", header: "Speciality" },
                {
                    key: "is_active",
                    header: "Active",
                    render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>),
                },
            ]
        }

        if (tab === "equipment") {
            return [
                { key: "code", header: "Code" },
                { key: "name", header: "Equipment" },
                {
                    key: "category",
                    header: "Category",
                    render: (r) => (r.category ? <Pill variant="secondary">{r.category}</Pill> : <span className="text-slate-400">—</span>),
                },
                { key: "is_critical", header: "Critical", render: (r) => (r.is_critical ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>) },
                { key: "is_active", header: "Active", render: (r) => (r.is_active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>) },
            ]
        }

        // surgeries
        return [
            { key: "code", header: "Code" },
            { key: "name", header: "Surgery" },
            { key: "default_cost", header: "Package Cost", render: (r) => <span className="font-medium">{money(r.default_cost || 0)}</span> },
            { key: "hourly_cost", header: "Hourly Cost", render: (r) => money(r.hourly_cost || 0) },
            { key: "active", header: "Active", render: (r) => (r.active ? <Pill>Yes</Pill> : <Pill variant="secondary">No</Pill>) },
        ]
    }, [tab])

    // =========================================================
    // Header titles per tab
    // =========================================================
    const tabMeta = useMemo(() => {
        return {
            procedures: {
                title: "Procedures",
                icon: Stethoscope,
                desc: "Fixed-cost split (anesthesia/surgeon/etc) + legacy hourly fields.",
            },
            theaters: {
                title: "OT Theaters",
                icon: Building2,
                desc: "Hourly charges per theater for OT billing.",
            },
            instruments: {
                title: "Instrument Masters",
                icon: Boxes,
                desc: "Master list used across OT modules (listing via instrument-masters).",
            },
            devices: {
                title: "Airway & Monitor Devices",
                icon: Activity,
                desc: "Device masters categorized as AIRWAY or MONITOR.",
            },
            specialities: {
                title: "Specialities",
                icon: ShieldCheck,
                desc: "OT specialities for procedure grouping.",
            },
            equipment: {
                title: "Equipment",
                icon: Wrench,
                desc: "OT equipment checklist master with critical flag.",
            },
            surgeries: {
                title: "Surgery Master",
                icon: Stethoscope,
                desc: "Legacy: package + hourly costs (optional use).",
            },
        }
    }, [])

    if (!canViewAny) {
        return (
            <div className="p-4 text-sm text-slate-500">
                You do not have permission to view OT Masters.
            </div>
        )
    }

    const p = perms[tab] || {}
    const Icon = tabMeta[tab]?.icon || Stethoscope

    return (
        <div className="p-3 sm:p-4 space-y-4 text-slate-900">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="space-y-1">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-2xl border bg-slate-50 p-2.5">
                                <Icon className="h-5 w-5 text-slate-700" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">OT Masters</CardTitle>
                                <CardDescription className="text-slate-500">
                                    Premium masters management — fast search, strong RBAC, mobile friendly.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                            <div className="relative w-full sm:w-[260px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    className="pl-9 w-full rounded-xl"
                                    placeholder="Search code / name…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="rounded-xl" onClick={load}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh
                                </Button>

                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setActiveOnly((v) => !v)}
                                >
                                    <Filter className="h-4 w-4 mr-2" />
                                    {activeOnly ? "Active Only" : "All"}
                                </Button>

                                {p.create && (
                                    <Button className="rounded-xl" onClick={openCreate}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        New
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <Separator className="my-2" />

                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList className="flex flex-wrap h-auto rounded-2xl bg-slate-50 p-1">
                            <TabsTrigger value="procedures" className="rounded-xl">
                                Procedures
                            </TabsTrigger>
                            <TabsTrigger value="theaters" className="rounded-xl">
                                Theaters
                            </TabsTrigger>
                            <TabsTrigger value="instruments" className="rounded-xl">
                                Instrument Masters
                            </TabsTrigger>
                            <TabsTrigger value="devices" className="rounded-xl">
                                Devices
                            </TabsTrigger>
                            <TabsTrigger value="specialities" className="rounded-xl">
                                Specialities
                            </TabsTrigger>
                            <TabsTrigger value="equipment" className="rounded-xl">
                                Equipment
                            </TabsTrigger>
                            <TabsTrigger value="surgeries" className="rounded-xl">
                                Surgery
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-3 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">
                                {tabMeta[tab]?.title}
                            </span>
                            {" — "}
                            {tabMeta[tab]?.desc}
                            <span className="ml-2 text-slate-400">•</span>
                            <span className="ml-2">
                                {loading ? "Loading…" : `${rows?.length || 0} items`}
                            </span>
                        </div>

                        <TabsContent value={tab} className="mt-4">
                            {!p.view ? (
                                <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
                                    You do not have permission to view <b>{tabMeta[tab]?.title}</b>.
                                </div>
                            ) : (
                                <DataTable
                                    columns={columns}
                                    rows={rows}
                                    loading={loading}
                                    onEdit={openEdit}
                                    onDelete={onDelete}
                                    canUpdate={!!p.update}
                                    canDelete={!!p.delete}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardHeader>

                <CardContent className="pt-0" />
            </Card>

            {/* Dialog */}
            <Dialog
                open={open}
                onOpenChange={(v) => {
                    if (!v) closeDialog()
                }}
            >
                <DialogContent className="w-[calc(100vw-1.25rem)] sm:max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            {mode === "edit" ? "Edit" : "Create"} {tabMeta[tab]?.title}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Fill the fields carefully — this master affects OT scheduling & billing workflow.
                        </DialogDescription>
                    </DialogHeader>

                    {/* FORM BODY */}
                    <div className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Code</Label>
                                <Input
                                    className="rounded-xl"
                                    value={form.code ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder="Ex: OT-001"
                                />
                            </div>

                            <div className="grid gap-1.5">
                                <Label>Name</Label>
                                <Input
                                    className="rounded-xl"
                                    value={form.name ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Ex: Lap Chole"
                                />
                            </div>
                        </div>

                        {/* PROCEDURES */}
                        {tab === "procedures" && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label>Speciality</Label>

                                        <Select
                                            value={form.speciality_id || ""}
                                            onValueChange={(v) => {
                                                if (v === NONE) setForm((f) => ({ ...f, speciality_id: "" }))
                                                else setForm((f) => ({ ...f, speciality_id: v }))
                                            }}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select speciality (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>None</SelectItem>
                                                {specialities
                                                    .filter((s) => s?.id)
                                                    .map((s) => (
                                                        <SelectItem key={s.id} value={String(s.id)}>
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label>Default Duration (min)</Label>
                                        <Input
                                            className="rounded-xl"
                                            type="number"
                                            inputMode="numeric"
                                            value={form.default_duration_min ?? ""}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, default_duration_min: e.target.value }))
                                            }
                                            placeholder="Ex: 60"
                                        />
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label>Rate / Hour (legacy)</Label>
                                        <Input
                                            className="rounded-xl"
                                            type="number"
                                            inputMode="decimal"
                                            value={form.rate_per_hour ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, rate_per_hour: e.target.value }))}
                                            placeholder="Ex: 2500"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <div className="text-sm font-medium text-slate-800 mb-2">
                                        Fixed Cost Split-up
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label>Base</Label>
                                            <Input
                                                className="rounded-xl"
                                                type="number"
                                                inputMode="decimal"
                                                value={form.base_cost ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, base_cost: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Anesthesia</Label>
                                            <Input
                                                className="rounded-xl"
                                                type="number"
                                                inputMode="decimal"
                                                value={form.anesthesia_cost ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, anesthesia_cost: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Surgeon</Label>
                                            <Input
                                                className="rounded-xl"
                                                type="number"
                                                inputMode="decimal"
                                                value={form.surgeon_cost ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, surgeon_cost: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Petitory (opt)</Label>
                                            <Input
                                                className="rounded-xl"
                                                type="number"
                                                inputMode="decimal"
                                                value={form.petitory_cost ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, petitory_cost: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Asst (opt)</Label>
                                            <Input
                                                className="rounded-xl"
                                                type="number"
                                                inputMode="decimal"
                                                value={form.asst_doctor_cost ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, asst_doctor_cost: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* THEATERS */}
                        {tab === "theaters" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Cost per Hour</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.cost_per_hour ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, cost_per_hour: e.target.value }))}
                                        placeholder="Ex: 3000"
                                    />
                                </div>
                            </div>
                        )}

                        {/* INSTRUMENTS */}
                        {tab === "instruments" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Available Qty</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="numeric"
                                        value={form.available_qty ?? 0}
                                        onChange={(e) => setForm((f) => ({ ...f, available_qty: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Cost per Qty</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.cost_per_qty ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, cost_per_qty: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>UOM</Label>
                                    <Input
                                        className="rounded-xl"
                                        value={form.uom ?? "Nos"}
                                        onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                                        placeholder="Nos / Sets / Pcs"
                                    />
                                </div>
                            </div>
                        )}

                        {/* DEVICES */}
                        {tab === "devices" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Category</Label>
                                    <Select
                                        value={form.category || "AIRWAY"}
                                        onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="AIRWAY">AIRWAY</SelectItem>
                                            <SelectItem value="MONITOR">MONITOR</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Cost</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.cost ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* EQUIPMENT */}
                        {tab === "equipment" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Category</Label>
                                    <Input
                                        className="rounded-xl"
                                        value={form.category ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                                        placeholder="Anaesthesia / Monitoring / OT Table…"
                                    />
                                </div>

                                <div className="flex items-center gap-2 mt-7">
                                    <Checkbox
                                        checked={!!form.is_critical}
                                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_critical: !!v }))}
                                    />
                                    <span className="text-sm text-slate-700">Critical Equipment</span>
                                </div>
                            </div>
                        )}

                        {/* SURGERIES */}
                        {tab === "surgeries" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Package Cost</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.default_cost ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, default_cost: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Hourly Cost</Label>
                                    <Input
                                        className="rounded-xl"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.hourly_cost ?? ""}
                                        onChange={(e) => setForm((f) => ({ ...f, hourly_cost: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Description + Active */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Description</Label>
                                <Textarea
                                    className="rounded-xl min-h-[92px]"
                                    value={form.description ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional notes…"
                                />
                            </div>

                            <div className="rounded-2xl border bg-slate-50 p-3">
                                <div className="text-sm font-medium text-slate-800">Status</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <Checkbox
                                        checked={tab === "surgeries" ? !!form.active : !!form.is_active}
                                        onCheckedChange={(v) => {
                                            if (tab === "surgeries") setForm((f) => ({ ...f, active: !!v }))
                                            else setForm((f) => ({ ...f, is_active: !!v }))
                                        }}
                                    />
                                    <span className="text-sm text-slate-700">Active</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                    Inactive items can be hidden from selection lists.
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button className="rounded-xl" onClick={onSave}>
                            {mode === "edit" ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
