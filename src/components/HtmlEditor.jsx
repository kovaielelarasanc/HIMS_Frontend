// src/components/HtmlEditor.jsx

import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '../api/templates'
import { toast } from 'sonner'

const FONTS = [
    "system-ui, -NUTRYAH-system, 'Segoe UI', Roboto, Arial, sans-serif",
    "Arial, Helvetica, sans-serif",
    "'Times New Roman', Times, serif",
    "'Georgia', serif",
    "'Courier New', Courier, monospace",
    "'Inter', system-ui, -NUTRYAH-system, sans-serif"
]

const COLORS = [
    "#000000", "#444444", "#666666", "#999999", "#CCCCCC", "#EEEEEE",
    "#B80000", "#DB3E00", "#FCCB00", "#008B02", "#006B76", "#1273DE", "#004DCF", "#5300EB"
]

export default function HtmlEditor({ value, onChange }) {
    const ref = useRef(null)
    const fileRef = useRef(null)
    const [font, setFont] = useState(FONTS[0])

    useEffect(() => {
        if (!ref.current) return
        if (ref.current.innerHTML !== (value || '')) {
            ref.current.innerHTML = value || ''
        }
    }, [value])

    const html = () => ref.current?.innerHTML || ''
    const commit = () => onChange && onChange(html())

    const applyInline = (styleObj) => {
        document.execCommand('styleWithCSS', false, true)
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const span = document.createElement('span')
        Object.entries(styleObj).forEach(([k, v]) => (span.style[k] = v))
        range.surroundContents(span)
        commit()
    }

    const exec = (cmd, arg = null) => {
        document.execCommand('styleWithCSS', false, true)
        document.execCommand(cmd, false, arg)
        commit()
    }

    const wrapSelection = (wrapperTag, className = '', styleObj = null) => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const wrapper = document.createElement(wrapperTag)
        if (className) wrapper.className = className
        if (styleObj) Object.entries(styleObj).forEach(([k, v]) => (wrapper.style[k] = v))
        range.surroundContents(wrapper)
        commit()
    }

    // ---------- Images ----------
    const pickImage = () => fileRef.current?.click()
    const onPick = async (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        try {
            const res = await uploadFile(f)
            // insertHtml(`<img src="${res.file_url}" alt="${res.original_name || ''}" style="max-width:100%;">`)
            // Prefer absolute URL from backend; fallback to building from VITE_API_URL
            const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
            const url = res.file_url_abs
                ? res.file_url_abs
                : (res.file_url?.startsWith('http') ? res.file_url : `${BASE}${res.file_url}`)
            insertHtml(`<img src="${url}" alt="${res.original_name || ''}" style="max-width:100%;">`)
        } catch (err) {
            toast.error('Upload failed')
        } finally { e.target.value = '' }
    }
    const insertHtml = (snippet) => {
        ref.current?.focus()
        document.execCommand('insertHTML', false, snippet)
        commit()
    }

    const selectedImage = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        const range = sel.getRangeAt(0)
        const node = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentNode
        if (!node) return null
        const imgs = node.querySelectorAll ? node.querySelectorAll('img') : []
        // Prefer img under caret
        const anchor = sel.anchorNode?.parentNode
        if (anchor && anchor.tagName === 'IMG') return anchor
        if (anchor?.closest) {
            const c = anchor.closest('img')
            if (c) return c
        }
        return imgs.length ? imgs[0] : null
    }

    const setImgWidth = (pct) => {
        const img = selectedImage()
        if (!img) return toast.info('Select an image first')
        img.style.width = pct
        if (pct === '100%') img.style.maxWidth = '100%'
        commit()
    }

    const alignImage = (pos) => {
        const img = selectedImage()
        if (!img) return toast.info('Select an image first')
        img.classList.remove('float-left', 'float-right', 'img-center')
        img.style.removeProperty('float')
        img.style.removeProperty('display')
        img.style.removeProperty('margin-left')
        img.style.removeProperty('margin-right')
        if (pos === 'left') img.classList.add('float-left')
        if (pos === 'right') img.classList.add('float-right')
        if (pos === 'center') img.classList.add('img-center')
        commit()
    }

    // ---------- Tables ----------
    const findClosest = (tagNames) => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        let el = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentNode
        while (el) {
            if (el.tagName && tagNames.includes(el.tagName)) return el
            el = el.parentNode
        }
        return null
    }

    const applyTableBorders = (mode) => {
        const table = findClosest(['TABLE']) || findClosest(['TD', 'TH'])?.closest('TABLE')
        if (!table) return toast.info('Place caret inside a table')
        // clear previous presets
        table.classList.remove('tbl-border-all', 'tbl-border-h', 'tbl-border-v', 'tbl-border-none')
        table.removeAttribute('border')
        table.style.borderCollapse = 'collapse'
        table.querySelectorAll('th,td').forEach(c => {
            c.style.border = ''
            c.style.borderTop = ''
            c.style.borderBottom = ''
            c.style.borderLeft = ''
            c.style.borderRight = ''
        })

        if (mode === 'all') table.classList.add('tbl-border-all')
        if (mode === 'h') table.classList.add('tbl-border-h')
        if (mode === 'v') table.classList.add('tbl-border-v')
        if (mode === 'none') table.classList.add('tbl-border-none')
        commit()
    }

    const shadeRow = () => {
        const td = findClosest(['TD', 'TH'])
        if (!td) return toast.info('Place caret inside a row')
        const tr = td.closest('tr')
        tr.classList.toggle('tr-shade')
        commit()
    }

    // ---------- Columns / layout ----------
    const wrapColumns = (count) => {
        wrapSelection('div', count === 2 ? 'cols-2' : 'cols-3')
    }

    // ---------- Paste ----------
    const onPaste = (e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
        commit()
    }
    const onDrop = (e) => {
        e.preventDefault()
        const token = e.dataTransfer.getData('text/x-token') || e.dataTransfer.getData('text/plain')
        if (token) {
            insertHtml(token)
            return
        }
        // fallback: plain text drop
        const text = e.dataTransfer.getData('text')
        if (text) document.execCommand('insertText', false, text)
        commit()
    }
    // ---------- Toolbar ----------
    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-gray-50">
                {/* Font family */}
                <select
                    className="text-sm border rounded px-2 py-1"
                    value={font}
                    onChange={(e) => { setFont(e.target.value); applyInline({ fontFamily: e.target.value }) }}
                    title="Font family"
                >
                    {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/['"]/g, '')}</option>)}
                </select>

                {/* Font size */}
                <select className="text-sm border rounded px-2 py-1" onChange={e => applyInline({ fontSize: e.target.value })}>
                    {['10px', '12px', '14px', '16px', '18px', '20px', '24px'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* Bold/Italic/Underline */}
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('bold')}><b>B</b></button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('italic')}><i>I</i></button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('underline')}><u>U</u></button>

                {/* Alignment */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('justifyLeft')}>Left</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('justifyCenter')}>Center</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('justifyRight')}>Right</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => wrapSelection('span', 'text-justify')}>Justify</button>

                {/* Colors */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">Text</span>
                    {COLORS.map(c => (
                        <button key={'fg' + c} className="w-4 h-4 rounded border"
                            style={{ background: c }} onClick={() => exec('foreColor', c)} />
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 ml-2 mr-1">Highlight</span>
                    {COLORS.map(c => (
                        <button key={'bg' + c} className="w-4 h-4 rounded border"
                            style={{ background: c }} onClick={() => exec('hiliteColor', c)} />
                    ))}
                </div>

                {/* Lists */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('insertUnorderedList')}>• List</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => exec('insertOrderedList')}>1. List</button>

                {/* Image */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={pickImage}>Image</button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
                <select className="text-sm border rounded px-2 py-1" onChange={e => setImgWidth(e.target.value)} defaultValue="">
                    <option value="" disabled>Img Width</option>
                    <option value="25%">25%</option><option value="33%">33%</option>
                    <option value="50%">50%</option><option value="75%">75%</option>
                    <option value="100%">100%</option>
                </select>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => alignImage('left')}>Img Left</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => alignImage('center')}>Img Center</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => alignImage('right')}>Img Right</button>

                {/* Columns */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => wrapColumns(2)}>2 Columns</button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => wrapColumns(3)}>3 Columns</button>

                {/* Tables */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={() => insertHtml('<table><tr><th>Header</th><th>Header</th></tr><tr><td>Cell</td><td>Cell</td></tr></table>')}>Insert Table</button>
                <select className="text-sm border rounded px-2 py-1" onChange={e => applyTableBorders(e.target.value)} defaultValue="">
                    <option value="" disabled>Borders</option>
                    <option value="all">All borders</option>
                    <option value="h">Horizontal only</option>
                    <option value="v">Vertical only</option>
                    <option value="none">No borders</option>
                </select>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={shadeRow}>Shade Row</button>
            </div>

            {/* Editable */}
            <div
                ref={ref}
                className="min-h-[320px] p-3 prose max-w-none focus:outline-none"
                contentEditable
                onInput={commit}
                onPaste={onPaste}
                suppressContentEditableWarning
                spellCheck={false}
            />
            <div
                ref={ref}
                className="min-h-[320px] p-3 prose max-w-none focus:outline-none"
                contentEditable
                onInput={commit}
                onPaste={onPaste}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                suppressContentEditableWarning
                spellCheck={false}
            />
            <div className="px-3 py-1 text-[10px] text-gray-500 border-t bg-gray-50">
                Tip: select an image to resize/align; use columns for magazine-style layouts.
            </div>
        </div>
    )
}
