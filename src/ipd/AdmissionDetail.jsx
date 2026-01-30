// FILE: src/ipd/AdmissionDetail.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useCan } from '../hooks/useCan'
import { toast } from 'sonner'
import {
    getAdmission,
    cancelAdmission,
    // transferBed,
    listBeds,
    getPatient,
    getClinicalNotes,
    updateClinicalNotes,
} from '../api/ipd'

// Common components
import WardRoomBedPicker from './components/WardRoomBedPicker'

// Quick Orders
import QuickOrders from '../components/QuickOrders'

// Tabs (existing)
import Nursing from './tabs/Nursing'
import Vitals from './tabs/Vitals'
import IntakeOutput from './tabs/IntakeOutput'
import Referrals from './tabs/Referrals'
import Discharge from './tabs/Discharge'
import BedCharges from './tabs/BedCharges'

// NEW TABS
import AssessmentsTab from './tabs/Assessments'
import MedicationsTab from './tabs/Medications'
import DischargeMedsTab from './tabs/DischargeMeds'
import FeedbackTab from './tabs/Feedback'

import {
    Tabs as UITabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
    Bell,
    CalendarDays,
    ChevronRight,
    CircleDot,
    LayoutDashboard,
    Menu,
    Search,
    ShieldCheck,
    Users,
    BedDouble,
    Activity,
    HeartPulse,
    Pill,
    ClipboardList,
    FileText,
    Wallet,
    Sparkles,
    AlertTriangle,
    X,
    Stethoscope,
} from 'lucide-react'

import NursingProcedures from './nursing/NursingProcedures'
import BedTransferTab from './tabs/BedTransferTab'
import ReportsTab from './tabs/ReportsTab'
import NewbornResuscitation from './nursing/NewbornResuscitation'

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const cn = (...xs) => xs.filter(Boolean).join(' ')

const admissionCode = (aid) => {
    if (!aid && aid !== 0) return '—'
    return `ADM-${String(aid).padStart(6, '0')}`
}

const formatIST = (dt) => {
    if (!dt) return '—'
    try {
        return new Date(dt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return String(dt)
    }
}

const initials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return '—'
    const a = parts[0]?.[0] || ''
    const b = parts[1]?.[0] || ''
    return (a + b).toUpperCase()
}

const clamp01 = (n) => Math.max(0, Math.min(1, n))

const pickData = (res) => {
    // supports:
    // axios: res.data
    // wrapped: {status:true, data:...}
    // direct object/array
    const d = res?.data ?? res
    if (d && typeof d === 'object' && 'status' in d && 'data' in d) return d.data
    return d
}

const buildPatientName = (patient) =>
    patient?.full_name ||
    patient?.name ||
    [patient?.prefix, patient?.first_name, patient?.last_name].filter(Boolean).join(' ') ||
    '—'

const toneForStatus = (statusRaw) => {
    const status = (statusRaw || '').toLowerCase()
    if (['active', 'admitted', 'in_progress'].includes(status)) return 'bg-emerald-50 text-emerald-700'
    if (['cancelled', 'canceled'].includes(status)) return 'bg-rose-50 text-rose-700'
    if (['discharged', 'completed'].includes(status)) return 'bg-slate-100 text-slate-700'
    if (['transferred'].includes(status)) return 'bg-amber-50 text-amber-700'
    return 'bg-slate-100 text-slate-700'
}

function ProgressRing({ value = 0.6, label = 'Progress' }) {
    const v = clamp01(value)
    const size = 54
    const stroke = 6
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const dash = c * (1 - v)

    return (
        <div className="flex items-center gap-3">
            <svg width={size} height={size} className="shrink-0">
                <defs>
                    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgb(59 130 246)" />
                        <stop offset="100%" stopColor="rgb(139 92 246)" />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="rgb(226 232 240)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={dash}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>

            <div className="min-w-0">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-sm font-semibold text-slate-900">{Math.round(v * 100)}%</div>
            </div>
        </div>
    )
}

function MiniBars({ values = [30, 45, 25, 60, 50, 70, 55] }) {
    const max = Math.max(...values, 1)
    return (
        <div className="flex items-end gap-1.5">
            {values.map((v, i) => (
                <div
                    key={i}
                    className="w-2.5 rounded-full bg-slate-200"
                    style={{ height: `${Math.max(10, (v / max) * 44)}px` }}
                >
                    <div
                        className="h-full w-full rounded-full bg-gradient-to-b from-sky-500 to-violet-500 opacity-90"
                        style={{ height: '100%' }}
                    />
                </div>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------
// NEW TAB: Dashboard
// ---------------------------------------------------------------------
function DashboardTab({ admission, patient, beds = [], onNavigateTab }) {
    const currentBed =
        admission?.current_bed_id && beds.find((b) => b.id === admission.current_bed_id)

    const admittedAt = admission?.admitted_at ? new Date(admission.admitted_at) : null
    const losDays = admittedAt
        ? Math.max(0, Math.floor((Date.now() - admittedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 0

    const patientName = buildPatientName(patient)
    const uhid = patient?.uhid || (admission?.patient_id ? `P-${admission.patient_id}` : '—')

    const status = (admission?.status || '—').toLowerCase()
    const statusTone = toneForStatus(status)

    const vitalsCompliance = ['active', 'admitted', 'in_progress'].includes(status) ? 0.78 : 0.42
    const medsCoverage = ['active', 'admitted', 'in_progress'].includes(status) ? 0.66 : 0.3

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[12px] font-semibold text-slate-600">Admission</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-base font-semibold text-slate-900">
                            {admissionCode(admission?.id)}
                        </div>
                        <div className="mt-1 text-[12px] text-slate-500">
                            Admitted:{' '}
                            <span className="text-slate-700">{formatIST(admission?.admitted_at)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[12px] font-semibold text-slate-600">Patient</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-base font-semibold text-slate-900 truncate">{patientName}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                            UHID: <span className="text-slate-700">{uhid}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[12px] font-semibold text-slate-600">Bed / Ward</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-base font-semibold text-slate-900">
                            {currentBed?.code || '—'}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[12px] font-semibold text-slate-600">Status</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                            <Badge className={cn('rounded-full hover:bg-transparent', statusTone)}>
                                <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                {status === '—' ? '—' : status}
                            </Badge>
                            <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                                LOS {losDays}d
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
                            <HeartPulse className="h-4 w-4 text-rose-500" />
                            Vitals compliance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3 pt-0">
                        <ProgressRing value={vitalsCompliance} label="Last 24 hours" />
                        <div className="text-right">
                            <div className="text-[11px] text-slate-500">Trend</div>
                            <div className="mt-1">
                                <MiniBars values={[30, 50, 40, 60, 55, 70, 62]} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
                            <Pill className="h-4 w-4 text-violet-600" />
                            Medication coverage
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3 pt-0">
                        <ProgressRing value={medsCoverage} label="Drug chart" />
                        <div className="text-right">
                            <div className="text-[11px] text-slate-500">IP No</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                                {admissionCode(admission?.id)}
                            </div>
                            <div className="text-[11px] text-slate-500">Active bed charges running</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-gradient-to-br from-sky-50 via-white to-violet-50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
                            <Sparkles className="h-4 w-4 text-sky-600" />
                            Quick actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 justify-between rounded-2xl bg-white"
                                onClick={() => onNavigateTab?.('vitals')}
                            >
                                Open Vitals <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 justify-between rounded-2xl bg-white"
                                onClick={() => onNavigateTab?.('medications')}
                            >
                                Open Drug Chart <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 justify-between rounded-2xl bg-white"
                                onClick={() => onNavigateTab?.('bed-transfer')}
                            >
                                Bed Transfer <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// NEW TAB: Quick Orders
// ---------------------------------------------------------------------
function QuickOrdersTab({ admission, patient, beds = [] }) {
    const currentBed =
        admission?.current_bed_id && beds.find((b) => b.id === admission.current_bed_id)

    const ipNumber = admission?.ip_number || admission?.ipNo || admission?.admission_code || null
    const bedLabel = currentBed?.code || null

    return (
        <Card className="rounded-3xl border-0 bg-white shadow-sm">
            <CardContent className="pt-0">
                <QuickOrders
                    patient={patient}
                    contextType="ipd"
                    contextId={admission?.id}
                    ipNumber={ipNumber}
                    bedLabel={bedLabel}
                />
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------
// NEW TAB: Clinical Notes
// ---------------------------------------------------------------------
function ClinicalNotesTab({ admission, patient, canWrite }) {
    const [clinicalData, setClinicalData] = useState({
        preliminaryDiagnosis: '',
        shortHistory: '',
        carePlan: ''
    })
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const fetchClinicalNotes = async () => {
        if (!admission?.id) return
        setLoading(true)
        try {
            const response = await getAdmission(admission.id)
            const data = response?.data || response
            setClinicalData({
                preliminaryDiagnosis: data.preliminary_diagnosis || '',
                shortHistory: data.history || '',
                carePlan: data.care_plan || ''
            })
        } catch (error) {
            console.error('Failed to fetch clinical notes:', error)
        } finally {
            setLoading(false)
        }
    }

    const saveClinicalNotes = async () => {
        if (!admission?.id) return
        setSaving(true)
        try {
            await updateClinicalNotes(admission.id, {
                preliminary_diagnosis: clinicalData.preliminaryDiagnosis,
                history: clinicalData.shortHistory,
                care_plan: clinicalData.carePlan
            })
            
            toast.success("Clinical notes saved successfully")
            
            // Clear the form data
            setClinicalData({
                preliminaryDiagnosis: '',
                shortHistory: '',
                carePlan: ''
            })
        } catch (error) {
            console.error('Failed to save clinical notes:', error)
            toast.error("Failed to save clinical notes")
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        fetchClinicalNotes()
    }, [admission?.id])

    const handleFieldChange = (field, value) => {
        setClinicalData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1">
                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-900">Preliminary Diagnosis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canWrite ? (
                            <Textarea
                                value={clinicalData.preliminaryDiagnosis}
                                onChange={(e) => handleFieldChange('preliminaryDiagnosis', e.target.value)}
                                placeholder="Preliminary diagnosis"
                                className="min-h-[80px] rounded-2xl"
                            />
                        ) : (
                            <div className="text-sm text-slate-600">
                                {clinicalData.preliminaryDiagnosis || 'No preliminary diagnosis available'}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-900">Short History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canWrite ? (
                            <Textarea
                                value={clinicalData.shortHistory}
                                onChange={(e) => handleFieldChange('shortHistory', e.target.value)}
                                placeholder="Short history..."
                                className="min-h-[80px] rounded-2xl"
                            />
                        ) : (
                            <div className="text-sm text-slate-600">
                                {clinicalData.shortHistory || 'No short history available'}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-900">Care Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canWrite ? (
                            <Textarea
                                value={clinicalData.carePlan}
                                onChange={(e) => handleFieldChange('carePlan', e.target.value)}
                                placeholder="Care plan..."
                                className="min-h-[100px] rounded-2xl"
                            />
                        ) : (
                            <div className="text-sm text-slate-600">
                                {clinicalData.carePlan || 'No care plan available'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {canWrite && (
                <div className="flex justify-end">
                    <Button
                        onClick={saveClinicalNotes}
                        disabled={saving}
                        className="rounded-2xl bg-sky-600 hover:bg-sky-700"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------
const TABS = [
    { key: 'dashboard', label: 'Dashboard', el: DashboardTab, writePerm: null, icon: LayoutDashboard },
    { key: 'quick-orders', label: 'Quick Orders', el: QuickOrdersTab, writePerm: null, icon: Sparkles },

    { key: 'nursing', label: 'Nursing Notes', el: Nursing, writePerm: 'ipd.nursing', icon: ClipboardList },
    { key: 'vitals', label: 'Vitals', el: Vitals, writePerm: 'ipd.nursing', icon: HeartPulse },
    { key: 'io', label: 'Intake/Output', el: IntakeOutput, writePerm: 'ipd.nursing', icon: Activity },

    { key: 'assessments', label: 'Assessments', el: AssessmentsTab, writePerm: 'ipd.nursing', icon: FileText },
    { key: 'clinical-notes', label: 'Clinical Notes', el: ClinicalNotesTab, writePerm: 'ipd.doctor', icon: Stethoscope },
    { key: 'medications', label: 'Medications / Drug Chart', el: MedicationsTab, writePerm: 'ipd.doctor', icon: Pill },
    { key: 'nursing_procedures', label: 'Nursing Procedures', el: NursingProcedures, writePerm: 'ipd.nursing', icon: Sparkles },
    { key: 'discharge-meds', label: 'Discharge Meds', el: DischargeMedsTab, writePerm: 'ipd.doctor', icon: Pill },

    { key: 'bed-transfer', label: 'Bed / Transfer', el: BedTransferTab, writePerm: 'ipd.manage', icon: BedDouble },

    { key: 'referrals', label: 'Referrals', el: Referrals, writePerm: 'ipd.manage', icon: Users },
    { key: 'discharge', label: 'Discharge Summary', el: Discharge, writePerm: 'ipd.manage', icon: FileText },
    // { key: 'charges', label: 'Bed Charges', el: BedCharges, writePerm: 'ipd.manage', icon: Wallet },
    { key: 'feedback', label: 'Feedback', el: FeedbackTab, writePerm: 'ipd.manage', icon: ShieldCheck },
    { key: 'newborn_resuscitation', label: 'Newborn Resuscitation ', el: NewbornResuscitation, writePerm: 'ipd.manage', icon: ShieldCheck },
    { key: 'reports', label: 'Reports', el: ReportsTab, writePerm: 'ipd.manage', icon: ShieldCheck },
]

const NAV_GROUPS = [
    { title: 'Overview', keys: ['dashboard', 'quick-orders', 'nursing', 'vitals', 'io'] },
    { title: 'Clinical', keys: ['assessments', 'clinical-notes', 'medications', 'nursing_procedures', 'discharge-meds'] },
    { title: 'Operations', keys: ['bed-transfer', 'referrals', 'discharge', 'charges', 'feedback', 'newborn_resuscitation', 'reports'] },
]

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------
export default function AdmissionDetail() {
    const { id } = useParams()
    const location = useLocation()
    const admissionFromList = location?.state?.admission || null

    // ✅ ALL hooks must be before any early return (fixes crash/login redirect)
    const [admission, setAdmission] = useState(admissionFromList)
    const [beds, setBeds] = useState([])
    const [active, setActive] = useState('dashboard')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [patient, setPatient] = useState(null)

    const [searchText, setSearchText] = useState('')
    const [lang, setLang] = useState('en')

    // ✅ moved up (was causing hook-order crash)
    const [navOpen, setNavOpen] = useState(false)

    // permissions
    const canView = useCan('ipd.view')
    const canManage = useCan('ipd.manage')
    const canNursingWrite = useCan('ipd.nursing')
    const canDoctorWrite = useCan('ipd.doctor')

    const permMap = {
        'ipd.nursing': canNursingWrite,
        'ipd.doctor': canDoctorWrite,
        'ipd.manage': canManage,
    }

    // ✅ moved up (was below early returns in your file => crash)
    const tabByKey = useMemo(() => {
        const map = {}
        TABS.forEach((t) => (map[t.key] = t))
        return map
    }, [])

    const filteredTabs = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        if (!q) return TABS
        return TABS.filter((t) => t.label.toLowerCase().includes(q))
    }, [searchText])

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [admissionRes, bedsRes] = await Promise.all([getAdmission(Number(id)), listBeds()])

            const admRaw = pickData(admissionRes)
            const bedsRaw = pickData(bedsRes)

            const adm = admRaw || admissionFromList || null
            setAdmission(adm)

            const bedArr = Array.isArray(bedsRaw) ? bedsRaw : Array.isArray(bedsRaw?.items) ? bedsRaw.items : []
            setBeds(bedArr)

            if (adm?.patient_id) {
                try {
                    const pRes = await getPatient(adm.patient_id)
                    const p = pickData(pRes)
                    setPatient(p || null)
                } catch {
                    setPatient(null)
                }
            } else {
                setPatient(null)
            }
        } catch (e) {
            const s = e?.status || e?.response?.status
            if (s === 404 && admissionFromList) {
                setAdmission(admissionFromList)
            } else {
                setError(e?.response?.data?.detail || 'Failed to load admission details')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const doCancel = async () => {
        if (!admission) return
        if (!window.confirm('Are you sure you want to cancel this admission?')) return
        try {
            await cancelAdmission(admission.id)
            window.location.assign('/ipd/tracking')
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Cancel failed')
        }
    }

    // ✅ early returns are now safe (no hooks below this point)
    if (!canView && !canManage) {
        return <div className="p-4 text-sm text-rose-700">Access denied (need ipd.view).</div>
    }
    if (loading && !admission) return <div className="p-4 text-sm">Loading…</div>
    if (!admission) return <div className="p-4 text-sm">No data</div>

    const currentBed =
        admission?.current_bed_id && beds.find((b) => b.id === admission.current_bed_id)

    const patientName = buildPatientName(patient) // ✅ fixed (no "undefined. undefined")
    const uhid = patient?.uhid || (admission?.patient_id ? `P-${admission.patient_id}` : '—')

    const status = (admission?.status || '—').toLowerCase()
    const statusTone = toneForStatus(status)

    const Sidebar = ({ onSelect }) => (
        <div className="space-y-4">
            <div className="rounded-3xl bg-white/70 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm">
                        <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">IPD Console</div>
                        <div className="text-[11px] text-slate-500 truncate">
                            {admissionCode(admission?.id)} • {uhid}
                        </div>
                    </div>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Patient
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 truncate">{patientName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={cn('rounded-full hover:bg-transparent', statusTone)}>
                            <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                            {status}
                        </Badge>
                        {currentBed?.code ? (
                            <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                                Bed {currentBed.code}
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="rounded-3xl bg-white/70 p-3 shadow-sm backdrop-blur">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Navigate
                </div>

                <div className="space-y-3">
                    {NAV_GROUPS.map((g) => (
                        <div key={g.title}>
                            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {g.title}
                            </div>

                            <div className="space-y-1">
                                {g.keys
                                    .map((k) => tabByKey[k])
                                    .filter(Boolean)
                                    .map((t) => {
                                        const Icon = t.icon || CircleDot
                                        const isActive = active === t.key
                                        const canWriteThis = t.writePerm ? (permMap[t.writePerm] ?? false) : false

                                        return (
                                            <button
                                                key={t.key}
                                                type="button"
                                                onClick={() => onSelect(t.key)}
                                                className={cn(
                                                    'group flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[12px] transition',
                                                    isActive
                                                        ? 'bg-gradient-to-r from-sky-500/10 to-violet-500/10 text-slate-900'
                                                        : 'hover:bg-slate-100/70 text-slate-700',
                                                )}
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div
                                                        className={cn(
                                                            'flex h-8 w-8 items-center justify-center rounded-2xl transition',
                                                            isActive
                                                                ? 'bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{t.label}</div>
                                                        <div className="mt-0.5 text-[10px] text-slate-400">
                                                            {canWriteThis ? 'Write access' : 'View'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
                                            </button>
                                        )
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const TopHeader = ({ onOpenNav }) => (
        <>
            {/* MOBILE ONLY */}
            <div className="md:hidden">
                <div className="rounded-[28px] border border-slate-200/70 bg-white/85 px-3 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onOpenNav}
                            className="h-9 w-9 rounded-2xl px-0"
                        >
                            <Menu className="h-4 w-4" />
                            <span className="sr-only">Menu</span>
                        </Button>

                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-[15px] font-semibold text-slate-900">
                                IPD Admission
                            </h1>
                        </div>

                        {canManage && (
                            <Button
                                type="button"
                                onClick={doCancel}
                                className="h-9 rounded-2xl bg-rose-600 px-3 text-sm text-white shadow-sm hover:bg-rose-700"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* WEB / TABLET (md+) */}
            <div className="hidden md:block">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 md:flex-1">
                        <h1 className="text-lg font-semibold text-slate-900 md:text-xl">IPD Admission</h1>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                            Premium clinical workspace • fast, clean, and audit-friendly
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end md:shrink-0">
                        <div className="flex items-center gap-2 sm:hidden">
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={onOpenNav}>
                                <Menu className="h-4 w-4" />
                                <span className="ml-2 text-sm">Menu</span>
                            </Button>
                        </div>

                        {canManage && (
                            <Button
                                type="button"
                                onClick={doCancel}
                                className="h-10 rounded-2xl bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )

    return (
        <div className="min-h-screen bg-[#F7F7FB]">
            <div className="w-full px-3 py-3 md:px-6 md:py-6 2xl:px-10">
                {/* Mobile Nav Sheet */}
                <Sheet open={navOpen} onOpenChange={setNavOpen}>
                    <SheetContent
                        side="left"
                        className="w-[320px] bg-[#F7F7FB] p-0 flex h-[100dvh] flex-col"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 bg-[#F7F7FB]/95 px-3 py-3 backdrop-blur">
                            <div className="text-sm font-semibold text-slate-900">Navigation</div>
                            <Button variant="outline" className="h-9 rounded-2xl" onClick={() => setNavOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                            <Sidebar
                                onSelect={(k) => {
                                    setActive(k)
                                    setNavOpen(false)
                                }}
                            />
                        </div>
                    </SheetContent>
                </Sheet>

                <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    {/* Left Sidebar (desktop) */}
                    <aside className="hidden lg:block">
                        <Sidebar onSelect={setActive} />
                    </aside>

                    {/* Main */}
                    <main className="min-w-0 space-y-4">
                        <TopHeader onOpenNav={() => setNavOpen(true)} />

                        {error && (
                            <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                                {error}
                            </div>
                        )}

                        <Card className="rounded-3xl border-0 bg-white shadow-sm">
                            <UITabs value={active} onValueChange={setActive} className="w-full">
                                {/* Mobile/Tablet tab pills */}
                                <div className="mb-3 lg:hidden">
                                    <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-2">
                                        {(filteredTabs.length ? filteredTabs : TABS).map((t) => {
                                            const canWriteThis = t.writePerm ? (permMap[t.writePerm] ?? false) : false
                                            const Icon = t.icon || CircleDot
                                            return (
                                                <TabsTrigger
                                                    key={t.key}
                                                    value={t.key}
                                                    className="shrink-0 rounded-2xl px-3 py-2 text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-violet-500 data-[state=active]:text-white"
                                                >
                                                    <Icon className="mr-2 h-4 w-4" />
                                                    {t.label}
                                                    {!canWriteThis && (
                                                        <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-[10px]">
                                                            view
                                                        </span>
                                                    )}
                                                </TabsTrigger>
                                            )
                                        })}
                                    </TabsList>
                                </div>

                                {/* Tab content */}
                                <div className="rounded-3xl bg-slate-50 p-2 md:p-3">
                                    {TABS.map((t) => {
                                        const TabEl = t.el
                                        const canWriteThis = t.writePerm ? (permMap[t.writePerm] ?? false) : false
                                        const Icon = t.icon || CircleDot

                                        return (
                                            <TabsContent key={t.key} value={t.key} className="mt-0">
                                                <div className="rounded-3xl bg-white p-2 shadow-sm md:p-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm">
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-slate-900">{t.label}</div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    {canWriteThis ? 'Write enabled' : 'View'} • IST time format
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <Badge
                                                            className={cn(
                                                                'rounded-full hover:bg-transparent',
                                                                canWriteThis
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-slate-100 text-slate-700',
                                                            )}
                                                        >
                                                            {canWriteThis ? 'Editable' : 'Readonly'}
                                                        </Badge>
                                                    </div>

                                                    <TabEl
                                                        admissionId={admission?.id}
                                                        admission={admission}
                                                        patient={patient}
                                                        canWrite={canWriteThis}
                                                        beds={beds}
                                                        onNavigateTab={setActive}
                                                    />
                                                </div>
                                            </TabsContent>
                                        )
                                    })}
                                </div>
                            </UITabs>
                        </Card>
                    </main>
                </div>
            </div>
        </div>
    )
}
