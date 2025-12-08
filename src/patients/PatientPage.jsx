// FILE: src/patients/PatientPage.jsx
import { useEffect, useState, useMemo } from 'react'
import {
    listPatients,
    deactivatePatient,
    getPatientMastersAll,
    exportPatientsExcel,
} from '../api/patients'
import { toast } from 'sonner'
import {
    Users,
    Search,
    Plus,
    FileDown,
    AlertCircle,
    Inbox,
    FileQuestion,
    Phone,
    Mail,
    Tag,
} from 'lucide-react'
import PatientFormModal from './PatientForm'
import PatientDetailDrawer from './PatientDetailDrawer'

export default function PatientPage() {
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')

    const [formOpen, setFormOpen] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [editingPatient, setEditingPatient] = useState(null)

    const [lookups, setLookups] = useState({
        refSources: [],
        doctors: [],
        payers: [],
        tpas: [],
        creditPlans: [],
        patientTypes: [],
    })

    const [error, setError] = useState('')

    // Filters
    const [patientTypeFilter, setPatientTypeFilter] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        loadPatients()
        loadLookups()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadPatients = async (search = q, patientType = patientTypeFilter) => {
        setLoading(true)
        setError('')
        try {
            const params = {}
            if (search) params.q = search
            if (patientType) params.patient_type = patientType

            const res = await listPatients(params)
            setPatients(res.data || [])
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load patients'
            setError(msg)
            toast.error('Failed to load patients', { description: msg })
        } finally {
            setLoading(false)
        }
    }

    const loadLookups = async () => {
        try {
            const res = await getPatientMastersAll()
            const data = res.data || {}
            setLookups({
                refSources: data.reference_sources || [],
                doctors: data.doctors || [],
                payers: data.payers || [],
                tpas: data.tpas || [],
                creditPlans: data.credit_plans || [],
                patientTypes: data.patient_types || [],
            })
        } catch {
            // not critical; ignore
        }
    }

    const handleSearchSubmit = (e) => {
        e.preventDefault()
        loadPatients(q)
    }

    const handlePatientTypeChip = (codeOrEmpty) => {
        setPatientTypeFilter(codeOrEmpty)
        loadPatients(q, codeOrEmpty)
    }

    const handleFilterReset = () => {
        setPatientTypeFilter('')
        setQ('')
        loadPatients('', '')
    }

    const handleNew = () => {
        setEditingPatient(null)
        setFormOpen(true)
    }

    const handleEdit = (p) => {
        setEditingPatient(p)
        setFormOpen(true)
    }

    const handleView = (p) => {
        setSelectedPatient(p)
        setDetailOpen(true)
    }

    const handleDeactivate = async (p) => {
        if (!window.confirm(`Deactivate patient ${p.first_name}?`)) return
        try {
            await deactivatePatient(p.id)
            toast.success('Patient deactivated successfully.')
            await loadPatients()
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to deactivate patient'
            toast.error('Failed to deactivate patient', { description: msg })
        }
    }

    const updatePatientInList = (updated) => {
        setPatients((prev) => {
            const idx = prev.findIndex((p) => p.id === updated.id)
            if (idx === -1) return prev
            const clone = [...prev]
            clone[idx] = updated
            return clone
        })
    }

    const handleExportExcel = async () => {
        if (!fromDate || !toDate) {
            toast.warning('Please select From and To date for Excel export.')
            return
        }
        if (toDate < fromDate) {
            toast.warning('To Date must be on or after From Date.')
            return
        }

        setExporting(true)
        try {
            const params = {
                from_date: fromDate,
                to_date: toDate,
            }
            if (patientTypeFilter) {
                params.patient_type = patientTypeFilter
            }

            const res = await exportPatientsExcel(params)
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `patients_${fromDate}_to_${toDate}.xlsx`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)

            toast.success('Patient Excel report downloaded.')
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to export Excel.'
            toast.error('Failed to export Excel.', { description: msg })
        } finally {
            setExporting(false)
        }
    }

    const patientTypeOptions = useMemo(
        () => lookups.patientTypes || [],
        [lookups.patientTypes]
    )

    return (
        <div className="h-full w-full flex flex-col gap-4 lg:gap-5 px-3 py-3 sm:px-5 sm:py-4 bg-slate-50/80">
            {/* Hero header */}
            <div className="rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500 text-white shadow-md px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs">
                            <Users className="w-4 h-4" />
                            <span className="font-medium tracking-tight">
                                Patient Registry
                            </span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                            Patient Management
                        </h1>
                        <p className="text-xs sm:text-sm text-teal-100/90 max-w-xl">
                            Register new patients, manage demographics, consents, 
                            and credit/insurance details in a single unified profile.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                            <span className="h-2 w-2 rounded-full bg-emerald-300" />
                            IPD / OPD ready
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                            <span className="h-2 w-2 rounded-full bg-sky-300" />
                            NABH-aligned registry
                        </span>
                    </div>
                </div>
            </div>

            {/* Top toolbar: search + filters + primary CTA */}
            <div className="flex flex-col gap-3 rounded-3xl bg-white shadow-sm border border-slate-200 px-3 py-3 sm:px-4 sm:py-3">
                {/* Search + New */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search */}
                    <form
                        onSubmit={handleSearchSubmit}
                        className="w-full flex items-center gap-2"
                    >
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-8 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                placeholder="Search by UHID, name, mobile, email..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition duration-150"
                        >
                            Search
                        </button>
                    </form>

                    {/* Primary CTA */}
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleFilterReset}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={handleNew}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition duration-150"
                        >
                            <Plus className="h-4 w-4" />
                            <span>New Patient</span>
                        </button>
                    </div>
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">
                        Filter by patient type:
                    </span>
                    <button
                        type="button"
                        onClick={() => handlePatientTypeChip('')}
                        className={[
                            'inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm transition',
                            patientTypeFilter === ''
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        ].join(' ')}
                    >
                        All
                    </button>
                    {patientTypeOptions.map((pt) => {
                        const code = pt.code || pt.name
                        const label = pt.name || pt.code
                        return (
                            <button
                                key={code}
                                type="button"
                                onClick={() => handlePatientTypeChip(code)}
                                className={[
                                    'inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm transition',
                                    patientTypeFilter === code
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Secondary toolbar: export section */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="rounded-3xl bg-white shadow-sm border border-slate-200 px-3 py-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex flex-col">
                        <label className="text-[11px] font-medium text-slate-700 mb-1">
                            From Date
                        </label>
                        <input
                            type="date"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[11px] font-medium text-slate-700 mb-1">
                            To Date
                        </label>
                        <input
                            type="date"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={exporting}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    >
                        <FileDown className="h-4 w-4" />
                        {exporting ? 'Exporting…' : 'Export Excel'}
                    </button>
                </div>
                {/* You can keep this area free or add quick stats later */}
            </div>

            {/* Error state */}
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="font-semibold">Unable to load patients</div>
                        <div className="text-[11px] sm:text-xs">{error}</div>
                    </div>
                </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:flex flex-1">
                <div className="w-full rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-280px)]">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-600 uppercase">
                                        UHID / Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-600 uppercase">
                                        Demographics
                                    </th>
                                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-600 uppercase">
                                        Contact
                                    </th>
                                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-600 uppercase">
                                        Tags
                                    </th>
                                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-600 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-6 text-center text-sm text-slate-500"
                                        >
                                            Loading patients…
                                        </td>
                                    </tr>
                                )}
                                {!loading && patients.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-6 text-center text-sm text-slate-500"
                                        >
                                            <div className="flex flex-col items-center gap-1.5">
                                                <Inbox className="h-6 w-6 text-slate-300" />
                                                <div className="font-medium text-slate-600">
                                                    No patients found.
                                                </div>
                                                <p className="text-[11px] text-slate-400">
                                                    Adjust search or filters, or click “New Patient”
                                                    to create the first record.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loading &&
                                    patients.map((p, idx) => (
                                        <tr
                                            key={p.id}
                                            className={`border-t border-slate-100 hover:bg-slate-50/70 transition ${idx % 2 === 1 ? 'bg-slate-50/30' : ''
                                                }`}
                                        >
                                            <td className="px-3 py-2 align-top">
                                                <div className="font-semibold text-slate-900">
                                                    {p.first_name} {p.last_name || ''}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                                                        {p.uhid}
                                                    </span>
                                                    <span className="text-slate-400">•</span>
                                                    <span>Age: {p.age_text || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-700">
                                                <div>Gender: {p.gender}</div>
                                                <div>Blood group: {p.blood_group || '—'}</div>
                                                <div>Marital status: {p.marital_status || '—'}</div>
                                            </td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-700">
                                                <div className="flex items-center gap-1">
                                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{p.phone || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="truncate max-w-[180px] text-[11px]">
                                                        {p.email || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-700">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {p.patient_type && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-800">
                                                            <Tag className="h-3 w-3 text-slate-400" />
                                                            {p.patient_type}
                                                        </span>
                                                    )}
                                                    {p.tag && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                                                            {p.tag}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top text-right text-xs">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(p)}
                                                        className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(p)}
                                                        className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeactivate(p)}
                                                        className="inline-flex items-center rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 transition"
                                                    >
                                                        Deactivate
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex-1">
                {loading && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500 shadow-sm">
                        Loading patients…
                    </div>
                )}
                {!loading && patients.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500 shadow-sm flex flex-col items-center gap-1.5">
                        <FileQuestion className="h-6 w-6 text-slate-300" />
                        <div className="font-medium text-slate-700">
                            No patients found.
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Use the search bar or tap “New Patient” to add a record.
                        </p>
                    </div>
                )}
                <div className="mt-2 grid gap-3">
                    {patients.map((p) => (
                        <div
                            key={p.id}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm hover:shadow-md transition"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className="text-sm font-semibold text-slate-900">
                                            {p.first_name} {p.last_name || ''}
                                        </div>
                                        {p.patient_type && (
                                            <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-800">
                                                {p.patient_type}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                                            {p.uhid}
                                        </span>
                                        <span>· Age: {p.age_text || '—'}</span>
                                        <span>· {p.gender}</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                                            <span>{p.phone || 'No mobile'}</span>
                                        </div>
                                        {p.email && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="truncate max-w-[180px]">
                                                    {p.email}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleView(p)}
                                        className="px-2 py-1 text-[11px] rounded-full border border-slate-200 text-slate-700 font-semibold"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleEdit(p)}
                                        className="px-2 py-1 text-[11px] rounded-full border border-slate-200 text-slate-700 font-semibold"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeactivate(p)}
                                        className="px-2 py-1 text-[11px] rounded-full border border-rose-200 text-rose-700 font-semibold"
                                    >
                                        Deactivate
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-600">
                                {p.tag && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        {p.tag}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals / Drawers */}
            <PatientFormModal
                open={formOpen}
                onClose={() => setFormOpen(false)}
                onSaved={() => loadPatients()}
                initialPatient={editingPatient}
                lookups={lookups}
            />

            <PatientDetailDrawer
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                patient={selectedPatient}
                onUpdated={updatePatientInList}
            />
        </div>
    )
}
