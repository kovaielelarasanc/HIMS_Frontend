// src/components/ProEditor.jsx

import React, { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell as TCell } from '@tiptap/extension-table-cell'
import { uploadFile } from '../api/templates'
import { toast } from 'sonner'

/** Extend Table for border presets -> class=tbl-border-... (WeasyPrint friendly) */
const TableX = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            borderPreset: {
                default: null,
                parseHTML: el => {
                    const cls = el.getAttribute('class') || ''
                    if (/\btbl-border-all\b/.test(cls)) return 'all'
                    if (/\btbl-border-h\b/.test(cls)) return 'h'
                    if (/\btbl-border-v\b/.test(cls)) return 'v'
                    if (/\btbl-border-none\b/.test(cls)) return 'none'
                    return null
                },
                renderHTML: attrs => ({
                    class: attrs.borderPreset ? `tbl-border-${attrs.borderPreset}` : null,
                    style: 'border-collapse:collapse;'
                })
            }
        }
    }
}).configure({ resizable: true })   // ← drag-resize columns

/** Add backgroundColor attribute to cells for row/cell shading */
const TableCell = TCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: el => el.style.backgroundColor || el.getAttribute('data-bg') || null,
                renderHTML: attrs => {
                    const s = {}
                    if (attrs.backgroundColor) s.style = `background-color:${attrs.backgroundColor}`
                    return { ...s, 'data-bg': attrs.backgroundColor || null }
                }
            }
        }
    }
})

const FONTS = [
    "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    "Arial, Helvetica, sans-serif",
    "'Times New Roman', Times, serif",
    "'Georgia', serif",
    "'Courier New', Courier, monospace",
    "'Inter', system-ui, -apple-system, sans-serif",
]

const COLORS = [
    '#000000', '#444444', '#666666', '#999999', '#CCCCCC', '#EEEEEE',
    '#B80000', '#DB3E00', '#FCCB00', '#008B02', '#006B76', '#1273DE', '#004DCF', '#5300EB'
]

export default function ProEditor({ value, onChange }) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            TextStyle,
            Color,
            Underline,
            Highlight,
            FontFamily,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        width: { default: null, renderHTML: a => a.width ? { style: `width:${a.width}` } : {} },
                        float: { default: null, renderHTML: a => a.float ? { class: `float-${a.float}` } : {} },
                        center: { default: false, renderHTML: a => a.center ? { class: 'img-center' } : {} },
                    }
                }
            }),
            TableX,
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || '',
        onUpdate: ({ editor }) => onChange && onChange(editor.getHTML()),
    })

    useEffect(() => {
        if (!editor) return
        const html = editor.getHTML()
        if ((value || '') !== html) editor.commands.setContent(value || '', false)
    }, [value]) // eslint-disable-line

    if (!editor) return null

    // Helpers
    const act = (fn) => () => { fn(); editor.chain().focus().run() }
    const setBorder = p => () => editor.chain().focus().updateAttributes('table', { borderPreset: p }).run()
    const setCellBg = c => () => editor.chain().focus().setCellAttribute('backgroundColor', c).run()
    const shadeRow = (c = '#f5f5f5') => () => {
        // apply to every selected cell in row
        editor.chain().focus().command(({ state, tr }) => {
            const { selection } = state
            const $pos = selection.$anchor
            const row = $pos.node(-1) && $pos.node(-1).type.name === 'tableRow'
                ? $pos.node(-1) : $pos.node(-2)
            if (!row || row.type.name !== 'tableRow') return false
            row.forEach((cell, offset) => {
                const pos = $pos.before($pos.depth - 1) + offset + 1
                tr.setNodeMarkup(pos, undefined, { ...cell.attrs, backgroundColor: c })
            })
            tr.setMeta('addToHistory', true)
            return true
        }).run()
    }

    const insertImage = async (file) => {
        if (!file) return
        try {
            const res = await uploadFile(file)
            // editor.chain().focus().setImage({ src: res.file_url }).run()
            const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
            const url = res.file_url_abs
                ? res.file_url_abs
                : (res.file_url?.startsWith('http') ? res.file_url : `${BASE}${res.file_url}`)
            editor.chain().focus().setImage({ src: url }).run()
        } catch {
            toast.error('Upload failed')
        }
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-gray-50">
                {/* Font family / size */}
                <select className="text-sm border rounded px-2 py-1"
                    onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}>
                    <option value="">Font</option>
                    {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/['"]/g, '')}</option>)}
                </select>
                <select className="text-sm border rounded px-2 py-1"
                    onChange={e => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}>
                    {['10px', '12px', '14px', '16px', '18px', '20px', '24px'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* Basic marks */}
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={act(() => editor.chain().toggleBold())}><b>B</b></button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={act(() => editor.chain().toggleItalic())}><i>I</i></button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={act(() => editor.chain().toggleUnderline())}><u>U</u></button>
                <button className="px-2 py-1 text-sm rounded hover:bg-white" onClick={act(() => editor.chain().toggleHighlight())}>HL</button>

                {/* Alignment */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().setTextAlign('left'))}>Left</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().setTextAlign('center'))}>Center</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().setTextAlign('right'))}>Right</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().setTextAlign('justify'))}>Justify</button>

                {/* Colors */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">Text</span>
                    {COLORS.map(c => (
                        <button key={'fg' + c} className="w-4 h-4 rounded border" style={{ background: c }}
                            onClick={act(() => editor.chain().setColor(c))} />
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 ml-2 mr-1">Highlight</span>
                    {COLORS.map(c => (
                        <button key={'bg' + c} className="w-4 h-4 rounded border" style={{ background: c }}
                            onClick={act(() => editor.chain().toggleHighlight({ color: c }))} />
                    ))}
                </div>

                {/* Lists */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().toggleBulletList())}>• List</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().toggleOrderedList())}>1. List</button>

                {/* Columns (wrap selection in .cols-2 / .cols-3 container) */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.commands.setBlockquote())}>Block</button>
                <button className="px-2 py-1 text-sm" onClick={() => {
                    const html = `<div class="cols-2">${editor.state.selection.content().content.textBetween(0, editor.state.selection.content().size, '\n')}</div>`
                    editor.chain().focus().insertContent(html).run()
                }}>2 Columns</button>
                <button className="px-2 py-1 text-sm" onClick={() => {
                    const html = `<div class="cols-3">${editor.state.selection.content().content.textBetween(0, editor.state.selection.content().size, '\n')}</div>`
                    editor.chain().focus().insertContent(html).run()
                }}>3 Columns</button>

                {/* Images */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <label className="px-2 py-1 text-sm border rounded cursor-pointer">
                    Image
                    <input hidden type="file" accept="image/*" onChange={e => insertImage(e.target.files?.[0])} />
                </label>
                <select className="text-sm border rounded px-2 py-1" onChange={e => editor.chain().focus().updateAttributes('image', { width: e.target.value }).run()}>
                    <option value="">Width</option>
                    <option value="25%">25%</option><option value="33%">33%</option>
                    <option value="50%">50%</option><option value="75%">75%</option>
                    <option value="100%">100%</option>
                </select>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().updateAttributes('image', { float: 'left', center: false }))}>Img Left</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().updateAttributes('image', { float: null, center: true }))}>Img Center</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().updateAttributes('image', { float: 'right', center: false }))}>Img Right</button>

                {/* Tables */}
                <span className="mx-1 w-px h-5 bg-gray-200" />
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}>Table</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().addColumnAfter())}>+Col</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().deleteColumn())}>−Col</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().addRowAfter())}>+Row</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().deleteRow())}>−Row</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().mergeCells())}>Merge</button>
                <button className="px-2 py-1 text-sm" onClick={act(() => editor.chain().splitCell())}>Split</button>
                <select className="text-sm border rounded px-2 py-1" onChange={e => setBorder(e.target.value)()} defaultValue="">
                    <option value="" disabled>Borders</option>
                    <option value="all">All</option>
                    <option value="h">Horizontal</option>
                    <option value="v">Vertical</option>
                    <option value="none">None</option>
                </select>
                <select className="text-sm border rounded px-2 py-1" onChange={e => setCellBg(e.target.value)()} defaultValue="">
                    <option value="" disabled>Cell Shade</option>
                    {COLORS.map(c => <option key={'c' + c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>)}
                </select>
                <button className="px-2 py-1 text-sm" onClick={shadeRow()}>Shade Row</button>
            </div>

            {/* Content */}
            <div className="min-h-[320px] p-3 prose max-w-none">
                <EditorContent editor={editor} />
            </div>
            <div className="px-3 py-1 text-[10px] text-gray-500 border-t bg-gray-50">
                Tip: Drag column borders to resize. Images support width% + float/center for wrapping.
            </div>
        </div>
    )
}
