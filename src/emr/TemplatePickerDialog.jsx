import { useEffect, useState } from 'react'
import { listTemplates } from '../api/templates'

export default function TemplatePickerDialog({ open, onClose, onSelect }) {
    const [tab, setTab] = useState('saved')
    const [saved, setSaved] = useState([])
    const [pre, setPre] = useState([])


    useEffect(() => {
        if (open) {
            listTemplates('emr_pdf').then(({ data }) => {
                setSaved(data.filter(t => !t.is_system)); setPre(data.filter(t => t.is_system))
            })
        }
    }, [open])
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <div className="w-[680px] rounded-2xl bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Select Template</h2>
                    <button className="text-sm text-gray-600 hover:underline" onClick={onClose}>Close</button>
                </div>
                <div className="mb-3 flex gap-2">
                    {['custom', 'saved', 'pre'].map(k => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`rounded-xl border px-3 py-1 text-sm ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>
                            {k === 'custom' ? 'Customized' : k === 'saved' ? 'Saved' : 'Predefined'}
                        </button>
                    ))}
                    <a href="/templates/builder?kind=emr_pdf" className="ml-auto text-sm text-blue-700 hover:underline">+ Create Template</a>
                </div>
                {tab === 'custom' && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">Start from a blank customizable layout.</p>
                        <button onClick={() => onSelect({ mode: 'custom' })} className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white">Use Blank Custom</button>
                    </div>
                )}
                {tab === 'saved' && (
                    <div className="grid gap-2 max-h-[360px] overflow-auto">
                        {saved.map(t => (
                            <button key={t.id} onClick={() => onSelect({ mode: 'saved', template_id: t.id })}
                                className="rounded-xl border p-3 text-left hover:bg-gray-50">
                                <div className="font-medium">{t.name}</div>
                                <div className="text-xs text-gray-600">{t.description}</div>
                            </button>
                        ))}
                        {saved.length === 0 && <div className="text-sm text-gray-500">No saved templates.</div>}
                    </div>
                )}
                {tab === 'pre' && (
                    <div className="grid gap-2 max-h-[360px] overflow-auto">
                        {pre.map(t => (
                            <button key={t.id} onClick={() => onSelect({ mode: 'pre', template_id: t.id })}
                                className="rounded-xl border p-3 text-left hover:bg-gray-50">
                                <div className="font-medium">{t.name}</div>
                                <div className="text-xs text-gray-600">{t.description}</div>
                            </button>
                        ))}
                        {pre.length === 0 && <div className="text-sm text-gray-500">No predefined templates.</div>}
                    </div>
                )}
            </div>
        </div>
    )
}