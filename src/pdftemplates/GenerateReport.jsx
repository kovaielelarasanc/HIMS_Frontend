import { useEffect, useState } from 'react'
import { listTemplates, renderTemplateHTML, downloadTemplatePDF, downloadTemplatePDFPost } from '../api/templates'
import { toast } from 'sonner'
import { downloadBlob } from '../utils/download'
import PatientPicker from '../components/PatientPicker'

export default function GenerateReport() {
    const [tab, setTab] = useState('saved')
    const [patientId, setPatientId] = useState(null)
    const [templates, setTemplates] = useState([])
    const [templateId, setTemplateId] = useState('')
    const [previewHtml, setPreviewHtml] = useState('')
    const [zoom, setZoom] = useState(1.0)
    const [engine, setEngine] = useState('') // '', 'weasyprint', 'xhtml2pdf'

    useEffect(() => {
        (async () => {
            const res = await listTemplates({ category: 'report', active: true })
            setTemplates(res.data || [])
        })()
    }, [])

    const preview = async () => {
        if (!patientId || !templateId) return toast.info('Select template and patient')
        try {
            const res = await renderTemplateHTML(Number(templateId), Number(patientId))
            setPreviewHtml(res.data.html || '')
        } catch { }
    }

    const download = async () => {
        if (!patientId || !templateId) return toast.info('Select template and patient')
        try {
            // Use POST if engine selected, otherwise GET
            const blob = engine
                ? await downloadTemplatePDFPost(Number(templateId), { patient_id: Number(patientId), inline: false, engine })
                : await downloadTemplatePDF(Number(templateId), Number(patientId))
            downloadBlob(blob, `patient-${patientId}.pdf`)
        } catch { }
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-semibold">Generate Patient Reports</h1>

            <div className="flex gap-2">
                {['saved', 'predefined', 'customized'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={['px-3 py-1 rounded border text-sm', tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'].join(' ')}>
                        {t === 'saved' ? 'Saved Formats' : t === 'predefined' ? 'Predefined' : 'Customized'}
                    </button>
                ))}
            </div>

            {tab === 'saved' && (
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-1 border rounded-lg p-3 bg-white space-y-3">
                        <div>
                            <div className="text-sm font-semibold mb-2">1) Select Template</div>
                            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="border rounded px-3 py-2 w-full">
                                <option value="">-- choose report template --</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                            </select>
                        </div>

                        <div>
                            <div className="text-sm font-semibold mb-2">2) Choose Patient</div>
                            <PatientPicker value={patientId} onSelect={setPatientId} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm">Engine</label>
                                <select value={engine} onChange={(e) => setEngine(e.target.value)} className="border rounded px-2 py-1 text-sm">
                                    <option value="">Auto</option>
                                    <option value="weasyprint">WeasyPrint</option>
                                    <option value="xhtml2pdf">xhtml2pdf (fallback)</option>
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={preview} className="px-3 py-2 border rounded">Preview</button>
                                <button onClick={download} className="px-3 py-2 rounded bg-blue-600 text-white">Download PDF</button>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 border rounded-lg overflow-hidden bg-white">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <div className="text-sm text-gray-600">Preview</div>
                            <div className="flex items-center gap-2">
                                <button className="px-2 py-1 border rounded text-sm" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}>−</button>
                                <div className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</div>
                                <button className="px-2 py-1 border rounded text-sm" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))}>+</button>
                            </div>
                        </div>
                        <div className="w-full" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                            <iframe title="report-preview" className="w-full min-h-[900px]" srcDoc={previewHtml || ''} />
                        </div>
                    </div>
                </div>
            )}

            {tab === 'predefined' && (
                <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                        <TemplateGallery
                            onUseLayout={(layout) => window.location.assign('/templates/new')} // or use navigate with state
                            onInsertBlock={() => { }}
                        />
                    </div>
                    <div className="md:col-span-2 border rounded-lg p-4 bg-white text-sm text-gray-600">
                        Pick a layout from the left to open the editor pre-filled. Save it, then return to "Saved Formats".
                    </div>
                </div>
            )}

            {tab === 'customized' && (
                <div className="border rounded-lg p-4 bg-white">
                    <div className="text-sm mb-2">Create your own template with header/footer, drag-drop fields and blocks.</div>
                    <a href="/templates/new" className="px-3 py-2 rounded bg-blue-600 text-white inline-block">Open Template Builder</a>
                </div>
            )}
        </div>
    )
}
