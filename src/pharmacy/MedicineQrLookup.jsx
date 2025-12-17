// FILE: frontend/src/pharmacy/MedicineQrLookup.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { getItemByQr } from '../api/inventory'
import API from '../api/client'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import {
    QrCode,
    ScanLine,
    Pill,
    Info,
    Loader2,
    Camera,
    CameraOff,
} from 'lucide-react'

import { Html5QrcodeScanner } from 'html5-qrcode'

export default function MedicineQrLookup() {
    const [qrValue, setQrValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [item, setItem] = useState(null)
    const [error, setError] = useState('')
    const [qrImageUrl, setQrImageUrl] = useState(null)

    const [useCamera, setUseCamera] = useState(false)
    const scannerRef = useRef(null)

    // ---- core search logic (used by form + camera) ----
    const loadQrBlobForItem = useCallback(async (foundItem) => {
        if (!foundItem) {
            setQrImageUrl(null)
            return
        }
        try {
            const res = await API.get(
                `/inventory/items/${foundItem.id}/qr`,
                { responseType: 'blob' }
            )
            const url = URL.createObjectURL(res.data)
            setQrImageUrl((prev) => {
                // clean old URL
                if (prev) URL.revokeObjectURL(prev)
                return url
            })
        } catch (err) {
            console.error(err)
            setQrImageUrl(null)
            toast.error('Unable to load QR image')
        }
    }, [])

    const searchByQr = useCallback(
        async (rawQr) => {
            const trimmed = (rawQr || '').trim()
            setError('')
            setItem(null)
            setQrImageUrl(null)

            if (!trimmed) {
                setError('Please scan or enter a QR number.')
                return
            }

            try {
                setLoading(true)
                const res = await getItemByQr(trimmed)
                setItem(res.data)
                await loadQrBlobForItem(res.data)
            } catch (err) {
                const msg =
                    err?.response?.data?.detail ||
                    err?.message ||
                    'No medicine found for this QR'
                setError(msg)
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [loadQrBlobForItem]
    )

    // ---- form submit ----
    const handleSubmit = useCallback(
        async (e) => {
            e.preventDefault()
            await searchByQr(qrValue)
        },
        [qrValue, searchByQr]
    )

    // ---- camera scanner setup ----
    const onScanSuccess = useCallback(
        async (decodedText) => {
            setQrValue(decodedText)
            toast.success(`QR scanned: ${decodedText}`)
            setUseCamera(false) // hide camera after successful scan
            await searchByQr(decodedText)
        },
        [searchByQr]
    )

    const onScanError = useCallback(() => {
        // ignore noisy scan errors
    }, [])

    useEffect(() => {
        if (!useCamera) {
            // clear scanner if turning off
            if (scannerRef.current) {
                scannerRef.current
                    .clear()
                    .catch(() => { })
                scannerRef.current = null
            }
            return
        }

        const scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
                fps: 10,
                qrbox: 250,
            },
            false
        )

        scannerRef.current = scanner
        scanner.render(onScanSuccess, onScanError)

        return () => {
            if (scannerRef.current) {
                scannerRef.current
                    .clear()
                    .catch(() => { })
                scannerRef.current = null
            }
        }
    }, [useCamera, onScanSuccess, onScanError])

    // ---- download QR ----
    const handleDownloadQr = useCallback(async () => {
        if (!item) return
        try {
            const res = await API.get(
                `/inventory/items/${item.id}/qr`,
                { responseType: 'blob' }
            )
            const blob = res.data
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${item.code || 'medicine'}_qr.png`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            const msg = err?.message || 'Unable to download QR image'
            toast.error(msg)
        }
    }, [item])

    // ---- cleanup object URL on unmount ----
    useEffect(() => {
        return () => {
            if (qrImageUrl) {
                URL.revokeObjectURL(qrImageUrl)
            }
        }
    }, [qrImageUrl])

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
                            <QrCode className="h-6 w-6 text-slate-700" />
                            Medicine QR Lookup
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Scan medicine QR code with camera / scanner or enter QR number to
                            instantly fetch medicine details.
                        </p>
                    </div>

                    <Badge className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                        <ScanLine className="h-3 w-3" />
                        Live QR search
                    </Badge>
                </div>

                {/* Search + camera toggle */}
                <Card className="rounded-2xl border-slate-500 shadow-sm">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-900">
                                Scan or Enter QR Number
                            </CardTitle>
                            <p className="mt-1 text-xs text-slate-500">
                                Keep the cursor inside the QR box and scan with your scanner or
                                use the camera scanner below.
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant={useCamera ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => setUseCamera((v) => !v)}
                            className="inline-flex items-center gap-2"
                        >
                            {useCamera ? (
                                <>
                                    <CameraOff className="h-4 w-4" />
                                    Stop Camera
                                </>
                            ) : (
                                <>
                                    <Camera className="h-4 w-4" />
                                    Use Camera Scanner
                                </>
                            )}
                        </Button>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* QR input */}
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-600">
                                    QR Number
                                </label>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="relative flex-1">
                                        <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            autoFocus
                                            value={qrValue}
                                            onChange={(e) => setQrValue(e.target.value)}
                                            placeholder="e.g., MED-000123 or scan with your QR scanner..."
                                            className="pl-9 text-sm"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Searching...
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-2">
                                                <SearchIcon />
                                                Search
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-slate-500">
                                <Info className="mt-0.5 h-3 w-3" />
                                <p>
                                    For USB QR scanners: focus the box and scan. Most scanners
                                    type the code and press&nbsp;
                                    <span className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-semibold">
                                        Enter
                                    </span>
                                    automatically.
                                </p>
                            </div>
                        </form>

                        {/* Camera area */}
                        {useCamera && (
                            <div className="mt-3 rounded-2xl border border-dashed border-slate-500 bg-slate-100/60 px-3 py-3">
                                <p className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                                    <Camera className="h-3 w-3" />
                                    Point your medicine QR code at the camera. Once decoded, the
                                    medicine will load automatically.
                                </p>
                                <div
                                    id="qr-reader"
                                    className="h-[280px] w-full overflow-hidden rounded-xl bg-black/90"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                <Info className="h-3 w-3" />
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Result card */}
                {item && (
                    <Card className="rounded-2xl border-slate-500 shadow-sm">
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Pill className="h-5 w-5 text-slate-700" />
                                    <span>{item.name}</span>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Code:{' '}
                                    <span className="font-mono text-slate-700">
                                        {item.code}
                                    </span>
                                    {item.qr_number && (
                                        <>
                                            {' · '}QR:{' '}
                                            <span className="font-mono text-slate-700">
                                                {item.qr_number}
                                            </span>
                                        </>
                                    )}
                                </p>
                                {item.generic_name && (
                                    <p className="text-xs text-slate-500">
                                        Generic: {item.generic_name}
                                    </p>
                                )}
                            </div>

                            {qrImageUrl && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="rounded-xl border border-slate-500 bg-white p-2">
                                        <img
                                            src={qrImageUrl}
                                            alt={`QR for ${item.name}`}
                                            className="h-28 w-28 object-contain"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={handleDownloadQr}
                                    >
                                        <QrCode className="mr-1 h-3 w-3" />
                                        Download QR
                                    </Button>
                                </div>
                            )}
                        </CardHeader>

                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailBox
                                label="FORM / STRENGTH"
                                value={`${item.form || '-'}${item.strength ? ` · ${item.strength}` : ''
                                    }`}
                            />
                            <DetailBox
                                label="PACK"
                                value={`${item.pack_size || '-'} ${item.unit || ''}`}
                            />
                            <DetailBox
                                label="MANUFACTURER"
                                value={item.manufacturer || '-'}
                            />
                            <DetailBox
                                label="THERAPEUTIC CLASS"
                                value={item.class_name || '-'}
                            />
                            <DetailBox label="ATC CODE" value={item.atc_code || '-'} />
                            <DetailBox label="HSN CODE" value={item.hsn_code || '-'} />
                            <DetailBox
                                label="MRP / PRICE"
                                value={`₹${item.default_mrp || 0} MRP · ₹${item.default_price || 0
                                    } Price`}
                            />
                            <DetailBox
                                label="TAX %"
                                value={`${item.default_tax_percent || 0}%`}
                            />
                            <DetailBox
                                label="REORDER / MAX LEVEL"
                                value={`${item.reorder_level || 0} / ${item.max_level || 0
                                    }`}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

function DetailBox({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-500 bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-1 truncate text-sm text-slate-800" title={value}>
                {value || '-'}
            </p>
        </div>
    )
}

function SearchIcon() {
    return <ScanLine className="h-4 w-4" />
}
