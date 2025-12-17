import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'

import { downloadItemsTemplate, previewItemsUpload, commitItemsUpload } from '@/api/inventory'

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}

export default function ItemsBulkUploadDialog({ open, onOpenChange, onImported }) {
    const [file, setFile] = useState(null)
    const [drag, setDrag] = useState(false)

    const [preview, setPreview] = useState(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [loadingCommit, setLoadingCommit] = useState(false)

    const [strict, setStrict] = useState(true)
    const [updateBlanks, setUpdateBlanks] = useState(false)

    const [errSearch, setErrSearch] = useState('')

    const errors = preview?.errors || []
    const totalRows = preview?.total_rows ?? 0
    const validRows = preview?.valid_rows ?? Math.max(0, totalRows - errors.length) // safe fallback
    const errorRows = errors.length

    const filteredErrors = useMemo(() => {
        const q = errSearch.trim().toLowerCase()
        if (!q) return errors
        return errors.filter((e) => {
            const s = `${e.row} ${e.code || ''} ${e.column || ''} ${e.message || ''}`.toLowerCase()
            return s.includes(q)
        })
    }, [errors, errSearch])

    const canCommit = !!file && !!preview && (!strict || errorRows === 0)

    function resetAll() {
        setFile(null)
        setPreview(null)
        setErrSearch('')
        setStrict(true)
        setUpdateBlanks(false)
        setDrag(false)
    }

    async function handleTemplate(format) {
        try {
            const res = await downloadItemsTemplate(format)
            downloadBlob(res.data, format === 'xlsx' ? 'items_template.xlsx' : 'items_template.csv')
            toast.success(`${format.toUpperCase()} template downloaded`)
        } catch { }
    }

    async function handlePreview(f) {
        if (!f) return
        setFile(f)
        setPreview(null)
        setErrSearch('')
        setLoadingPreview(true)

        try {
            const res = await previewItemsUpload(f)
            setPreview(res.data)
            const errs = res.data?.errors || []
            if (errs.length) toast.warning(`Found ${errs.length} issue(s). Fix & re-upload.`)
            else toast.success('Preview looks good ✅')
        } catch (e) {
            setPreview(null)
        } finally {
            setLoadingPreview(false)
        }
    }

    async function handleCommit() {
        if (!file) return toast.error('Choose a file first')
        if (!preview) return toast.error('Preview first')

        setLoadingCommit(true)
        try {
            const res = await commitItemsUpload(file, { updateBlanks, strict })
            toast.success(`Imported ✅ Created: ${res.data.created}, Updated: ${res.data.updated}`)
            onImported?.(res.data)
            onOpenChange(false)
            resetAll()
        } catch (e) {
            const detail = e?.response?.data?.detail
            if (Array.isArray(detail)) {
                setPreview((p) => ({ ...(p || {}), errors: detail }))
                toast.error(`Fix ${detail.length} error(s) and re-upload`)
            }
        } finally {
            setLoadingCommit(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) resetAll()
                onOpenChange(v)
            }}
        >
            <DialogContent className="rounded-3xl w-[96vw] max-w-5xl p-0 overflow-hidden">
                {/* Scrollable body */}
                <div className="max-h-[88vh] overflow-auto p-6">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                Bulk Upload Items (CSV / Excel)
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                                onClick={() => onOpenChange(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogTitle>

                        {/* Header row: templates left, switches right (wrap-safe) */}
                        <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-center">
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="rounded-2xl gap-2" onClick={() => handleTemplate('csv')}>
                                    <Download className="h-4 w-4" />
                                    Template CSV
                                </Button>
                                <Button variant="outline" className="rounded-2xl gap-2" onClick={() => handleTemplate('xlsx')}>
                                    <Download className="h-4 w-4" />
                                    Template Excel
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 justify-start md:justify-end">
                                <div className="flex items-center gap-2">
                                    <Switch checked={strict} onCheckedChange={setStrict} />
                                    <Label className="text-sm whitespace-nowrap">Strict (recommended)</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={updateBlanks} onCheckedChange={setUpdateBlanks} />
                                    <Label className="text-sm whitespace-nowrap">Overwrite blanks</Label>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Dropzone */}
                    <div
                        className={[
                            'mt-4 rounded-3xl border border-dashed p-5 transition',
                            drag ? 'bg-slate-50 border-slate-400' : 'bg-white border-slate-500',
                        ].join(' ')}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDrag(true)
                        }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDrag(false)
                            const f = e.dataTransfer.files?.[0]
                            if (f) handlePreview(f)
                        }}
                    >
                        <div className="grid gap-4 md:grid-cols-[1fr,auto] md:items-center">
                            <div>
                                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    Drag & drop file here
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Supports: .csv, .tsv, .txt, .xlsx</div>
                                <div className="text-xs text-slate-700 mt-2">
                                    Selected: <span className="font-medium">{file?.name || '—'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <input
                                    id="items-upload"
                                    type="file"
                                    accept=".csv,.tsv,.txt,.xlsx"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) handlePreview(f)
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => document.getElementById('items-upload')?.click()}
                                    disabled={loadingPreview || loadingCommit}
                                >
                                    Choose file
                                </Button>
                                <Button
                                    className="rounded-2xl"
                                    onClick={() => file && handlePreview(file)}
                                    disabled={!file || loadingPreview || loadingCommit}
                                >
                                    {loadingPreview ? 'Previewing…' : 'Preview'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview ? (
                        <div className="mt-4 rounded-3xl border border-slate-500 bg-white p-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs rounded-xl">File: {(preview.file_type || '—').toUpperCase()}</Badge>
                                <Badge variant="outline" className="text-xs rounded-xl">Total: {totalRows}</Badge>
                                <Badge variant="outline" className="text-xs rounded-xl">Valid: {validRows}</Badge>
                                {errorRows ? (
                                    <Badge className="text-xs rounded-xl bg-rose-600">Errors: {errorRows}</Badge>
                                ) : (
                                    <Badge className="text-xs rounded-xl bg-emerald-600">No errors</Badge>
                                )}
                            </div>

                            <Separator />

                            <div className="grid gap-4 lg:grid-cols-2">
                                {/* Errors */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold flex items-center gap-2">
                                            {errorRows ? (
                                                <AlertTriangle className="h-4 w-4 text-rose-600" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            )}
                                            Validation
                                        </div>
                                        {errorRows ? (
                                            <Input
                                                placeholder="Search errors..."
                                                className="w-44 bg-white rounded-2xl"
                                                value={errSearch}
                                                onChange={(e) => setErrSearch(e.target.value)}
                                            />
                                        ) : null}
                                    </div>

                                    <div className="rounded-2xl border border-slate-500 overflow-hidden">
                                        <div className="max-h-64 overflow-auto">
                                            {errorRows === 0 ? (
                                                <div className="p-3 text-sm text-slate-600">All rows look valid ✅</div>
                                            ) : filteredErrors.length === 0 ? (
                                                <div className="p-3 text-sm text-slate-600">No matching errors</div>
                                            ) : (
                                                <div className="divide-y">
                                                    {filteredErrors.slice(0, 80).map((e, idx) => (
                                                        <div key={idx} className="p-3 text-xs">
                                                            <div className="font-semibold text-slate-900">
                                                                Row {e.row} {e.code ? `• ${e.code}` : ''} {e.column ? `• ${e.column}` : ''}
                                                            </div>
                                                            <div className="text-slate-600 mt-1">{e.message}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        Tip: Fix errors in Excel and re-upload. Strict mode prevents partial imports (best for NABH audit).
                                    </div>
                                </div>

                                {/* Sample rows */}
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold">Preview (valid rows)</div>
                                    <div className="rounded-2xl border border-slate-500 overflow-hidden">
                                        <div className="max-h-64 overflow-auto">
                                            <div className="min-w-[640px]">
                                                <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 bg-slate-50">
                                                    <span>Code</span>
                                                    <span>Name</span>
                                                    <span>Generic</span>
                                                    <span className="text-right">Price</span>
                                                </div>
                                                <div className="divide-y">
                                                    {(preview.sample_rows || []).slice(0, 30).map((r, i) => (
                                                        <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
                                                            <span className="text-slate-700">{r.code || '—'}</span>
                                                            <span className="font-medium text-slate-900 truncate">{r.name || '—'}</span>
                                                            <span className="text-slate-600 truncate">{r.generic_name || '—'}</span>
                                                            <span className="text-right text-slate-700">{r.default_price ?? '—'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        Note: Item defaults are for prefill only. Actual selling/billing uses batch MRP from GRN (FEFO).
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Sticky footer (fixes hidden Commit button) */}
                    <div className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-white border-t border-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={resetAll}
                            disabled={loadingPreview || loadingCommit}
                        >
                            Reset
                        </Button>

                        <Button
                            className="rounded-2xl"
                            onClick={handleCommit}
                            disabled={!canCommit || loadingPreview || loadingCommit}
                        >
                            {loadingCommit ? 'Importing…' : strict ? 'Commit Import' : 'Commit (Non-strict)'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
