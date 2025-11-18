import { useEffect, useState } from 'react'

const SIZES = [
    { key: 'A4', label: 'A4 (210×297 mm)' },
    { key: 'A5', label: 'A5 (148×210 mm)' },
    { key: 'Letter', label: 'Letter (8.5×11 in)' },
    { key: 'Legal', label: 'Legal (8.5×14 in)' },
]

export default function PageSetupModal({ css = '', onApply, onClose }) {
    const [size, setSize] = useState('A4')
    const [orientation, setOrientation] = useState('portrait')
    const [mTop, setMTop] = useState(18)
    const [mRight, setMRight] = useState(16)
    const [mBottom, setMBottom] = useState(18)
    const [mLeft, setMLeft] = useState(16)
    const [pageNums, setPageNums] = useState(true)

    useEffect(() => {
        // If existing @page present, try to parse margins/size
        const m = css.match(/@page\s*{([\s\S]*?)}/)
        if (!m) return
        const block = m[1]
        const get = (re) => (block.match(re) || [, ''])[1]
        const ms = get(/size:\s*([^;]+);/i)
        if (ms) {
            const parts = ms.trim().split(/\s+/)
            setSize(parts[0])
            if (parts[1]) setOrientation(parts[1])
        }
        const mm = (re, fallback) => {
            const v = get(re); return v ? parseInt(v, 10) : fallback
        }
        setMTop(mm(/margin-top:\s*([0-9]+)mm/i, mTop))
        setMRight(mm(/margin-right:\s*([0-9]+)mm/i, mRight))
        setMBottom(mm(/margin-bottom:\s*([0-9]+)mm/i, mBottom))
        setMLeft(mm(/margin-left:\s*([0-9]+)mm/i, mLeft))
        // eslint-disable-next-line
    }, [])

    const buildCss = () => {
        return `@page {
  size: ${size} ${orientation};
  margin-top: ${mTop}mm;
  margin-right: ${mRight}mm;
  margin-bottom: ${mBottom}mm;
  margin-left: ${mLeft}mm;
  ${pageNums ? '@bottom-right { content: "Page " counter(page) " of " counter(pages); font-size:10px; }' : ''}
}`
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-xl">
                <div className="px-4 py-3 border-b font-semibold">Page Setup</div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm">Size
                            <select className="w-full border rounded px-2 py-1"
                                value={size} onChange={e => setSize(e.target.value)}>
                                {SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </label>
                        <label className="text-sm">Orientation
                            <select className="w-full border rounded px-2 py-1"
                                value={orientation} onChange={e => setOrientation(e.target.value)}>
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <label className="text-sm">Top (mm)
                            <input type="number" className="w-full border rounded px-2 py-1" value={mTop} onChange={e => setMTop(+e.target.value)} />
                        </label>
                        <label className="text-sm">Right (mm)
                            <input type="number" className="w-full border rounded px-2 py-1" value={mRight} onChange={e => setMRight(+e.target.value)} />
                        </label>
                        <label className="text-sm">Bottom (mm)
                            <input type="number" className="w-full border rounded px-2 py-1" value={mBottom} onChange={e => setMBottom(+e.target.value)} />
                        </label>
                        <label className="text-sm">Left (mm)
                            <input type="number" className="w-full border rounded px-2 py-1" value={mLeft} onChange={e => setMLeft(+e.target.value)} />
                        </label>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={pageNums} onChange={e => setPageNums(e.target.checked)} />
                        Show page numbers (WeasyPrint)
                    </label>

                    <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{buildCss()}</pre>
                </div>
                <div className="px-4 py-3 border-t flex justify-end gap-2">
                    <button className="px-3 py-2 border rounded" onClick={onClose}>Cancel</button>
                    <button className="px-3 py-2 rounded bg-blue-600 text-white"
                        onClick={() => onApply && onApply(buildCss())}>Apply</button>
                </div>
            </div>
        </div>
    )
}
