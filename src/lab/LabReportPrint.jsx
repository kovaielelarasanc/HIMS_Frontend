// FILE: src/lab/LabReportPrint.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLisReportData } from '../api/lab'
import API from '../api/client'
import { toast } from 'sonner'
import {
    FileText,
    ArrowLeft,
    Download,
    Printer,
    BadgeCheck,
} from 'lucide-react'

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatLabNo = (raw) => {
    if (!raw) return '—'
    const s = String(raw).trim()
    if (s.toUpperCase().startsWith('LAB-')) return s
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    return `LAB-${String(n).padStart(6, '0')}`
}

// ✅ multiline normal range (supports newline + ";" style)
const normalizeNormalRange = (v) => {
    const t = (v ?? '').toString().replace(/\r\n/g, '\n').trim()
    if (!t || t === '-') return '—'
    if (t.includes('\n')) return t
    if (t.includes(';')) return t.split(';').map((x) => x.trim()).filter(Boolean).join('\n')
    return t
}

function FlagPill({ flag }) {
    const f = (flag || '').toString().trim().toUpperCase()
    if (!f) return null

    const cls =
        f.startsWith('H')
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : f.startsWith('L')
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'

    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
            {f}
        </span>
    )
}

export default function LabReportPrint() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const { data } = await getLisReportData(id)
                setReport(data)
            } catch (e) {
                console.error(e)
                toast.error(e?.response?.data?.detail || 'Failed to load report')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id])

    const flatRows = useMemo(() => {
        if (!report?.sections) return []
        const rows = []
        report.sections.forEach((sec) => {
            ; (sec.rows || []).forEach((r) => {
                rows.push({
                    department_name: sec.department_name || '',
                    sub_department_name: sec.sub_department_name || '',
                    ...r,
                })
            })
        })
        return rows
    }, [report])

    const downloadPdf = async () => {
        try {
            const res = await API.get(`/lab/orders/${id}/report-pdf`, { responseType: 'blob' })
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (e) {
            console.error('PDF download error', e)
            const status = e?.response?.status
            if (status === 401) toast.error('Session expired. Please login again.')
            else if (status === 403) toast.error('You do not have permission to view this report.')
            else toast.error(e?.response?.data?.detail || 'Failed to download PDF')
        }
    }

    const printNow = () => window.print()

    if (loading && !report) return <div className="p-6 text-sm text-slate-600">Loading report…</div>
    if (!report) return <div className="p-6 text-sm text-slate-600">Report not found</div>

    const labNoDisplay = formatLabNo(report.lab_no || report.order_id)

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
            {/* Toolbar (screen only) */}
            <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur print:hidden">
                <div className="mx-auto max-w-5xl px-3 md:px-6 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
                            onClick={() => navigate(-1)}
                            title="Back"
                        >
                            <ArrowLeft className="h-4 w-4 text-slate-700" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-600" />
                                <div className="text-sm font-semibold truncate">Lab Report</div>
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <BadgeCheck className="h-3 w-3" />
                                    Print View
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                                {report.patient_name || '—'} · {labNoDisplay}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={printNow}
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            onClick={downloadPdf}
                        >
                            <Download className="h-4 w-4" />
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Printable content */}
            <div className="mx-auto max-w-5xl px-3 md:px-6 py-4 print:p-0">
                <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm print:shadow-none print:border-0 overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-slate-100 px-4 md:px-6 py-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                                <div className="text-[11px] text-slate-500">LABORATORY REPORT</div>
                                <div className="text-xl font-semibold tracking-tight">{labNoDisplay}</div>
                                <div className="mt-1 text-[12px] text-slate-600">
                                    Patient: <span className="font-semibold text-slate-900">{report.patient_name || '—'}</span>
                                </div>
                            </div>

                            <div className="text-[11px] text-slate-600 space-y-1 md:text-right">
                                <div>
                                    <span className="font-semibold text-slate-700">UHID:</span> {report.patient_uhid || '—'}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Received:</span> {fmtDT(report.received_on)}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Reported:</span> {fmtDT(report.reported_on)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Patient + order details */}
                    <div className="px-4 md:px-6 py-4 border-b border-slate-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase">Patient</div>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                                    <div className="text-slate-500">Name</div>
                                    <div className="font-semibold">{report.patient_name || '—'}</div>
                                    <div className="text-slate-500">Gender</div>
                                    <div className="font-semibold">{report.patient_gender || '—'}</div>
                                    <div className="text-slate-500">Age</div>
                                    <div className="font-semibold">{report.patient_age_text || '—'}</div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase">Order</div>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                                    <div className="text-slate-500">Type</div>
                                    <div className="font-semibold">{report.patient_type || '—'}</div>
                                    <div className="text-slate-500">Referred By</div>
                                    <div className="font-semibold">{report.referred_by || '—'}</div>
                                    <div className="text-slate-500">Bill No</div>
                                    <div className="font-semibold">{report.bill_no || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="px-4 md:px-6 py-5 space-y-5">
                        {report.sections?.length ? (
                            report.sections.map((sec, idx) => (
                                <div key={`${sec.department_id}-${sec.sub_department_id}-${idx}`} className="space-y-2">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                                        <div className="text-xs font-semibold text-slate-800">
                                            {sec.department_name || 'Department'}
                                            {sec.sub_department_name ? ` / ${sec.sub_department_name}` : ''}
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[12px] border border-slate-200 rounded-2xl overflow-hidden">
                                            <thead className="bg-slate-50 text-slate-600">
                                                <tr>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Test</th>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Result</th>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Unit</th>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Normal Range</th>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Flag</th>
                                                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Comments</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(sec.rows || []).map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-slate-50/60">
                                                        <td className="border-t border-slate-200 px-3 py-2 font-medium">
                                                            {row.service_name || '—'}
                                                        </td>
                                                        <td className="border-t border-slate-200 px-3 py-2">
                                                            {row.result_value || '—'}
                                                        </td>
                                                        <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                                                            {row.unit || '—'}
                                                        </td>
                                                        <td className="border-t border-slate-200 px-3 py-2">
                                                            {/* ✅ IMPORTANT: preserve multi-line format */}
                                                            <div className="whitespace-pre-line leading-4 text-slate-700">
                                                                {normalizeNormalRange(row.normal_range)}
                                                            </div>
                                                        </td>
                                                        <td className="border-t border-slate-200 px-3 py-2">
                                                            <FlagPill flag={row.flag} />
                                                        </td>
                                                        <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                                                            {row.comments || ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!sec.rows || sec.rows.length === 0) && (
                                                    <tr>
                                                        <td colSpan={6} className="border-t border-slate-200 px-3 py-6 text-center text-slate-400">
                                                            No services configured for this panel.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-500">No results available for this order.</div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="px-4 md:px-6 pb-6">
                        <div className="text-sm font-semibold text-slate-900 mb-2">Latest Results Summary</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border border-slate-200 rounded-2xl overflow-hidden">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Department</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Sub-Department</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Test</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Result</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Unit</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Normal Range</th>
                                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Flag</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flatRows.length ? (
                                        flatRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/60">
                                                <td className="border-t border-slate-200 px-3 py-2">{row.department_name || '—'}</td>
                                                <td className="border-t border-slate-200 px-3 py-2">{row.sub_department_name || '—'}</td>
                                                <td className="border-t border-slate-200 px-3 py-2 font-medium">{row.service_name || '—'}</td>
                                                <td className="border-t border-slate-200 px-3 py-2">{row.result_value || '—'}</td>
                                                <td className="border-t border-slate-200 px-3 py-2">{row.unit || '—'}</td>
                                                <td className="border-t border-slate-200 px-3 py-2">
                                                    <div className="whitespace-pre-line leading-4 text-slate-700">
                                                        {normalizeNormalRange(row.normal_range)}
                                                    </div>
                                                </td>
                                                <td className="border-t border-slate-200 px-3 py-2">
                                                    <FlagPill flag={row.flag} />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="border-t border-slate-200 px-3 py-6 text-center text-slate-400">
                                                No results to summarise.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures */}
                        <div className="mt-8 grid grid-cols-2 gap-8 text-[12px] text-slate-700">
                            <div className="text-center">
                                <div className="border-t border-slate-300 pt-3">Technician / Lab In-charge</div>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-slate-300 pt-3">Pathologist / Authorized Signatory</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print helpers */}
                <style>{`
          @media print {
            .page-break { page-break-after: always; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
          }
        `}</style>
            </div>
        </div>
    )
}
