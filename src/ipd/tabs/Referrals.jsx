// FILE: src/ipd/tabs/Referrals.jsx
import { useEffect, useMemo, useState } from 'react'
import DeptRoleUserPicker from '../../opd/components/DeptRoleUserPicker'
import { useCanAny } from '../../hooks/useCan'
import {
    acceptIpdReferral,
    cancelIpdReferral,
    closeIpdReferral,
    createIpdReferral,
    declineIpdReferral,
    getIpdReferral,
    getIpdReferrals,
    respondIpdReferral,
} from '../../api/ipdReferrals'

import {
    AlertTriangle,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Filter,
    Loader2,
    Plus,
    RefreshCcw,
    Search,
    Stethoscope,
    UserRound,
    X,
    XCircle,
    Check,
    MessageSquareText,
    Ban,
    DoorClosed,
    ThumbsDown,
} from 'lucide-react'

/* -----------------------------
   Helpers
------------------------------ */
const cx = (...a) => a.filter(Boolean).join(' ')

const parseUtcish = (dt) => {
    if (!dt) return null
    if (dt instanceof Date) return dt

    let s = String(dt).trim()

    // If it's already not an ISO datetime string, just return null and fallback
    // (prevents "Invalid Date" for already formatted text)
    const looksDateLike = /^\d{4}-\d{2}-\d{2}/.test(s)
    if (!looksDateLike) return null

    // MySQL style: "YYYY-MM-DD HH:MM:SS" -> ISO "YYYY-MM-DDTHH:MM:SS"
    s = s.replace(' ', 'T')

    // If timezone already present (Z or +05:30), keep as is
    const hasTz = /Z$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)
    if (!hasTz) s = `${s}Z` // IMPORTANT: treat as UTC

    return new Date(s)
}

const fmtWhen = (dt) => {
    const d = parseUtcish(dt)
    if (!d || Number.isNaN(d.getTime())) return dt ? String(dt) : '—'

    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}


const pretty = (s) =>
    String(s || '')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

const normRef = (r) => {
    // backward compatible with old backend fields
    const ref_type = r?.ref_type || r?.type || 'internal'
    const category = r?.category || (ref_type === 'external' ? 'transfer' : 'clinical')
    const care_mode =
        r?.care_mode ||
        (category === 'transfer' ? 'transfer' : category === 'co_manage' ? 'co_manage' : 'opinion')
    const priority = r?.priority || 'routine'

    return {
        ...r,
        ref_type,
        category,
        care_mode,
        priority,
        requested_at: r?.requested_at || r?.created_at,
    }
}

const badgeTone = (kind, value) => {
    const v = String(value || '').toLowerCase()

    if (kind === 'status') {
        if (v === 'requested') return 'bg-slate-100 text-slate-700 border-slate-200'
        if (v === 'accepted') return 'bg-indigo-50 text-indigo-700 border-indigo-100'
        if (v === 'responded') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        if (v === 'closed') return 'bg-emerald-100/60 text-emerald-800 border-emerald-200'
        if (v === 'declined' || v === 'cancelled')
            return 'bg-rose-50 text-rose-700 border-rose-100'
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }

    if (kind === 'priority') {
        if (v === 'stat') return 'bg-rose-50 text-rose-700 border-rose-100'
        if (v === 'urgent') return 'bg-amber-50 text-amber-800 border-amber-100'
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }

    if (kind === 'category') {
        if (v === 'service') return 'bg-cyan-50 text-cyan-700 border-cyan-100'
        if (v === 'co_manage') return 'bg-violet-50 text-violet-700 border-violet-100'
        if (v === 'second_opinion') return 'bg-amber-50 text-amber-800 border-amber-100'
        if (v === 'transfer') return 'bg-blue-50 text-blue-700 border-blue-100'
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }

    return 'bg-slate-100 text-slate-700 border-slate-200'
}

const targetLabel = (r0) => {
    const r = normRef(r0)
    if (r.ref_type === 'external') return r.external_org || '—'
    if (r.category === 'service') return r.to_service ? pretty(r.to_service) : '—'
    if (r.to_user_id) return `User#${r.to_user_id}`
    if (r.to_department_id) return `Dept#${r.to_department_id}`
    return r.to_department || '—'
}

const canDo = (ref, action) => {
    const r = normRef(ref)
    const st = String(r.status || '').toLowerCase()

    if (action === 'accept') return st === 'requested'
    if (action === 'decline') return st === 'requested'
    if (action === 'respond') return st === 'accepted' || st === 'requested'
    if (action === 'close') return st === 'accepted' || st === 'responded'
    if (action === 'cancel') return st !== 'closed' && st !== 'cancelled'
    return false
}

function useLockBodyScroll(open) {
    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [open])
}

/* -----------------------------
   Small UI components
------------------------------ */
function Modal({ open, title, onClose, children, footer, closeDisabled = false }) {
    useLockBodyScroll(open)
    if (!open) return null

    const handleClose = () => {
        if (closeDisabled) return
        onClose?.()
    }

    return (
        <div className="fixed inset-0 z-[70]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Sheet / Dialog */}
            <div className="absolute inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
                <div
                    className={cx(
                        "w-full sm:max-w-2xl bg-white border border-slate-200 shadow-2xl",
                        "rounded-t-3xl sm:rounded-2xl",
                        "max-h-[92vh] sm:max-h-[85vh]",
                        "flex flex-col overflow-hidden"
                    )}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                >
                    {/* Header (sticky) */}
                    <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3">
                            <div className="min-w-0">
                                <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                    {title}
                                </div>
                            </div>

                            <button
                                type="button"
                                className={cx(
                                    "rounded-xl p-2 hover:bg-slate-100 active:bg-slate-200",
                                    closeDisabled && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={handleClose}
                                aria-label="Close"
                                disabled={closeDisabled}
                            >
                                <X className="h-5 w-5 text-slate-700" />
                            </button>
                        </div>
                    </div>

                    {/* Body (scrollable) */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                        {children}
                        {/* spacer so content doesn't hide under footer */}
                        <div className="h-4 sm:h-6" />
                    </div>

                    {/* Footer (sticky) */}
                    {footer ? (
                        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                            {footer}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function Chip({ tone, children }) {
    return (
        <span
            className={cx(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] sm:text-xs',
                tone
            )}
        >
            {children}
        </span>
    )
}

function IconBtn({ title, onClick, disabled, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={cx(
                'inline-flex items-center justify-center rounded-xl border px-2.5 py-2 text-xs font-semibold shadow-sm transition',
                'border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100',
                disabled && 'opacity-50 cursor-not-allowed'
            )}
        >
            {children}
        </button>
    )
}

/* -----------------------------
   Main
------------------------------ */
export default function Referrals({ admissionId }) {
    // permissions
    const canView = useCanAny(['ipd.referrals.view', 'ipd.view', 'ipd.manage', 'ipd.doctor', 'ipd.nursing'])
    const canCreate = useCanAny(['ipd.referrals.create', 'ipd.manage', 'ipd.doctor', 'ipd.nursing'])
    const canAccept = useCanAny(['ipd.referrals.accept', 'ipd.manage', 'ipd.doctor'])
    const canDecline = useCanAny(['ipd.referrals.decline', 'ipd.manage', 'ipd.doctor'])
    const canRespond = useCanAny(['ipd.referrals.respond', 'ipd.manage', 'ipd.doctor'])
    const canClose = useCanAny(['ipd.referrals.close', 'ipd.manage', 'ipd.doctor', 'ipd.nursing'])
    const canCancel = useCanAny(['ipd.referrals.cancel', 'ipd.manage', 'ipd.doctor', 'ipd.nursing'])

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    // picker state
    const [toUser, setToUser] = useState(null)
    const [toDept, setToDept] = useState(null)

    // filters
    const [q, setQ] = useState('')
    const [fltStatus, setFltStatus] = useState('all')
    const [fltType, setFltType] = useState('all')
    const [fltCategory, setFltCategory] = useState('all')

    // form
    const [f, setF] = useState({
        ref_type: 'internal',
        category: 'clinical',
        care_mode: 'opinion',
        priority: 'routine',

        to_department: '',
        to_service: '',

        external_org: '',
        external_contact_name: '',
        external_contact_phone: '',
        external_address: '',

        reason: '',
        clinical_summary: '',
    })

    // action modal
    const [modal, setModal] = useState({ open: false, mode: '', ref: null })
    const [actionLoading, setActionLoading] = useState(false)
    const [actionErr, setActionErr] = useState('')
    const [note, setNote] = useState('') // used for accept/decline/close
    const [responseNote, setResponseNote] = useState('') // respond
    const [cancelReason, setCancelReason] = useState('') // cancel
    const [detail, setDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // Apple-ish styles
    const ui = {
        label: 'text-[11px] sm:text-xs font-medium text-slate-600',
        input:
            'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30',
        select:
            'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/30',
        textarea:
            'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30',
        btn:
            'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed',
        btnGhost:
            'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed',
    }

    const load = async () => {
        if (!admissionId) return
        setErr('')
        setLoading(true)
        try {
            const list = await getIpdReferrals(admissionId)
            setRows((Array.isArray(list) ? list : []).map(normRef))
        } catch (e) {
            setErr(e?.message || 'Failed to load referrals')
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!canView) return
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId, canView])

    // keep care_mode consistent with category
    useEffect(() => {
        setF((s) => {
            const next = { ...s }
            if (next.category === 'transfer') next.care_mode = 'transfer'
            else if (next.category === 'co_manage') next.care_mode = 'co_manage'
            else if (next.care_mode === 'transfer' && next.category !== 'transfer') next.care_mode = 'opinion'
            return next
        })
    }, [f.category])

    const resetForm = () => {
        setF({
            ref_type: 'internal',
            category: 'clinical',
            care_mode: 'opinion',
            priority: 'routine',
            to_department: '',
            to_service: '',
            external_org: '',
            external_contact_name: '',
            external_contact_phone: '',
            external_address: '',
            reason: '',
            clinical_summary: '',
        })
        setToUser(null)
        setToDept(null)
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!canCreate) {
            setErr('Not permitted')
            return
        }

        setErr('')
        const reason = (f.reason || '').trim()
        if (!reason) return setErr('Referral reason is required.')

        if (f.ref_type === 'internal') {
            if (f.category === 'service') {
                if (!(f.to_service || '').trim()) return setErr('Service referral requires a service (dietician/physio).')
            } else {
                if (!toUser && !toDept && !(f.to_department || '').trim()) return setErr('Select department/user for internal referral.')
            }
        } else {
            if (!(f.external_org || '').trim()) return setErr('External organization is required.')
            if (f.category === 'transfer' && !(f.clinical_summary || '').trim()) return setErr('Clinical summary is required for transfer.')
        }

        const payload = {
            ref_type: f.ref_type,
            category: f.category,
            care_mode: f.category === 'transfer' ? 'transfer' : f.care_mode,
            priority: f.priority,

            to_department_id: toDept || undefined,
            to_user_id: toUser || undefined,
            to_department: f.to_department || (toDept ? String(toDept) : ''),
            to_service: f.to_service || '',

            external_org: f.external_org || '',
            external_contact_name: f.external_contact_name || '',
            external_contact_phone: f.external_contact_phone || '',
            external_address: f.external_address || '',

            reason,
            clinical_summary: f.clinical_summary || '',
        }

        setSaving(true)
        try {
            await createIpdReferral(admissionId, payload)
            resetForm()
            await load()
        } catch (e1) {
            setErr(e1?.message || 'Failed to create referral')
        } finally {
            setSaving(false)
        }
    }

    const filtered = useMemo(() => {
        const term = (q || '').trim().toLowerCase()
        return (rows || [])
            .map(normRef)
            .filter((r) => {
                if (fltStatus !== 'all' && String(r.status || '') !== fltStatus) return false
                if (fltType !== 'all' && String(r.ref_type || '') !== fltType) return false
                if (fltCategory !== 'all' && String(r.category || '') !== fltCategory) return false

                if (!term) return true
                const hay = [
                    r.ref_type,
                    r.category,
                    r.care_mode,
                    r.priority,
                    r.reason,
                    r.clinical_summary,
                    r.external_org,
                    r.to_service,
                    r.to_department,
                    r.to_user_id ? `user#${r.to_user_id}` : '',
                    r.to_department_id ? `dept#${r.to_department_id}` : '',
                    r.status,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()

                return hay.includes(term)
            })
    }, [rows, q, fltStatus, fltType, fltCategory])

    const openAction = async (mode, ref) => {
        setActionErr('')
        setNote('')
        setResponseNote('')
        setCancelReason('')
        setDetail(null)

        setModal({ open: true, mode, ref })

        // preload details for "details" and also for action context
        try {
            setDetailLoading(true)
            const d = await getIpdReferral(admissionId, ref.id)
            setDetail(normRef(d))
        } catch {
            // fallback to row data if single fetch fails
            setDetail(normRef(ref))
        } finally {
            setDetailLoading(false)
        }
    }

    const closeModal = () => {
        if (actionLoading) return
        setModal({ open: false, mode: '', ref: null })
        setActionErr('')
        setNote('')
        setResponseNote('')
        setCancelReason('')
        setDetail(null)
    }

    const doAction = async () => {
        const ref = modal.ref
        if (!ref) return
        setActionErr('')
        setActionLoading(true)
        try {
            if (modal.mode === 'accept') {
                await acceptIpdReferral(admissionId, ref.id, { note: (note || '').trim() })
            } else if (modal.mode === 'decline') {
                const n = (note || '').trim()
                if (!n) throw new Error('Decline reason is required.')
                await declineIpdReferral(admissionId, ref.id, { note: n })
            } else if (modal.mode === 'respond') {
                const rn = (responseNote || '').trim()
                if (rn.length < 2) throw new Error('Response note is required.')
                await respondIpdReferral(admissionId, ref.id, { response_note: rn })
            } else if (modal.mode === 'close') {
                await closeIpdReferral(admissionId, ref.id, { note: (note || '').trim() })
            } else if (modal.mode === 'cancel') {
                const cr = (cancelReason || '').trim()
                if (cr.length < 2) throw new Error('Cancel reason is required.')
                await cancelIpdReferral(admissionId, ref.id, { reason: cr })
            }
            await load()
            closeModal()
        } catch (e) {
            setActionErr(e?.message || 'Action failed')
        } finally {
            setActionLoading(false)
        }
    }

    const ActionBar = ({ r }) => {
        const rr = normRef(r)
        const st = String(rr.status || '').toLowerCase()

        const allowAccept = canAccept && canDo(rr, 'accept')
        const allowDecline = canDecline && canDo(rr, 'decline')
        const allowRespond = canRespond && canDo(rr, 'respond')
        const allowClose = canClose && canDo(rr, 'close')
        const allowCancel = canCancel && canDo(rr, 'cancel')

        return (
            <div className="flex flex-wrap items-center gap-2">
                <IconBtn title="Details" onClick={() => openAction('details', rr)}>
                    <ClipboardList className="h-4 w-4 text-slate-700" />
                </IconBtn>

                <IconBtn title="Accept" disabled={!allowAccept} onClick={() => openAction('accept', rr)}>
                    <Check className="h-4 w-4 text-emerald-700" />
                </IconBtn>

                <IconBtn title="Decline" disabled={!allowDecline} onClick={() => openAction('decline', rr)}>
                    <ThumbsDown className="h-4 w-4 text-rose-700" />
                </IconBtn>

                <IconBtn title="Respond" disabled={!allowRespond} onClick={() => openAction('respond', rr)}>
                    <MessageSquareText className="h-4 w-4 text-indigo-700" />
                </IconBtn>

                <IconBtn title="Close" disabled={!allowClose} onClick={() => openAction('close', rr)}>
                    <DoorClosed className="h-4 w-4 text-slate-800" />
                </IconBtn>

                <IconBtn title="Cancel" disabled={!allowCancel || st === 'declined'} onClick={() => openAction('cancel', rr)}>
                    <Ban className="h-4 w-4 text-rose-700" />
                </IconBtn>
            </div>
        )
    }

    const Card = ({ r }) => {
        const rr = normRef(r)
        return (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Chip tone={badgeTone('category', rr.category)}>{pretty(rr.category)}</Chip>
                                <Chip tone={badgeTone('priority', rr.priority)}>{pretty(rr.priority)}</Chip>
                                <Chip tone={badgeTone('status', rr.status)}>{pretty(rr.status)}</Chip>
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-900">
                                {rr.ref_type === 'external' ? (
                                    <Building2 className="h-4 w-4 text-slate-500" />
                                ) : rr.category === 'service' ? (
                                    <Stethoscope className="h-4 w-4 text-slate-500" />
                                ) : (
                                    <UserRound className="h-4 w-4 text-slate-500" />
                                )}
                                <span className="truncate">{targetLabel(rr)}</span>
                            </div>

                            <div className="mt-1 text-xs sm:text-sm text-slate-600 line-clamp-2">
                                {rr.reason || '—'}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                                    <CalendarDays className="h-4 w-4" />
                                    <span>{fmtWhen(rr.requested_at)}</span>
                                </div>

                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                                    onClick={() => openAction('details', rr)}
                                >
                                    View <ChevronRight className="h-4 w-4 text-slate-500" />
                                </button>
                            </div>

                            <div className="mt-3">
                                <ActionBar r={rr} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!canView) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div className="text-sm sm:text-base font-semibold text-slate-900">Not permitted</div>
                </div>
                <div className="mt-1 text-sm text-slate-600">You don’t have permission to view IPD referrals.</div>
            </div>
        )
    }

    // Modal content builders
    const modalTitle = (() => {
        if (modal.mode === 'details') return 'Referral Details'
        if (modal.mode === 'accept') return 'Accept Referral'
        if (modal.mode === 'decline') return 'Decline Referral'
        if (modal.mode === 'respond') return 'Respond to Referral'
        if (modal.mode === 'close') return 'Close Referral'
        if (modal.mode === 'cancel') return 'Cancel Referral'
        return 'Referral'
    })()

    const d = detail ? normRef(detail) : (modal.ref ? normRef(modal.ref) : null)

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-base sm:text-lg font-bold text-slate-900">Referrals</div>
                        <div className="text-xs sm:text-sm text-slate-600">
                            Internal, Co-manage, Service, Second opinion, Transfer — NABH audit friendly
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className={ui.btnGhost} onClick={load} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-4 grid gap-2 md:grid-cols-12">
                    <div className="md:col-span-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                className={cx(ui.input, 'pl-9')}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search reason, org, service, status…"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <select className={ui.select} value={fltStatus} onChange={(e) => setFltStatus(e.target.value)}>
                            <option value="all">All Status</option>
                            <option value="requested">Requested</option>
                            <option value="accepted">Accepted</option>
                            <option value="declined">Declined</option>
                            <option value="responded">Responded</option>
                            <option value="closed">Closed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <select className={ui.select} value={fltType} onChange={(e) => setFltType(e.target.value)}>
                            <option value="all">All Type</option>
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <select className={ui.select} value={fltCategory} onChange={(e) => setFltCategory(e.target.value)}>
                            <option value="all">All Category</option>
                            <option value="clinical">Clinical</option>
                            <option value="co_manage">Co-manage</option>
                            <option value="service">Service</option>
                            <option value="second_opinion">Second Opinion</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Create Form */}
            <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <div className="text-sm sm:text-base font-semibold text-slate-900">Create Referral</div>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500">
                        {canCreate ? 'You can create referrals' : 'Read-only'}
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-12">
                    {/* Type */}
                    <div className="md:col-span-3">
                        <label className={ui.label}>Type</label>
                        <select
                            className={ui.select}
                            value={f.ref_type}
                            onChange={(e) => {
                                const v = e.target.value
                                setF((s) => ({
                                    ...s,
                                    ref_type: v,
                                    category: v === 'external' ? 'transfer' : 'clinical',
                                    care_mode: v === 'external' ? 'transfer' : 'opinion',
                                }))
                                setToUser(null)
                                setToDept(null)
                            }}
                            disabled={!canCreate}
                        >
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                        </select>
                    </div>

                    {/* Category */}
                    <div className="md:col-span-3">
                        <label className={ui.label}>Category</label>
                        <select
                            className={ui.select}
                            value={f.category}
                            onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}
                            disabled={!canCreate}
                        >
                            <option value="clinical">Clinical (Intra-hospital)</option>
                            <option value="co_manage">Co-manage</option>
                            <option value="service">Service (Dietician/Physio…)</option>
                            <option value="second_opinion">Second Opinion / Escalation</option>
                            <option value="transfer">Transfer / Higher Center</option>
                        </select>
                    </div>

                    {/* Priority */}
                    <div className="md:col-span-3">
                        <label className={ui.label}>Priority</label>
                        <select
                            className={ui.select}
                            value={f.priority}
                            onChange={(e) => setF((s) => ({ ...s, priority: e.target.value }))}
                            disabled={!canCreate}
                        >
                            <option value="routine">Routine</option>
                            <option value="urgent">Urgent</option>
                            <option value="stat">STAT</option>
                        </select>
                    </div>

                    {/* Care mode */}
                    <div className="md:col-span-3">
                        <label className={ui.label}>Care mode</label>
                        <select
                            className={ui.select}
                            value={f.category === 'transfer' ? 'transfer' : f.care_mode}
                            onChange={(e) => setF((s) => ({ ...s, care_mode: e.target.value }))}
                            disabled={!canCreate || f.category === 'transfer'}
                        >
                            <option value="opinion">Opinion</option>
                            <option value="co_manage">Co-manage</option>
                            <option value="take_over">Take over</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>

                    {/* Target */}
                    {f.ref_type === 'internal' ? (
                        <>
                            {f.category === 'service' ? (
                                <div className="md:col-span-12">
                                    <label className={ui.label}>Service</label>
                                    <input
                                        className={ui.input}
                                        value={f.to_service}
                                        onChange={(e) => setF((s) => ({ ...s, to_service: e.target.value }))}
                                        placeholder="e.g., dietician, physio, wound_care, psychology"
                                        disabled={!canCreate}
                                    />
                                </div>
                            ) : (
                                <div className="md:col-span-12">
                                    <DeptRoleUserPicker
                                        label="Department · Role · User"
                                        value={toUser || undefined}
                                        onChange={(userId, ctx) => {
                                            setToUser(userId || null)
                                            setToDept(ctx?.department_id || null)
                                            setF((s) => ({
                                                ...s,
                                                to_department: ctx?.department_id ? String(ctx.department_id) : '',
                                            }))
                                        }}
                                        disabled={!canCreate}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="md:col-span-6">
                                <label className={ui.label}>External organization</label>
                                <input
                                    className={ui.input}
                                    value={f.external_org}
                                    onChange={(e) => setF((s) => ({ ...s, external_org: e.target.value }))}
                                    placeholder="Hospital / Center name"
                                    disabled={!canCreate}
                                />
                            </div>
                            <div className="md:col-span-6">
                                <label className={ui.label}>Contact name</label>
                                <input
                                    className={ui.input}
                                    value={f.external_contact_name}
                                    onChange={(e) => setF((s) => ({ ...s, external_contact_name: e.target.value }))}
                                    placeholder="Doctor / Coordinator name"
                                    disabled={!canCreate}
                                />
                            </div>
                            <div className="md:col-span-6">
                                <label className={ui.label}>Contact phone</label>
                                <input
                                    className={ui.input}
                                    value={f.external_contact_phone}
                                    onChange={(e) => setF((s) => ({ ...s, external_contact_phone: e.target.value }))}
                                    placeholder="Phone / WhatsApp"
                                    disabled={!canCreate}
                                />
                            </div>
                            <div className="md:col-span-6">
                                <label className={ui.label}>Address</label>
                                <input
                                    className={ui.input}
                                    value={f.external_address}
                                    onChange={(e) => setF((s) => ({ ...s, external_address: e.target.value }))}
                                    placeholder="City / Address"
                                    disabled={!canCreate}
                                />
                            </div>
                        </>
                    )}

                    {/* Reason */}
                    <div className="md:col-span-12">
                        <label className={ui.label}>Reason</label>
                        <textarea
                            className={cx(ui.textarea, 'min-h-[80px]')}
                            value={f.reason}
                            onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))}
                            placeholder="Clinical question / purpose of referral"
                            disabled={!canCreate}
                        />
                    </div>

                    {/* Summary */}
                    <div className="md:col-span-12">
                        <label className={ui.label}>
                            Clinical summary <span className="text-slate-400">(required for transfer)</span>
                        </label>
                        <textarea
                            className={cx(ui.textarea, 'min-h-[90px]')}
                            value={f.clinical_summary}
                            onChange={(e) => setF((s) => ({ ...s, clinical_summary: e.target.value }))}
                            placeholder="History, diagnosis, vitals snapshot, key labs, procedures done, current plan…"
                            disabled={!canCreate}
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
                    <button type="button" className={ui.btnGhost} onClick={resetForm} disabled={!canCreate || saving}>
                        <XCircle className="h-4 w-4" />
                        Reset
                    </button>

                    <button className={ui.btn} disabled={!canCreate || saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Save Referral
                    </button>
                </div>

                {err && (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5" />
                            <div className="min-w-0">{err}</div>
                        </div>
                    </div>
                )}
            </form>

            {/* List */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm sm:text-base font-semibold text-slate-900">
                            Referral History <span className="text-slate-400 font-medium">({filtered.length})</span>
                        </div>
                        {loading ? (
                            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Mobile cards */}
                <div className="p-4 sm:p-5 space-y-3 md:hidden">
                    {filtered.map((r) => (
                        <Card key={r.id} r={r} />
                    ))}
                    {!filtered.length && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200">
                                <Stethoscope className="h-5 w-5 text-slate-500" />
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">No referrals</div>
                            <div className="mt-1 text-sm text-slate-600">Create the first referral from the form above.</div>
                        </div>
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 bg-slate-50">
                                <th className="px-5 py-3">When</th>
                                <th className="px-5 py-3">Type / Category</th>
                                <th className="px-5 py-3">Target</th>
                                <th className="px-5 py-3">Priority</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r0) => {
                                const r = normRef(r0)
                                return (
                                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
                                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                                            {fmtWhen(r.requested_at)}
                                        </td>

                                        <td className="px-5 py-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Chip tone={badgeTone('category', r.category)}>{pretty(r.category)}</Chip>
                                                <span className="text-slate-500 text-xs">
                                                    {pretty(r.ref_type)} · {pretty(r.care_mode)}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-slate-900 font-medium line-clamp-1">{r.reason || '—'}</div>
                                        </td>

                                        <td className="px-5 py-3 text-slate-900 font-medium">
                                            {targetLabel(r)}
                                            {r.ref_type === 'external' && r.external_contact_phone ? (
                                                <div className="text-xs text-slate-500">{r.external_contact_phone}</div>
                                            ) : null}
                                        </td>

                                        <td className="px-5 py-3">
                                            <Chip tone={badgeTone('priority', r.priority)}>{pretty(r.priority)}</Chip>
                                        </td>

                                        <td className="px-5 py-3">
                                            <Chip tone={badgeTone('status', r.status)}>{pretty(r.status)}</Chip>
                                        </td>

                                        <td className="px-5 py-3">
                                            <ActionBar r={r} />
                                        </td>
                                    </tr>
                                )
                            })}
                            {!filtered.length && (
                                <tr>
                                    <td className="px-5 py-8 text-slate-500 text-sm text-center" colSpan={6}>
                                        No referrals
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 text-[11px] sm:text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Tip: Use <span className="font-semibold">Category</span> + <span className="font-semibold">Priority</span> for NABH audit clarity.
                </div>
            </div>

            {/* Action / Details Modal */}
            <Modal
                open={modal.open}
                title={modalTitle}
                onClose={closeModal}
                closeDisabled={actionLoading}
                footer={
                    modal.mode === 'details' ? (
                        <div className="flex justify-end">
                            <button type="button" className={ui.btnGhost} onClick={closeModal}>
                                <XCircle className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
                            <button
                                type="button"
                                className={ui.btnGhost}
                                onClick={closeModal}
                                disabled={actionLoading}
                            >
                                <XCircle className="h-4 w-4" />
                                Cancel
                            </button>

                            <button
                                type="button"
                                className={ui.btn}
                                onClick={doAction}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                Confirm
                            </button>
                        </div>
                    )
                }
            >
                {detailLoading ? (
                    <div className="flex items-center gap-2 text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                ) : d ? (
                    <div className="space-y-4">
                        {/* Summary header */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Chip tone={badgeTone('category', d.category)}>{pretty(d.category)}</Chip>
                                <Chip tone={badgeTone('priority', d.priority)}>{pretty(d.priority)}</Chip>
                                <Chip tone={badgeTone('status', d.status)}>{pretty(d.status)}</Chip>
                                <span className="text-xs text-slate-500">
                                    {pretty(d.ref_type)} · {pretty(d.care_mode)}
                                </span>
                            </div>

                            <div className="mt-2 text-sm font-semibold text-slate-900">
                                Target: <span className="font-bold">{targetLabel(d)}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                                Requested: {fmtWhen(d.requested_at)}
                            </div>
                            {d.ref_type === 'external' && d.external_address ? (
                                <div className="mt-1 text-xs text-slate-600">Address: {d.external_address}</div>
                            ) : null}
                        </div>

                        {/* Reason + summary */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                                <div className="text-xs font-semibold text-slate-900 mb-1">Reason</div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap">{d.reason || '—'}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                                <div className="text-xs font-semibold text-slate-900 mb-1">Clinical summary</div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap">{d.clinical_summary || '—'}</div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                            <div className="text-xs font-semibold text-slate-900 mb-2">Timeline</div>
                            <div className="space-y-2">
                                {(d.events || []).length ? (
                                    (d.events || []).slice().reverse().map((ev) => (
                                        <div key={ev.id} className="flex items-start gap-3">
                                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-slate-900">
                                                    {pretty(ev.event_type)}{' '}
                                                    <span className="font-normal text-slate-500">
                                                        · {fmtWhen(ev.event_at)}
                                                    </span>
                                                </div>
                                                {ev.note ? (
                                                    <div className="text-xs text-slate-600 whitespace-pre-wrap">{ev.note}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-slate-600">No events</div>
                                )}
                            </div>
                        </div>

                        {/* Action forms (NO buttons here — footer has buttons) */}
                        {modal.mode !== 'details' ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                                {modal.mode === 'accept' ? (
                                    <>
                                        <div className="text-sm font-semibold text-slate-900">Add an optional note</div>
                                        <textarea
                                            className={cx(ui.textarea, 'min-h-[84px]')}
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Optional accept note…"
                                            disabled={actionLoading}
                                        />
                                    </>
                                ) : null}

                                {modal.mode === 'decline' ? (
                                    <>
                                        <div className="text-sm font-semibold text-slate-900">Decline reason (required)</div>
                                        <textarea
                                            className={cx(ui.textarea, 'min-h-[84px]')}
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Explain why declined…"
                                            disabled={actionLoading}
                                        />
                                    </>
                                ) : null}

                                {modal.mode === 'respond' ? (
                                    <>
                                        <div className="text-sm font-semibold text-slate-900">Response note (required)</div>
                                        <textarea
                                            className={cx(ui.textarea, 'min-h-[110px]')}
                                            value={responseNote}
                                            onChange={(e) => setResponseNote(e.target.value)}
                                            placeholder="Opinion / findings / plan…"
                                            disabled={actionLoading}
                                        />
                                    </>
                                ) : null}

                                {modal.mode === 'close' ? (
                                    <>
                                        <div className="text-sm font-semibold text-slate-900">Close note (optional)</div>
                                        <textarea
                                            className={cx(ui.textarea, 'min-h-[84px]')}
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Optional closure note…"
                                            disabled={actionLoading}
                                        />
                                    </>
                                ) : null}

                                {modal.mode === 'cancel' ? (
                                    <>
                                        <div className="text-sm font-semibold text-slate-900">Cancel reason (required)</div>
                                        <textarea
                                            className={cx(ui.textarea, 'min-h-[84px]')}
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            placeholder="Why cancelled…"
                                            disabled={actionLoading}
                                        />
                                    </>
                                ) : null}

                                {actionErr ? (
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 mt-0.5" />
                                            <div className="min-w-0">{actionErr}</div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="text-slate-600">No data</div>
                )}
            </Modal>

        </div>
    )
}
