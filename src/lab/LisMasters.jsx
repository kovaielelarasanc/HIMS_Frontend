// FILE: frontend/src/lis/LisMasters.jsx
import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'

const defaultPrimary = '#2563eb'

const EMPTY_DEPT_FORM = {
    name: '',
    code: '',
    description: '',
    parent_id: '',
    is_active: true,
}

const EMPTY_DRAFT_SERVICE = {
    name: '',
    code: '',
    unit: '',
    normal_range: '',
    sample_type: '',
    method: '',
    comments_template: '',
    display_order: '',
}

export default function LisMasters() {
    const { branding } = useBranding() || {}
    const primary = branding?.primary_color || defaultPrimary

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

    // ------------- Derived -------------

    const topLevelDepts = useMemo(
        () => departments.filter(d => !d.parent_id),
        [departments]
    )

    const subDeptsByParent = useMemo(() => {
        const map = {}
        departments.forEach(d => {
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
        return topLevelDepts.filter(d =>
            [d.name, d.code].some(x =>
                (x || '').toString().toLowerCase().includes(term)
            )
        )
    }, [deptSearch, topLevelDepts])

    const selectedDept = useMemo(
        () => departments.find(d => d.id === selectedDeptId) || null,
        [departments, selectedDeptId]
    )

    const filteredServices = useMemo(() => {
        const term = serviceSearch.trim().toLowerCase()
        return services.filter(s => {
            if (!showInactiveServices && !s.is_active) return false
            if (!term) return true
            return [s.name, s.code, s.sample_type, s.method].some(x =>
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
            return
        }
        loadServicesForDept(selectedDept.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeptId, canViewServices])

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
        setDeptForm({
            ...EMPTY_DEPT_FORM,
            parent_id: parentId || '',
        })
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
            display_order: dept.display_order || '',
        })
        setDeptModalOpen(true)
    }

    function handleDeptFormChange(e) {
        const { name, value, type, checked } = e.target
        setDeptForm(prev => ({
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
            display_order: deptForm.display_order
                ? Number(deptForm.display_order)
                : null,
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
            if (dept.id === selectedDeptId) {
                setSelectedDeptId(null)
            }
            await loadDepartments()
        } catch (err) {
            console.error('Failed to delete department', err)
            toast.error('Failed to delete department')
        }
    }

    // ------------- Services grid -------------

    function addDraftRow() {
        if (!selectedDept) {
            toast.error('Select a department first')
            return
        }
        setDraftRows(prev => [
            ...prev,
            {
                ...EMPTY_DRAFT_SERVICE,
            },
        ])
    }

    function handleDraftChange(idx, field, value) {
        setDraftRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], [field]: value }
            return copy
        })
    }

    async function handleBulkSave() {
        if (!selectedDept) return
        const cleaned = draftRows
            .map(r => ({
                ...r,
                name: (r.name || '').trim(),
                department_id: selectedDept.id,
                code: r.code?.trim() || null,
                unit: r.unit?.trim() || '',
                normal_range: r.normal_range?.trim() || '',
                sample_type: r.sample_type?.trim() || null,
                method: r.method?.trim() || null,
                comments_template: r.comments_template?.trim() || null,
                display_order: r.display_order
                    ? Number(r.display_order)
                    : null,
            }))
            .filter(r => r.name)

        if (!cleaned.length) {
            toast.error('Add at least one service row with a name')
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

    function startEditService(svc) {
        setEditingServiceId(svc.id)
        setServiceEditBuffer({
            ...svc,
            display_order: svc.display_order ?? '',
        })
    }

    function cancelEditService() {
        setEditingServiceId(null)
        setServiceEditBuffer(null)
    }

    function handleServiceEditChange(field, value) {
        setServiceEditBuffer(prev => ({
            ...prev,
            [field]: value,
        }))
    }

    async function saveServiceEdit() {
        if (!editingServiceId || !serviceEditBuffer) return
        const payload = {
            name: serviceEditBuffer.name?.trim() || '',
            code: serviceEditBuffer.code?.trim() || null,
            unit: serviceEditBuffer.unit?.trim() || '',
            normal_range: serviceEditBuffer.normal_range?.trim() || '',
            sample_type: serviceEditBuffer.sample_type?.trim() || null,
            method: serviceEditBuffer.method?.trim() || null,
            comments_template:
                serviceEditBuffer.comments_template?.trim() || null,
            is_active: !!serviceEditBuffer.is_active,
            display_order: serviceEditBuffer.display_order
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
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border transition-all ${isSelected
                            ? 'border-transparent'
                            : 'border-transparent hover:border-slate-200'
                        }`}
                    style={{
                        backgroundColor: isSelected ? `${primary}12` : 'transparent',
                    }}
                    onClick={() => setSelectedDeptId(dept.id)}
                >
                    <div className="flex items-center gap-2">
                        <ChevronRight
                            className={`h-3 w-3 text-slate-400 transition-transform ${subDepts.length ? 'group-hover:translate-x-0.5' : 'opacity-0'
                                }`}
                        />
                        <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                                {dept.name}
                                {!dept.is_active && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            {dept.code && (
                                <div className="text-[11px] text-slate-500">
                                    Code: {dept.code}
                                </div>
                            )}
                        </div>
                    </div>
                    {(canManageDeptsUpdate || canManageDeptsDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canManageDeptsUpdate && (
                                <button
                                    type="button"
                                    onClick={e => {
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
                                    onClick={e => {
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
                        {subDepts.map(child => renderDeptRow(child))}
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
                        style={{ backgroundColor: `${primary}10` }}
                    >
                        <FlaskConical
                            className="h-5 w-5"
                            style={{ color: primary }}
                        />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-900">
                            Laboratory Report Masters
                        </h1>
                        <p className="text-xs text-slate-500">
                            Configure LIS departments, sub-departments and test master
                            services for NABH-compliant lab reports.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <div className="hidden items-center gap-1 rounded-full bg-slate-50 px-3 py-1 md:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Auto-sets <span className="font-semibold">Unit</span> &
                        <span className="font-semibold">Normal Range</span> to
                        “-” when empty
                    </div>
                </div>
            </div>

            <div className="grid flex-1 gap-4 xl:grid-cols-[320px,1fr] lg:grid-cols-[280px,1fr]">
                {/* Left – Departments */}
                <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
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
                                onChange={e => setDeptSearch(e.target.value)}
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

                    <div className="scrollbar-thin flex-1 overflow-y-auto rounded-2xl bg-slate-50/60 p-2">
                        {loadingDepts ? (
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                Loading departments…
                            </div>
                        ) : filteredTopLevelDepts.length ? (
                            filteredTopLevelDepts.map(d => renderDeptRow(d))
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

                    {/* Quick add sub-dept for selected parent */}
                    {selectedDept && canManageDeptsCreate && (
                        <button
                            type="button"
                            onClick={() => openNewDeptModal(selectedDept.id)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-white"
                        >
                            <Plus className="h-3 w-3" />
                            Add sub-department under <span className="font-semibold">{selectedDept.name}</span>
                        </button>
                    )}
                </div>

                {/* Right – Services */}
                <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">
                                {selectedDept
                                    ? `Services for ${selectedDept.name}`
                                    : 'Select a department'}
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Add department-wise test master with units, normal ranges and
                                method details.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Filter className="pointer-events-none absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                                <input
                                    type="text"
                                    className="h-8 w-40 rounded-full border border-slate-200 bg-slate-50 pl-7 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                                    placeholder="Filter services…"
                                    value={serviceSearch}
                                    onChange={e => setServiceSearch(e.target.value)}
                                    disabled={!selectedDept || !canViewServices}
                                />
                            </div>
                            <button
                                type="button"
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium ${showInactiveServices
                                        ? 'border-slate-800 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-600'
                                    }`}
                                onClick={() =>
                                    setShowInactiveServices(prev => !prev)
                                }
                                disabled={!selectedDept || !canViewServices}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Inactive
                            </button>

                            {canCreateServices && (
                                <>
                                    <button
                                        type="button"
                                        onClick={addDraftRow}
                                        disabled={!selectedDept}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add Row
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBulkSave}
                                        disabled={
                                            !selectedDept || !draftRows.length || bulkSaving
                                        }
                                        className="inline-flex items-center gap-1 rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-emerald-400 disabled:bg-emerald-400"
                                    >
                                        {bulkSaving ? (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Save className="h-3 w-3" />
                                        )}
                                        Save All
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="scrollbar-thin flex-1 overflow-auto rounded-2xl border border-slate-100">
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
                                            Comments Template
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
                                    {/* Existing services */}
                                    {filteredServices.map((svc, idx) => {
                                        const isEditing = editingServiceId === svc.id
                                        const buf = isEditing ? serviceEditBuffer : svc
                                        return (
                                            <tr
                                                key={svc.id}
                                                className={idx % 2 ? 'bg-slate-50/40' : 'bg-white'}
                                            >
                                                <td className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                                                    {idx + 1}
                                                </td>
                                                <td className="border-b border-slate-100 px-3 py-1.5">
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                        value={buf?.name || ''}
                                                        onChange={e =>
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
                                                        onChange={e =>
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
                                                        onChange={e =>
                                                            handleServiceEditChange('unit', e.target.value)
                                                        }
                                                        disabled={!canUpdateServices || !isEditing}
                                                    />
                                                </td>
                                                <td className="border-b border-slate-100 px-3 py-1.5">
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                        placeholder="-"
                                                        value={buf?.normal_range || ''}
                                                        onChange={e =>
                                                            handleServiceEditChange(
                                                                'normal_range',
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={!canUpdateServices || !isEditing}
                                                    />
                                                </td>
                                                <td className="border-b border-slate-100 px-3 py-1.5">
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                        value={buf?.sample_type || ''}
                                                        onChange={e =>
                                                            handleServiceEditChange(
                                                                'sample_type',
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={!canUpdateServices || !isEditing}
                                                    />
                                                </td>
                                                <td className="border-b border-slate-100 px-3 py-1.5">
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
                                                        value={buf?.method || ''}
                                                        onChange={e =>
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
                                                        onChange={e =>
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
                                                        onChange={e =>
                                                            handleServiceEditChange(
                                                                'is_active',
                                                                e.target.checked
                                                            )
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
                                        )
                                    })}

                                    {/* Draft (new) rows */}
                                    {draftRows.map((row, idx) => (
                                        <tr
                                            key={`draft-${idx}`}
                                            className="bg-emerald-50/40 text-[11px]"
                                        >
                                            <td className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                                                {filteredServices.length + idx + 1}
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="Service name*"
                                                    value={row.name}
                                                    onChange={e =>
                                                        handleDraftChange(idx, 'name', e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="Code"
                                                    value={row.code}
                                                    onChange={e =>
                                                        handleDraftChange(idx, 'code', e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="-"
                                                    value={row.unit}
                                                    onChange={e =>
                                                        handleDraftChange(idx, 'unit', e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="-"
                                                    value={row.normal_range}
                                                    onChange={e =>
                                                        handleDraftChange(
                                                            idx,
                                                            'normal_range',
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="Serum / Plasma..."
                                                    value={row.sample_type}
                                                    onChange={e =>
                                                        handleDraftChange(
                                                            idx,
                                                            'sample_type',
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="Method"
                                                    value={row.method}
                                                    onChange={e =>
                                                        handleDraftChange(idx, 'method', e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5">
                                                <textarea
                                                    rows={1}
                                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                                    placeholder="Default comments"
                                                    value={row.comments_template}
                                                    onChange={e =>
                                                        handleDraftChange(
                                                            idx,
                                                            'comments_template',
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5 text-center text-[11px] text-slate-500">
                                                Yes
                                            </td>
                                            <td className="border-b border-slate-100 px-3 py-1.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDraftRows(prev =>
                                                            prev.filter((_, i) => i !== idx)
                                                        )
                                                    }
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                    title="Remove row"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {!filteredServices.length && !draftRows.length && (
                                        <tr>
                                            <td
                                                colSpan={10}
                                                className="px-3 py-5 text-center text-[11px] text-slate-500"
                                            >
                                                No services found for this department.
                                                {canCreateServices && (
                                                    <>
                                                        {' '}
                                                        Click{' '}
                                                        <span className="font-semibold">Add Row</span> to
                                                        start adding tests.
                                                    </>
                                                )}
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
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
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
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>

                        <form onSubmit={handleDeptSave} className="space-y-3 px-4 py-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700">
                                    Department name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                                    value={deptForm.name}
                                    onChange={handleDeptFormChange}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-700">
                                        Code
                                    </label>
                                    <input
                                        name="code"
                                        type="text"
                                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
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
                                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
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
                                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                                    value={deptForm.parent_id || ''}
                                    onChange={handleDeptFormChange}
                                >
                                    <option value="">None (Top level)</option>
                                    {topLevelDepts.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                                    value={deptForm.description}
                                    onChange={handleDeptFormChange}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
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
                                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingDept}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        {savingDept && (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                        )}
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
