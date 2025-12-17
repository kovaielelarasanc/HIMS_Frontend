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
    const [hasSearched, setHasSearched] = useState(false)

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
        setHasSearched(true)
        setItem(null)
        setBarcodeUrl('')
        try {
            const res = await findItemByBarcode(trimmed)
            const data = res.data
            if (!data) {
                setItem(null)
                return
            }
            setItem(data)
            await fetchBarcodeImage(data.id)
        } catch (err) {
            console.error('Failed to lookup item by barcode', err)
            setItem(null)
            // Axios interceptor will show toast
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

    const showEmptyState = !loading && hasSearched && !item

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-5 lg:space-y-6">
                {/* HERO HEADER */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
                    <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
                    <div className="relative px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        {/* Left: Title + description */}
                        <div className="space-y-3 max-w-xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                                    <ScanBarcode className="w-3.5 h-3.5" />
                                </span>
                                Scan & verify pharmacy items instantly
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="inline-flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-sm border border-white/20">
                                    <ScanBarcode className="w-6 h-6" />
                                </div>
                                <div className="space-y-1.5">
                                    <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                                        Medicine Barcode Lookup
                                    </h1>
                                    <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                                        Point your barcode / QR scanner at any{" "}
                                        <span className="font-semibold">pharmacy item</span> and
                                        instantly fetch the mapped medicine, pricing and stock
                                        configuration from{" "}
                                        <span className="font-semibold">Nutryah HIMS</span>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: badges / quick info */}
                        <div className="w-full md:w-auto space-y-3">
                            <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                                <Badge className="bg-white/15 text-xs font-semibold border border-white/25 text-white rounded-full px-3 py-1">
                                    Pharmacy Inventory
                                </Badge>
                                <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                                    Scan-ready
                                </Badge>
                            </div>
                            <div className="rounded-2xl bg-white/10 px-3 py-2.5 border border-white/15 text-xs text-teal-50/90">
                                <span className="font-semibold">Tip:</span> Keep the cursor inside
                                the barcode box. Most hardware scanners type the code and press{" "}
                                <span className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold">
                                    Enter
                                </span>{" "}
                                automatically.
                            </div>
                        </div>
                    </div>
                </div>

                {/* SEARCH / SCAN CARD */}
                <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-slate-900">
                            <div className="flex items-center gap-2">
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                    <ScanBarcode className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold">
                                        Scan or enter barcode / QR number
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Works with both hardware scanners and manual entry.
                                    </p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Input with icon (search pattern) */}
                            <div className="flex-1">
                                <div className="relative flex items-center">
                                    <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
                                        <ScanBarcode className="w-4 h-4" />
                                    </div>
                                    <Input
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Scan or type the barcode / QR number (e.g. MD_1001)"
                                        className="w-full rounded-2xl border border-slate-500 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 shadow-none focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleSearch}
                                className="shrink-0 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 flex items-center gap-2"
                                disabled={loading}
                            >
                                <Search className="w-4 h-4" />
                                {loading ? 'Searching…' : 'Search'}
                            </Button>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            If your scanner is configured as a keyboard wedge, just keep the
                            focus here and scan. No extra clicks needed.
                        </p>
                    </CardContent>
                </Card>

                {/* LOADING STATE */}
                {loading && (
                    <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
                        <CardContent className="p-4 md:p-6 space-y-4">
                            <Skeleton className="h-6 w-2/3 rounded-xl" />
                            <Skeleton className="h-4 w-1/3 rounded-xl" />
                            <div className="grid gap-3 md:grid-cols-3">
                                <Skeleton className="h-20 rounded-2xl" />
                                <Skeleton className="h-20 rounded-2xl" />
                                <Skeleton className="h-20 rounded-2xl" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* EMPTY / NOT FOUND STATE */}
                {showEmptyState && (
                    <Card className="rounded-3xl border-dashed border-slate-300 bg-white shadow-none">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-500">
                                <AlertCircle className="w-6 h-6 text-slate-600" />
                            </div>
                            <h2 className="text-sm md:text-base font-semibold text-slate-900">
                                No item found for this barcode
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 max-w-md">
                                Check if the code is correct or try scanning again. If this is a
                                new medicine, map the barcode in{" "}
                                <span className="font-semibold text-slate-900">
                                    Pharmacy Inventory &gt; Items
                                </span>
                                .
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* RESULT CARD */}
                {!loading && item && (
                    <Card className="rounded-3xl border-slate-500 bg-white shadow-sm overflow-hidden">
                        <CardContent className="p-4 md:p-6 space-y-4">
                            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                                {/* Left: main text */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                                            <Pill className="w-4 h-4 text-slate-600" />
                                        </span>
                                        <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                                            {item.name}
                                        </h2>
                                        {item.is_active === false && (
                                            <Badge
                                                variant="outline"
                                                className="border-amber-300 text-amber-800 bg-amber-50 text-xs rounded-full"
                                            >
                                                Inactive
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                                        <span>
                                            <span className="font-medium text-slate-700">Code:</span>{' '}
                                            {item.code || '—'}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span>
                                            <span className="font-medium text-slate-700">
                                                Barcode / QR:
                                            </span>{' '}
                                            {item.qr_number || '—'}
                                        </span>
                                    </div>
                                    {item.generic_name && (
                                        <p className="text-sm text-slate-600">
                                            <span className="font-medium text-slate-700">
                                                Generic:
                                            </span>{' '}
                                            {item.generic_name}
                                        </p>
                                    )}
                                </div>

                                {/* Right: barcode image + download */}
                                <div className="w-full md:w-64 lg:w-72 flex flex-col items-center gap-3">
                                    <div className="w-full h-32 md:h-36 rounded-2xl border border-dashed border-slate-500 bg-slate-50 flex items-center justify-center">
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
                                        className="w-full rounded-full text-sm font-semibold border-slate-500"
                                        onClick={handleDownloadBarcode}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download barcode
                                    </Button>
                                </div>
                            </div>

                            {/* Info grid */}
                            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 mt-3">
                                <InfoTile
                                    label="Form / Strength"
                                    icon={<Pill className="w-4 h-4" />}
                                    value={`${item.form || '-'}${item.strength ? ` · ${item.strength}` : ''
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
        </div>
    )
}

function InfoTile({ label, icon, value }) {
    return (
        <div className="rounded-2xl border border-slate-500 bg-white px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {icon}
                </span>
                {label}
            </div>
            <div
                className="text-sm text-slate-800 truncate"
                title={value ? String(value) : '—'}
            >
                {value || '—'}
            </div>
        </div>
    )
}
