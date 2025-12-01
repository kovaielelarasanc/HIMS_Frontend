// FILE: frontend/src/admin/Departments.jsx
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import { Building2 } from 'lucide-react'

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
    const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('departments')

    const [items, setItems] = useState([])
    const [form, setForm] = useState({ name: '', description: '' })
    const [editId, setEditId] = useState(null)
    const [error, setError] = useState('')
    const [loadingSave, setLoadingSave] = useState(false)
    const [loadingList, setLoadingList] = useState(false)

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
            if (editId) await API.put(`/departments/${editId}`, form)
            else await API.post('/departments/', form)
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

    if (!hasAny || !canView) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-slate-900">
                                Departments
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-800">
                                <AlertTitle>Access restricted</AlertTitle>
                                <AlertDescription className="text-sm">
                                    You don’t have permission to view the Departments module.
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
            <div className="mx-auto max-w-6xl space-y-4">
                {/* Top meta row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium tracking-wide text-slate-600"
                    >
                        Admin · Departments
                    </Badge>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
                        <span>Desktop workspace</span>
                    </div>
                </div>

                {/* Header card */}
                <motion.div {...fadeIn}>
                    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-900 text-slate-50">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-base sm:text-lg text-slate-900">
                                        Clinical & support departments
                                    </CardTitle>
                                    <p className="mt-1 text-xs text-slate-600">
                                        Configure OPD, IPD, diagnostics and support departments to align
                                        users, doctors and services.
                                    </p>
                                </div>
                            </div>
                            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-1">
                                <SummaryTile
                                    label="Departments"
                                    value={items.length}
                                    hint="Mapped across OPD, IPD, lab, radiology, etc."
                                />
                            </div>
                        </CardHeader>
                    </Card>
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.div {...fadeIn}>
                        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 text-red-800">
                            <AlertTitle>Issue</AlertTitle>
                            <AlertDescription className="text-sm">
                                {error}
                            </AlertDescription>
                        </Alert>
                    </motion.div>
                )}

                {/* 2-column layout */}
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                    {/* Left – form */}
                    <motion.div {...fadeIn}>
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-900">
                                    {editId ? 'Edit department' : 'Create department'}
                                </CardTitle>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    Add or update hospital departments that will be used across modules.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={save}
                                    className="grid gap-3"
                                >
                                    <Input
                                        placeholder="Department name (e.g., General Medicine)"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        disabled={!(!editId ? canCreate : canUpdate)}
                                        className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                                    />
                                    <Input
                                        placeholder="Description (optional)"
                                        value={form.description}
                                        onChange={(e) =>
                                            setForm({ ...form, description: e.target.value })
                                        }
                                        disabled={!(!editId ? canCreate : canUpdate)}
                                        className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                                    />
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        {editId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditId(null)
                                                    setForm({ name: '', description: '' })
                                                }}
                                                className="text-[11px] text-slate-500 underline"
                                            >
                                                Cancel edit &amp; reset
                                            </button>
                                        )}
                                        <Button
                                            type="submit"
                                            className="ml-auto rounded-2xl bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                                            disabled={loadingSave || (!editId ? !canCreate : !canUpdate)}
                                        >
                                            {loadingSave
                                                ? 'Saving...'
                                                : editId
                                                    ? 'Update department'
                                                    : 'Create department'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Right – list */}
                    <motion.div {...fadeIn}>
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="border-b border-slate-100 pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-slate-900">
                                            Department list
                                        </CardTitle>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            {items.length} configured department(s).
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
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
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-slate-50 text-[11px] font-medium text-slate-600">
                                                <tr>
                                                    <th className="p-2 text-left">#</th>
                                                    <th className="p-2 text-left">Name</th>
                                                    <th className="p-2 text-left">Description</th>
                                                    <th className="p-2 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((d, i) => (
                                                    <tr
                                                        key={d.id}
                                                        className="border-t border-slate-100 text-xs text-slate-800"
                                                    >
                                                        <td className="p-2">{i + 1}</td>
                                                        <td className="p-2">{d.name}</td>
                                                        <td className="p-2 text-slate-500">
                                                            {d.description || '—'}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            <div className="inline-flex gap-2">
                                                                {canUpdate && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 rounded-2xl border-slate-200 px-3 text-[11px]"
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
                                                                        className="h-7 rounded-2xl border border-rose-200 px-3 text-[11px] text-rose-700 hover:bg-rose-50"
                                                                        onClick={() => remove(d.id)}
                                                                    >
                                                                        Delete
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!items.length && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4">
                                                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                                                <p className="text-sm font-medium text-slate-700">
                                                                    No departments yet.
                                                                </p>
                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                    Use the form on the left to add your first department.
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
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
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
        >
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
                {value}
            </div>
            {hint && (
                <div className="mt-0.5 text-[10px] text-slate-400">
                    {hint}
                </div>
            )}
        </motion.div>
    )
}
