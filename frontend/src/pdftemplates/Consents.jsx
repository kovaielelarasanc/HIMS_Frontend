// src/pdftemplates/Consents.jsx
import { useEffect, useState } from 'react'
import { listTemplates, renderTemplateHTML, createConsent, listConsents } from '../api/templates'
import { toast } from 'sonner'

export default function Consents() {
    const [patientId, setPatientId] = useState('')
    const [templates, setTemplates] = useState([])
    const [templateId, setTemplateId] = useState('')
    const [extra, setExtra] = useState({
        procedure_name: '',
        doctor_name: '',
        risks_text: '',
        witness_name: '',
    })
    const [previewHtml, setPreviewHtml] = useState('')
    const [rows, setRows] = useState([])

    const loadConsents = async (pid) => {
        if (!pid) { setRows([]); return }
        try {
            const res = await listConsents(Number(pid))
            setRows(res.data || [])
        } catch { }
    }

    useEffect(() => {
        ; (async () => {
            const res = await listTemplates({ category: 'consent', active: true })
            setTemplates(res.data || [])
        })()
    }, [])

    const preview = async () => {
        if (!patientId || !templateId) {
            toast.info('Select consent template and enter Patient ID')
            return
        }
        const data = { data: { ...extra } }
        const res = await renderTemplateHTML(Number(templateId), Number(patientId), data)
        setPreviewHtml(res.data.html || '')
    }

    const save = async () => {
        if (!patientId || !templateId) {
            toast.info('Select consent template and enter Patient ID')
            return
        }
        try {
            await createConsent(Number(patientId), {
                template_id: Number(templateId),
                data: { ...extra },
                finalize: true,
                signed_by: extra.doctor_name || undefined,
                witness_name: extra.witness_name || undefined,
            })
            toast.success('Consent saved')
            loadConsents(patientId)
        } catch { }
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-semibold">Patient Consents</h1>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-1 border rounded-lg p-3 bg-white">
                    <div className="text-sm font-semibold mb-2">Consent Template</div>
                    <select
                        value={templateId}
                        onChange={e => setTemplateId(e.target.value)}
                        className="border rounded px-3 py-2 w-full"
                    >
                        <option value="">-- choose consent template --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                        ))}
                    </select>

                    <div className="mt-3 text-sm font-semibold">Patient</div>
                    <input
                        value={patientId}
                        onChange={e => setPatientId(e.target.value)}
                        className="border rounded px-3 py-2 w-full"
                        placeholder="Patient ID"
                        onBlur={() => loadConsents(e.target.value)}
                    />

                    <div className="mt-3 text-sm font-semibold">Extra Fields</div>
                    <div className="space-y-2">
                        <input
                            value={extra.procedure_name}
                            onChange={e => setExtra({ ...extra, procedure_name: e.target.value })}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="Procedure name"
                        />
                        <input
                            value={extra.doctor_name}
                            onChange={e => setExtra({ ...extra, doctor_name: e.target.value })}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="Doctor name"
                        />
                        <textarea
                            value={extra.risks_text}
                            onChange={e => setExtra({ ...extra, risks_text: e.target.value })}
                            className="border rounded px-3 py-2 w-full min-h-[80px]"
                            placeholder="Risks explained..."
                        />
                        <input
                            value={extra.witness_name}
                            onChange={e => setExtra({ ...extra, witness_name: e.target.value })}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="Witness name"
                        />
                    </div>

                    <div className="mt-3 flex gap-2">
                        <button onClick={preview} className="px-3 py-2 border rounded">Preview</button>
                        <button onClick={save} className="px-3 py-2 rounded bg-blue-600 text-white">Save PDF</button>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                    <div className="border rounded-lg overflow-hidden bg-white">
                        <iframe title="consent-preview" className="w-full min-h-[400px]" srcDoc={previewHtml || ''} />
                    </div>

                    <div className="border rounded-lg bg-white">
                        <div className="px-3 py-2 border-b text-sm font-semibold">Existing Consents (Patient #{patientId || '-'})</div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left">#</th>
                                        <th className="px-3 py-2 text-left">Template</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-left">PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => (
                                        <tr key={r.id} className="border-t">
                                            <td className="px-3 py-2">{r.id}</td>
                                            <td className="px-3 py-2">{r.template_id}</td>
                                            <td className="px-3 py-2">{r.status}</td>
                                            <td className="px-3 py-2">
                                                {r.pdf_path ? (
                                                    <a href={r.pdf_path} target="_blank" rel="noreferrer" className="text-blue-700 underline">Open</a>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No consents</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
