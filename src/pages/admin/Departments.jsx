// FILE: frontend/src/admin/Departments.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import { Building2, Search, Plus } from 'lucide-react'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
}

export default function Departments() {
    const { hasAny, canView, canCreate, canUpdate, canDelete } =
        useModulePerms('departments')

    const [items, setItems] = useState([])
    const [form, setForm] = useState({ name: '', description: '' })
    const [editId, setEditId] = useState(null)
    const [error, setError] = useState('')
    const [loadingSave, setLoadingSave] = useState(false)
    const [loadingList, setLoadingList] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')
    const [filterChip, setFilterChip] = useState('all') // all | withDesc | withoutDesc

    const load = useCallback(async () => {
        if (!canView) return
        setError('')
        setLoadingList(true)
        try {
            const { data } = await API.get('/departments/')
            setItems(data || [])
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied for Departments.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to load departments.')
        } finally {
            setLoadingList(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const save = async (e) => {
        e.preventDefault()
        if (!editId && !canCreate) return
        if (editId && !canUpdate) return

        setLoadingSave(true)
        setError('')
        try {
            if (editId) {
                await API.put(`/departments/${editId}`, form)
            } else {
                await API.post('/departments/', form)
            }
            setForm({ name: '', description: '' })
            setEditId(null)
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to save department.')
        } finally {
            setLoadingSave(false)
        }
    }

    const remove = async (id) => {
        if (!canDelete) return
        if (!window.confirm('Delete this department?')) return
        try {
            await API.delete(`/departments/${id}`)
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to delete department.')
        }
    }

    const edit = (d) => {
        if (!canUpdate) return
        setEditId(d.id)
        setForm({ name: d.name, description: d.description || '' })
    }

    const resetForm = () => {
        setEditId(null)
        setForm({ name: '', description: '' })
    }

    const filteredItems = useMemo(() => {
        return (items || []).filter((d) => {
            if (!d) return false
            const name = (d.name || '').toLowerCase()
            const desc = (d.description || '').toLowerCase()
            const query = searchTerm.toLowerCase().trim()

            if (query && !(`${name} ${desc}`.includes(query))) {
                return false
            }

            if (filterChip === 'withDesc' && !d.description) return false
            if (filterChip === 'withoutDesc' && d.description) return false

            return true
        })
    }, [items, searchTerm, filterChip])

    // ----- permission denied state -----
    if (!hasAny || !canView) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-4">
                    {/* Hero-like blocked card */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 text-white shadow-md">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#e5e7eb,_transparent_55%)]" />
                        <div className="relative px-5 py-6 sm:px-7 sm:py-7 md:px-9 md:py-8 flex items-center gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 border border-white/20">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                                    Departments module
                                </h1>
                                <p className="mt-1 text-xs sm:text-sm text-slate-100/90">
                                    Configure clinical and support departments for your hospital.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Card className="rounded-3xl border-amber-200 bg-amber-50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-amber-900">
                                Access restricted
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert className="border-amber-200 bg-amber-50 text-amber-900 rounded-2xl">
                                <AlertTitle className="font-semibold">
                                    You don’t have permission
                                </AlertTitle>
                                <AlertDescription className="text-sm">
                                    Your role does not currently include access to the Departments
                                    configuration. Please contact the system administrator if you
                                    believe this is a mistake.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-4 md:space-y-5 lg:space-y-6">
                {/* TOP META ROW */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-700"
                    >
                        Admin · Departments
                    </Badge>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
                        <span className="hidden sm:inline">Desktop workspace</span>
                        <span className="sm:hidden">Responsive view</span>
                    </div>
                </div>

                {/* HERO HEADER (gradient) */}
                <motion.div {...fadeIn}>
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
                        <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
                        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8">
                            <div className="space-y-3 max-w-xl">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                                        <Building2 className="w-3.5 h-3.5" />
                                    </span>
                                    Core clinical & support structure
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-sm border border-white/20">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                                            Clinical & Support Departments
                                        </h1>
                                        <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                                            Configure <span className="font-semibold">OPD, IPD, diagnostics and support</span> departments so that
                                            doctors, staff and services stay aligned across your hospital.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-auto space-y-3">
                                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                                    <Badge className="bg-white/15 text-xs font-semibold border border-white/25 text-white rounded-full px-3 py-1">
                                        Master configuration
                                    </Badge>
                                    <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                                        Used by OPD / IPD / Lab / OT
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:min-w-[220px]">
                                    <SummaryTile
                                        label="Departments"
                                        value={items.length}
                                        hint="Mapped across OPD, IPD, lab, radiology, etc."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ERROR CARD */}
                {error && (
                    <motion.div {...fadeIn}>
                        <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
                            <AlertTitle className="font-semibold">Issue</AlertTitle>
                            <AlertDescription className="text-sm">
                                {error}
                            </AlertDescription>
                        </Alert>
                    </motion.div>
                )}

                {/* MAIN GRID: FORM + LIST */}
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                    {/* LEFT – FORM */}
                    <motion.div {...fadeIn}>
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-900">
                                    {editId ? 'Edit department' : 'Create department'}
                                </CardTitle>
                                <p className="mt-1 text-xs text-slate-600">
                                    Add or update hospital departments that will be used across modules.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={save} className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-800">
                                            Department name<span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            placeholder="e.g., General Medicine"
                                            value={form.name}
                                            onChange={(e) =>
                                                setForm({ ...form, name: e.target.value })
                                            }
                                            required
                                            disabled={!(!editId ? canCreate : canUpdate)}
                                            className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-800">
                                            Description
                                            <span className="text-slate-400"> (optional)</span>
                                        </label>
                                        <Input
                                            placeholder="Short description to help staff identify this department"
                                            value={form.description}
                                            onChange={(e) =>
                                                setForm({ ...form, description: e.target.value })
                                            }
                                            disabled={!(!editId ? canCreate : canUpdate)}
                                            className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        {editId && (
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="text-xs text-slate-500 underline underline-offset-2"
                                            >
                                                Cancel edit &amp; reset
                                            </button>
                                        )}
                                        <Button
                                            type="submit"
                                            className="ml-auto rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                                            disabled={
                                                loadingSave ||
                                                (!editId ? !canCreate : !canUpdate)
                                            }
                                        >
                                            {loadingSave
                                                ? 'Saving…'
                                                : editId
                                                    ? 'Update department'
                                                    : 'Create department'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* RIGHT – LIST */}
                    <motion.div {...fadeIn}>
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="border-b border-slate-100 pb-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-slate-900">
                                            Department list
                                        </CardTitle>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            {items.length} configured department
                                            {items.length === 1 ? '' : 's'}.
                                        </p>
                                    </div>

                                    {/* Search + New button bar (compact on small) */}
                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        {/* Search input */}
                                        <div className="relative w-full sm:w-52">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search by name or description"
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                            />
                                        </div>

                                        {/* Primary "New" button */}
                                        {canCreate && (
                                            <Button
                                                type="button"
                                                onClick={resetForm}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                New department
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter chips */}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'withDesc', label: 'With description' },
                                        { key: 'withoutDesc', label: 'Without description' },
                                    ].map((chip) => (
                                        <button
                                            key={chip.key}
                                            type="button"
                                            onClick={() => setFilterChip(chip.key)}
                                            className={[
                                                'inline-flex items-center rounded-full px-3 py-1 text-[11px] sm:text-xs transition',
                                                filterChip === chip.key
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                            ].join(' ')}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>

                            <CardContent className="pt-4">
                                {/* LOADING LIST */}
                                {loadingList ? (
                                    <div className="space-y-2">
                                        {[0, 1, 2].map((i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                                            >
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-3 w-1/3 rounded-full bg-slate-100" />
                                                    <Skeleton className="h-2.5 w-1/2 rounded-full bg-slate-100" />
                                                </div>
                                                <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {/* DESKTOP / TABLET: TABLE VIEW */}
                                        <div className="hidden md:block">
                                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                                <table className="min-w-full text-xs">
                                                    <thead className="bg-slate-50 text-[11px] font-medium text-slate-600">
                                                        <tr>
                                                            <th className="p-2 text-left">#</th>
                                                            <th className="p-2 text-left">Name</th>
                                                            <th className="p-2 text-left">
                                                                Description
                                                            </th>
                                                            <th className="p-2 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredItems.map((d, i) => (
                                                            <tr
                                                                key={d.id}
                                                                className="border-t border-slate-100 text-xs text-slate-800 hover:bg-slate-50/80 transition-colors"
                                                            >
                                                                <td className="p-2 align-top">
                                                                    {i + 1}
                                                                </td>
                                                                <td className="p-2 align-top font-semibold text-slate-900">
                                                                    {d.name}
                                                                </td>
                                                                <td className="p-2 align-top text-slate-500">
                                                                    <span className="line-clamp-2 text-[11px]">
                                                                        {d.description || '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 align-top text-right">
                                                                    <div className="inline-flex gap-2">
                                                                        {canUpdate && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 rounded-full border-slate-200 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                                                                onClick={() => edit(d)}
                                                                            >
                                                                                Edit
                                                                            </Button>
                                                                        )}
                                                                        {canDelete && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 rounded-full border border-rose-200 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                                                                onClick={() => remove(d.id)}
                                                                            >
                                                                                Delete
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {!filteredItems.length && (
                                                            <tr>
                                                                <td colSpan={4} className="p-4">
                                                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                                                        <p className="text-sm font-medium text-slate-700">
                                                                            No departments match your filters.
                                                                        </p>
                                                                        <p className="mt-1 text-[11px] text-slate-500">
                                                                            Adjust search or filter, or create a new
                                                                            department from the left panel.
                                                                        </p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* MOBILE: CARD-BASED LAYOUT */}
                                        <div className="grid gap-3 md:hidden">
                                            {filteredItems.map((d, i) => (
                                                <div
                                                    key={d.id}
                                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm flex flex-col gap-2"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-600">
                                                                    {i + 1}
                                                                </span>
                                                                <h3 className="text-sm font-semibold text-slate-900">
                                                                    {d.name}
                                                                </h3>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 line-clamp-2">
                                                                {d.description || 'No description'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2 pt-1">
                                                        {canUpdate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => edit(d)}
                                                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(d.id)}
                                                                className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {!filteredItems.length && (
                                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                                    <p className="text-sm font-medium text-slate-700">
                                                        No departments match your filters.
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-slate-500">
                                                        Adjust search or filters, or create a new department from the
                                                        form above.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

function SummaryTile({ label, value, hint }) {
    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="rounded-2xl border border-white/40 bg-white/10 px-3 py-2 text-[11px] text-teal-50/90"
        >
            <div className="text-[10px] font-medium uppercase tracking-wide text-teal-100/90">
                {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
                {value}
            </div>
            {hint && (
                <div className="mt-0.5 text-[10px] text-teal-100/80">
                    {hint}
                </div>
            )}
        </motion.div>
    )
}
