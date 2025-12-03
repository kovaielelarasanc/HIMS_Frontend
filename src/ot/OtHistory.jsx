import { useEffect, useState } from 'react'
import { getOtHistory } from '../api/ot'
import { toast } from 'sonner'
import { Clock, FileDown } from 'lucide-react'

const fmtDT = (s) => {
    if (!s) return '—'
    try {
        return new Date(s).toLocaleString()
    } catch {
        return s
    }
}

export default function OtHistory({ patientId }) {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!patientId) return
        let alive = true
        const load = async () => {
            setLoading(true)
            try {
                const { data } = await getOtHistory(patientId)
                if (!alive) return
                setRows(Array.isArray(data) ? data : [])
            } catch (err) {
                toast.error(
                    err?.response?.data?.detail ||
                    'Failed to load OT history'
                )
            } finally {
                if (alive) setLoading(false)
            }
        }
        load()
        return () => {
            alive = false
        }
    }, [patientId])

    if (!patientId) {
        return (
            <div className="p-4 text-sm text-gray-500">
                Select a patient to view OT history.
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            <header className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">OT History</h2>
                    <p className="text-xs text-gray-500">
                        Completed & scheduled OT cases with attachments /
                        reports.
                    </p>
                </div>
            </header>

            {loading && (
                <div className="text-sm text-gray-500">Loading OT history…</div>
            )}

            {!loading && rows.length === 0 && (
                <div className="text-sm text-gray-500">
                    No OT cases found for this patient.
                </div>
            )}

            <div className="space-y-3">
                {rows.map((row) => (
                    <div
                        key={row.order_id}
                        className="rounded-xl border bg-white p-3 space-y-2"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold">
                                    Case #{row.order_id} ·{' '}
                                    <span className="text-gray-700">
                                        {row.surgery_name || '—'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Status:{' '}
                                    <span className="capitalize">
                                        {row.status}
                                    </span>
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtDT(row.scheduled_start)}
                            </div>
                        </div>

                        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
                            <Field
                                label="Scheduled Start"
                                value={fmtDT(row.scheduled_start)}
                            />
                            <Field
                                label="Scheduled End"
                                value={fmtDT(row.scheduled_end)}
                            />
                            <Field
                                label="Actual Start"
                                value={fmtDT(row.actual_start)}
                            />
                            <Field
                                label="Actual End"
                                value={fmtDT(row.actual_end)}
                            />
                        </div>

                        <div className="mt-2 border-t pt-2">
                            <div className="text-xs font-semibold mb-1">
                                Reports & Attachments
                            </div>
                            {(row.attachments || []).length === 0 && (
                                <div className="text-xs text-gray-400">
                                    No files uploaded for this case.
                                </div>
                            )}
                            <ul className="space-y-1">
                                {(row.attachments || []).map((att) => {
                                    const url = att.url || att.file_url
                                    return (
                                        <li
                                            key={att.id}
                                            className="flex items-center justify-between gap-2 text-xs"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="truncate">
                                                    {att.note ||
                                                        'Attachment / Report'}
                                                </div>
                                                <div className="text-[10px] text-gray-400">
                                                    {fmtDT(att.created_at)}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn-ghost text-[11px] px-2 py-1"
                                                >
                                                    Open
                                                </a>
                                                <a
                                                    href={url}
                                                    download
                                                    className="btn text-[11px] px-2 py-1 flex items-center gap-1"
                                                >
                                                    <FileDown className="h-3 w-3" />
                                                    Download
                                                </a>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function Field({ label, value }) {
    return (
        <div className="rounded-lg border bg-gray-50 px-2 py-1">
            <div className="text-[10px] text-gray-500">{label}</div>
            <div className="text-xs text-gray-800">{value || '—'}</div>
        </div>
    )
}
