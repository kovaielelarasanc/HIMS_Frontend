// src/pdftemplates/TemplateEditor.jsx
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import HtmlEditor from '../components/HtmlEditor'
import ProEditor  from '../components/ProEditor'
import DragDropCatalog from '../components/DragDropCatalog'
import TemplateGallery, { RUNNING_CSS } from '../components/TemplateGallery'
import { createTemplate, getTemplate, updateTemplate } from '../api/templates'
import { toast } from 'sonner'
import PageSetupModal from '../components/PageSetupModal'

const DEFAULT_CSS = RUNNING_CSS

export default function TemplateEditor({ mode = 'create' }) {
    const { id } = useParams()
    const nav = useNavigate()
    const loc = useLocation()
    const preset = loc.state?.preset || null // optional incoming preset

    const [form, setForm] = useState({
        name: '',
        code: '',
        category: 'report', // report|consent
        subcategory: '',
        description: '',
        css: DEFAULT_CSS,
        is_active: true,
    })

    // Separate editors for header/body/footer
    const [htmlHeader, setHtmlHeader] = useState('')
    const [htmlBody, setHtmlBody] = useState('<h1>New Template</h1><p>Use the Field Catalog or Gallery.</p>')
    const [htmlFooter, setHtmlFooter] = useState('')

    const [tab, setTab] = useState('body') // 'header' | 'body' | 'footer'
    const isEdit = mode === 'edit'

    // Load template for edit
    useEffect(() => {
        if (!isEdit || !id) return
            ; (async () => {
                const res = await getTemplate(id)
                const t = res.data
                setForm({
                    name: t.name,
                    code: t.code,
                    category: t.category,
                    subcategory: t.subcategory || '',
                    description: t.description || '',
                    css: t.css || DEFAULT_CSS,
                    is_active: !!t.is_active,
                })
                // naive extract header/footer markers if present
                const html = t.html || ''
                const headerMatch = html.match(/<header[^>]*class="[^"]*tpl-header[^"]*"[^>]*>[\s\S]*?<\/header>/i)
                const footerMatch = html.match(/<footer[^>]*class="[^"]*tpl-footer[^"]*"[^>]*>[\s\S]*?<\/footer>/i)
                setHtmlHeader(headerMatch ? headerMatch[0] : '')
                setHtmlFooter(footerMatch ? footerMatch[0] : '')
                // remove header/footer from body if found
                let bodyHtml = html
                if (headerMatch) bodyHtml = bodyHtml.replace(headerMatch[0], '')
                if (footerMatch) bodyHtml = bodyHtml.replace(footerMatch[0], '')
                setHtmlBody(bodyHtml.trim() || '')
            })()
    }, [isEdit, id])

    // If a preset arrived from gallery/generator (create flow)
    useEffect(() => {
        if (!preset || isEdit) return
        setForm(f => ({
            ...f,
            category: preset.category || 'report',
            name: f.name || preset.title || 'Untitled',
            code: f.code || (preset.key ? `${preset.key}-${Date.now()}` : ''),
            css: preset.css || DEFAULT_CSS,
        }))
        setHtmlHeader(preset.header || '')
        setHtmlFooter(preset.footer || '')
        setHtmlBody(preset.html || '')
    }, [preset, isEdit])

    const composedHTML = useMemo(() => {
        // Compose header + body + footer as one HTML (backend stores single html)
        return [htmlHeader, htmlBody, htmlFooter].filter(Boolean).join('\n')
    }, [htmlHeader, htmlBody, htmlFooter])

    const save = async () => {
        if (!form.name.trim() || !form.code.trim()) {
            toast.error('Name and unique code are required')
            return
        }
        const payload = {
            ...form,
            html: composedHTML,
            placeholders: { // lightweight meta for FE; backend keeps as JSON
                header: !!htmlHeader,
                footer: !!htmlFooter,
            },
        }
        try {
            if (isEdit) {
                await updateTemplate(id, payload)
                toast.success('Template updated')
            } else {
                await createTemplate(payload)
                toast.success('Template created')
            }
            nav('/templates')
        } catch { }
    }

    const useLayout = (layout) => {
        setForm(f => ({
            ...f,
            category: layout.category || f.category,
            css: layout.css || f.css,
            name: f.name || layout.title,
            code: f.code || (layout.key ? `${layout.key}-${Date.now()}` : ''),
        }))
        setHtmlHeader(layout.header || '')
        setHtmlFooter(layout.footer || '')
        setHtmlBody(layout.html || '')
        toast.success('Layout applied')
    }

    const insertBlock = (html) => {
        if (tab === 'header') setHtmlHeader(h => `${h}\n${html}`)
        else if (tab === 'footer') setHtmlFooter(h => `${h}\n${html}`)
        else setHtmlBody(b => `${b}\n${html}`)
    }

    const insertToken = (token) => {
        // Append into current tab
        insertBlock(token)
    }
    const [showPageSetup, setShowPageSetup] = useState(false)
    const applyPageCss = (pageCss) => {
        // Replace existing @page block, or prepend if none.
        setForm(f => {
            const has = /@page\s*{[\s\S]*?}/.test(f.css || '')
            return { ...f, css: has ? (f.css.replace(/@page\s*{[\s\S]*?}/, pageCss)) : (pageCss + '\n' + (f.css || '')) }
        })
        setShowPageSetup(false)
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex gap-2">
                <button onClick={() => setShowPageSetup(true)} className="px-3 py-2 rounded border">Page Setup</button>
                <button onClick={save} className="px-3 py-2 rounded bg-blue-600 text-white">Save</button>
                {showPageSetup && <PageSetupModal css={form.css} onApply={applyPageCss} onClose={() => setShowPageSetup(false)} />}
            </div>

            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{isEdit ? 'Edit Template' : 'Create Template'}</h1>
                <div className="flex gap-2">
                    <button onClick={save} className="px-3 py-2 rounded bg-blue-600 text-white">Save</button>
                </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="border rounded px-3 py-2"
                    placeholder="Template Name"
                />
                <input
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="border rounded px-3 py-2"
                    placeholder="Unique Code (e.g., clinical_summary_v2)"
                    disabled={isEdit}
                />
                <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="border rounded px-3 py-2"
                >
                    <option value="report">Report</option>
                    <option value="consent">Consent</option>
                </select>
                <input
                    value={form.subcategory}
                    onChange={e => setForm({ ...form, subcategory: e.target.value })}
                    className="border rounded px-3 py-2"
                    placeholder="Subcategory (optional)"
                />
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Active
                </label>
            </div>

            <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                className="border rounded px-3 py-2 w-full min-h-[80px]"
            />

            <div className="grid grid-cols-12 gap-4">
                {/* Left: editors */}
                <div className="col-span-12 lg:col-span-8 space-y-3">
                    {/* Tabs */}
                    <div className="flex gap-2">
                        {['header', 'body', 'footer'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={[
                                    'px-3 py-1 rounded border text-sm',
                                    tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
                                ].join(' ')}
                            >
                                {t.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {tab === 'header' && (
                        <div>
                            <div className="text-sm font-medium mb-1">Header (running top)</div>
                            <HtmlEditor  value={htmlHeader} onChange={setHtmlHeader} />
                        </div>
                    )}
                    {tab === 'body' && (
                        <div>
                            <div className="text-sm font-medium mb-1">Body</div>
                            <HtmlEditor  value={htmlBody} onChange={setHtmlBody} />
                        </div>
                    )}
                    {tab === 'footer' && (
                        <div>
                            <div className="text-sm font-medium mb-1">Footer (running bottom)</div>
                            <HtmlEditor  value={htmlFooter} onChange={setHtmlFooter} />
                        </div>
                    )}

                    <div>
                        <div className="text-sm font-medium mb-1">CSS (print styles)</div>
                        <textarea
                            value={form.css}
                            onChange={e => setForm({ ...form, css: e.target.value })}
                            className="border rounded px-3 py-2 w-full min-h-[160px] font-mono text-xs"
                        />
                    </div>
                </div>

                {/* Right: Catalog + Gallery */}
                <div className="col-span-12 lg:col-span-4 space-y-3">
                    <DragDropCatalog onInsert={insertToken} />
                    <TemplateGallery onUseLayout={useLayout} onInsertBlock={insertBlock} />
                    <div className="text-[11px] text-gray-500">
                        <b>Note:</b> Save the template to use server-side merged preview & PDF.
                    </div>
                </div>
            </div>
        </div>
    )
}
