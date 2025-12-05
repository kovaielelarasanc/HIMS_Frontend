// FILE: src/lab/LabReportPrint.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLisReportData } from '../api/lab'
import API from '../api/client'
import { toast } from 'sonner'
import { FileText, ArrowLeft } from 'lucide-react'

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatOrderNo = (id) => {
    if (!id) return '—'
    const s = String(id)
    return `LAB-${s.padStart(6, '0')}`
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
            sec.rows.forEach((r) => {
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
            const res = await API.get(`/lab/orders/${id}/report-pdf`, {
                responseType: 'blob',
            })
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (e) {
            console.error('PDF download error', e)
            const status = e?.response?.status
            if (status === 401) {
                toast.error('Session expired. Please login again.')
            } else if (status === 403) {
                toast.error('You do not have permission to view this report.')
            } else {
                toast.error(e?.response?.data?.detail || 'Failed to download PDF')
            }
        }
    }

    if (loading && !report) return <div className="p-6">Loading report…</div>
    if (!report) return <div className="p-6">Report not found</div>

    const labNoDisplay = report.lab_no
        ? formatOrderNo(report.lab_no)
        : formatOrderNo(report.order_id)

    return (
        <div className="min-h-screen text-black print:bg-white bg-slate-50">
            {/* Toolbar */}
            <div className="border-b bg-white px-3 md:px-4 py-2 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                    <button
                        className="btn-ghost flex items-center gap-1 text-xs md:text-sm"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 text-xs md:text-sm font-medium">
                        <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-slate-600" />
                            <span>Lab Report</span>
                        </span>
                        <span className="text-[11px] text-gray-500">
                            {report.patient_name} &middot; {labNoDisplay}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="btn flex items-center gap-2 text-xs md:text-sm"
                        onClick={downloadPdf}
                    >
                        <FileText className="h-4 w-4" />
                        Download
                    </button>
                </div>
            </div>

            {/* Printable content */}
            <div className="max-w-4xl mx-auto bg-white shadow-sm print:shadow-none my-3 md:my-4 print:my-0 px-3 md:px-6 py-4 md:py-6 print:p-4">
                {/* Header */}
                <header className="border-b pb-3 md:pb-4 mb-3 md:mb-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <h1 className="text-lg md:text-xl font-semibold tracking-wide">
                                LABORATORY REPORT
                            </h1>
                        </div>
                        <div className="text-right text-[11px] md:text-xs">
                            <div>
                                <span className="font-semibold">Lab No:</span>{' '}
                                {labNoDisplay}
                            </div>
                            <div>
                                <span className="font-semibold">Patient:</span>{' '}
                                {report.patient_name || '—'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Patient + order details */}
                <section className="mb-3 md:mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] md:text-xs">
                        <div className="space-y-1">
                            <div>
                                <span className="font-semibold">Patient Name: </span>
                                <span>{report.patient_name || '—'}</span>
                            </div>
                            <div>
                                <span className="font-semibold">UHID: </span>
                                {/* use UHID, not raw patient_id */}
                                <span>{report.patient_uhid || '—'}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Gender: </span>
                                <span>{report.patient_gender || '—'}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Age: </span>
                                <span>{report.patient_age_text || '—'}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div>
                                <span className="font-semibold">Patient Type: </span>
                                <span>{report.patient_type || '—'}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Received On: </span>
                                <span>{fmtDT(report.received_on)}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Reported On: </span>
                                <span>{fmtDT(report.reported_on)}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Referred By: </span>
                                <span>{report.referred_by || '—'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Sections */}
                <section className="space-y-4">
                    {report.sections && report.sections.length > 0 ? (
                        report.sections.map((sec, idx) => (
                            <div key={`${sec.department_id}-${sec.sub_department_id}-${idx}`}>
                                <div className="bg-slate-100 border px-3 py-2 mb-1">
                                    <div className="text-[11px] font-semibold text-slate-700">
                                        {sec.department_name || 'Department'}
                                        {sec.sub_department_name
                                            ? ` / ${sec.sub_department_name}`
                                            : ''}
                                    </div>
                                </div>

                                {/* Table – keep for print + desktop */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] border">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="border px-2 py-1 text-left">Test</th>
                                                <th className="border px-2 py-1 text-left">Result</th>
                                                <th className="border px-2 py-1 text-left">Unit</th>
                                                <th className="border px-2 py-1 text-left">
                                                    Normal Range
                                                </th>
                                                <th className="border px-2 py-1 text-left">Flag</th>
                                                <th className="border px-2 py-1 text-left">Comments</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sec.rows.map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    <td className="border px-2 py-1">
                                                        {row.service_name || '—'}
                                                    </td>
                                                    <td className="border px-2 py-1">
                                                        {row.result_value || '—'}
                                                        {row.flag ? ` (${row.flag})` : ''}
                                                    </td>
                                                    <td className="border px-2 py-1">
                                                        {row.unit || '—'}
                                                    </td>
                                                    <td className="border px-2 py-1">
                                                        {row.normal_range || '—'}
                                                    </td>
                                                    <td className="border px-2 py-1">
                                                        {row.flag || ''}
                                                    </td>
                                                    <td className="border px-2 py-1">
                                                        {row.comments || ''}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-gray-500">
                            No results available for this order.
                        </div>
                    )}
                </section>

                {/* Summary */}
                <section className="mt-5 md:mt-6">
                    <h3 className="text-xs md:text-sm font-semibold mb-1">
                        Latest Results Summary
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] border">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="border px-2 py-1 text-left">Department</th>
                                    <th className="border px-2 py-1 text-left">Sub-Department</th>
                                    <th className="border px-2 py-1 text-left">Test</th>
                                    <th className="border px-2 py-1 text-left">Result</th>
                                    <th className="border px-2 py-1 text-left">Unit</th>
                                    <th className="border px-2 py-1 text-left">
                                        Normal Range
                                    </th>
                                    <th className="border px-2 py-1 text-left">Flag</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flatRows.length > 0 ? (
                                    flatRows.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="border px-2 py-1">
                                                {row.department_name || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.sub_department_name || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.service_name || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.result_value || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.unit || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.normal_range || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                {row.flag || ''}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="border px-2 py-2 text-center text-gray-400"
                                        >
                                            No results to summarise.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Signatures */}
                <section className="mt-6 md:mt-8 grid grid-cols-2 gap-6 text-[11px]">
                    <div>
                        <div className="border-t pt-4 text-center">
                            Technician / Lab In-charge
                        </div>
                    </div>
                    <div>
                        <div className="border-t pt-4 text-center">
                            Pathologist / Authorized Signatory
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
