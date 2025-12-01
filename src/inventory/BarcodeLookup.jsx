// FILE: frontend/src/pages/inventory/BarcodeLookup.jsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { findItemByBarcode, getItemBarcodePng } from '../api/inventory'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
    ScanBarcode,
    Search,
    Download,
    Pill,
    Package,
    Tag,
    IndianRupee,
    AlertCircle,
} from 'lucide-react'

export default function BarcodeLookup() {
    const [barcode, setBarcode] = useState('')
    const [loading, setLoading] = useState(false)
    const [item, setItem] = useState(null)
    const [barcodeUrl, setBarcodeUrl] = useState('')
    const [fetchingBarcode, setFetchingBarcode] = useState(false)

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (barcodeUrl) URL.revokeObjectURL(barcodeUrl)
        }
    }, [barcodeUrl])

    const handleSearch = async () => {
        const trimmed = barcode.trim()
        if (!trimmed) {
            toast.error('Please enter or scan a barcode number')
            return
        }
        setLoading(true)
        setItem(null)
        setBarcodeUrl('')
        try {
            const res = await findItemByBarcode(trimmed)
            const data = res.data
            setItem(data)
            await fetchBarcodeImage(data.id)
        } catch (err) {
            console.error('Failed to lookup item by barcode', err)
            // Global axios interceptor will already show toast
        } finally {
            setLoading(false)
        }
    }

    const fetchBarcodeImage = async (itemId) => {
        setFetchingBarcode(true)
        try {
            const res = await getItemBarcodePng(itemId)
            const blobUrl = URL.createObjectURL(res.data)
            setBarcodeUrl(blobUrl)
        } catch (err) {
            console.error('Failed to fetch barcode image', err)
        } finally {
            setFetchingBarcode(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearch()
        }
    }

    const handleDownloadBarcode = async () => {
        if (!item) return
        try {
            const res = await getItemBarcodePng(item.id)
            const blob = new Blob([res.data], { type: 'image/png' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${item.code || 'medicine'}_barcode.png`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Failed to download barcode image', err)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 md:space-y-6">
            {/* Search / scan card */}
            <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-slate-900">
                        <ScanBarcode className="w-5 h-5" />
                        <span>Medicine Barcode Lookup</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                            Pharmacy Inventory
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <ScanBarcode className="w-4 h-4 text-slate-500 shrink-0" />
                            <Input
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. MD_1001"
                                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
                                autoFocus
                            />
                        </div>
                        <Button
                            onClick={handleSearch}
                            className="shrink-0 bg-slate-900 text-white rounded-2xl px-5"
                            disabled={loading}
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {loading ? 'Searching...' : 'Search'}
                        </Button>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Keep the cursor inside the barcode box and scan with your barcode
                        / QR scanner. Most scanners behave like a keyboard and press&nbsp;
                        <span className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium">
                            Enter
                        </span>
                        &nbsp;automatically.
                    </p>
                </CardContent>
            </Card>

            {/* Result card */}
            {loading && (
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardContent className="p-4 md:p-6 space-y-4">
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        <div className="grid gap-3 md:grid-cols-3">
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && item && (
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-4 md:p-6 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                            {/* Left: main text */}
                            <div className="flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                                        <Pill className="w-4 h-4 text-slate-600" />
                                    </span>
                                    <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                                        {item.name}
                                    </h2>
                                </div>
                                <div className="text-sm text-slate-500 space-x-2">
                                    <span>
                                        <span className="font-medium text-slate-600">Code:</span>{' '}
                                        {item.code}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span>
                                        <span className="font-medium text-slate-600">
                                            Barcode:
                                        </span>{' '}
                                        {item.qr_number}
                                    </span>
                                </div>
                                {item.generic_name && (
                                    <p className="text-sm text-slate-600">
                                        <span className="font-medium">Generic:</span>{' '}
                                        {item.generic_name}
                                    </p>
                                )}
                            </div>

                            {/* Right: barcode image + download */}
                            <div className="w-full md:w-64 lg:w-72 flex flex-col items-center gap-3">
                                <div className="w-full h-32 md:h-36 rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                    {fetchingBarcode && (
                                        <Skeleton className="w-40 h-20 rounded-md" />
                                    )}
                                    {!fetchingBarcode && barcodeUrl && (
                                        <img
                                            src={barcodeUrl}
                                            alt={`Barcode for ${item.name}`}
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    )}
                                    {!fetchingBarcode && !barcodeUrl && (
                                        <span className="text-xs text-slate-400">
                                            No barcode image
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full rounded-2xl"
                                    onClick={handleDownloadBarcode}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Barcode
                                </Button>
                            </div>
                        </div>

                        {/* Info grid */}
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 mt-3">
                            <InfoTile
                                label="Form / Strength"
                                icon={<Pill className="w-4 h-4" />}
                                value={`${item.form || '-'} ${item.strength ? `· ${item.strength}` : ''
                                    }`}
                            />
                            <InfoTile
                                label="Pack"
                                icon={<Package className="w-4 h-4" />}
                                value={`${item.pack_size || 1} ${item.unit || 'unit'}`}
                            />
                            <InfoTile
                                label="Manufacturer"
                                icon={<Tag className="w-4 h-4" />}
                                value={item.manufacturer || '—'}
                            />
                            <InfoTile
                                label="Therapeutic class"
                                icon={<Tag className="w-4 h-4" />}
                                value={item.class_name || '—'}
                            />
                            <InfoTile
                                label="ATC code"
                                icon={<Tag className="w-4 h-4" />}
                                value={item.atc_code || '—'}
                            />
                            <InfoTile
                                label="HSN code"
                                icon={<Tag className="w-4 h-4" />}
                                value={item.hsn_code || '—'}
                            />
                            <InfoTile
                                label="MRP / Price"
                                icon={<IndianRupee className="w-4 h-4" />}
                                value={`₹${Number(item.default_mrp || 0).toFixed(
                                    2,
                                )} MRP · ₹${Number(item.default_price || 0).toFixed(
                                    2,
                                )} Price`}
                            />
                            <InfoTile
                                label="Reorder / Max level"
                                icon={<AlertCircle className="w-4 h-4" />}
                                value={`${Number(item.reorder_level || 0).toFixed(
                                    2,
                                )} / ${Number(item.max_level || 0).toFixed(2)}`}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function InfoTile({ label, icon, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {icon}
                </span>
                {label}
            </div>
            <div className="text-sm text-slate-800 truncate" title={String(value)}>
                {value || '—'}
            </div>
        </div>
    )
}
