// frontend/src/billing/PatientBillingSummary.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Printer, IndianRupee } from 'lucide-react'
import {
    getPatientBillingSummary,
    patientSummaryPrintUrl,
} from '../api/billing'

const money = (v) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(Number(v || 0))

const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', {
        dateStyle: 'medium',
    })
}

export default function PatientBillingSummary() {
    const { patientId } = useParams()
    const navigate = useNavigate()

    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let alive = true
        const run = async () => {
            try {
                setLoading(true)
                const { data } = await getPatientBillingSummary(patientId)
                if (!alive) return
                setSummary(data)
            } finally {
                if (alive) setLoading(false)
            }
        }
        run()
        return () => {
            alive = false
        }
    }, [patientId])

    if (loading && !summary) {
        return (
            <div className="px-4 py-6 lg:px-6">
                <p className="text-sm text-slate-600">
                    Loading patient billing summary…
                </p>
            </div>
        )
    }

    if (!summary) {
        return (
            <div className="px-4 py-6 lg:px-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                </Button>
                <p className="text-sm text-slate-600">Summary not available.</p>
            </div>
        )
    }

    const { patient, totals, by_billing_type, ar_aging, payment_modes } =
        summary

    const handlePrint = () => {
        window.open(
            patientSummaryPrintUrl(patient.id),
            '_blank',
            'noopener,noreferrer'
        )
    }

    return (
        <div className="px-4 py-4 lg:px-6 lg:py-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 mb-1"
                    >
                        <ArrowLeft className="w-3 h-3 mr-1" />
                        Back
                    </button>
                    <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        Patient Billing Summary
                        <Badge className="bg-slate-900 text-white border-none">
                            ID: {patient.id}
                        </Badge>
                    </h1>
                    <p className="text-xs text-slate-600">
                        {patient.name || 'Unnamed'} · UHID:{' '}
                        {patient.uhid || '—'} · Phone: {patient.phone || '—'}
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={handlePrint}
                >
                    <Printer className="w-4 h-4" />
                    Print summary
                </Button>
            </div>

            {/* Overall totals */}
            <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-800">
                        Overall totals
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200 text-slate-700">
                        <IndianRupee className="w-3 h-3" />
                        Net total: {money(totals.net_total)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-100 text-emerald-700">
                        <IndianRupee className="w-3 h-3" />
                        Amount received: {money(totals.amount_paid)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 border border-amber-100 text-amber-700">
                        <IndianRupee className="w-3 h-3" />
                        Balance due: {money(totals.balance_due)}
                    </span>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Invoice-wise details */}
                <Card className="border-slate-200 shadow-sm rounded-2xl lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-800">
                            Invoice-wise details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Separator />
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-[11px] text-slate-500">
                                        <th className="px-3 py-2 font-medium">#</th>
                                        <th className="px-3 py-2 font-medium">Inv ID</th>
                                        <th className="px-3 py-2 font-medium">Invoice No</th>
                                        <th className="px-3 py-2 font-medium">Type</th>
                                        <th className="px-3 py-2 font-medium">Context</th>
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium text-right">
                                            Net
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                            Paid
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                            Balance
                                        </th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.invoices.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={10}
                                                className="px-3 py-6 text-center text-xs text-slate-500"
                                            >
                                                No invoices for this patient.
                                            </td>
                                        </tr>
                                    )}
                                    {summary.invoices.map((inv, idx) => (
                                        <tr
                                            key={inv.id}
                                            className="border-t border-slate-100 hover:bg-slate-50/70"
                                        >
                                            <td className="px-3 py-2 align-middle text-[11px]">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-700">
                                                {inv.id}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-800">
                                                {inv.invoice_number}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-600 uppercase">
                                                {inv.billing_type}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-500">
                                                {inv.context_type || '—'}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-600">
                                                {formatDate(inv.created_at)}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right text-[11px] text-slate-800">
                                                {Number(inv.net_total || 0).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right text-[11px] text-slate-800">
                                                {Number(inv.amount_paid || 0).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right text-[11px] text-slate-800">
                                                {Number(inv.balance_due || 0).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-[11px] text-slate-700">
                                                {inv.status}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* AR ageing + billing type + payment modes */}
                <div className="space-y-4">
                    {/* AR ageing */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-800">
                                AR ageing
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-xs">
                            {[
                                ['0–30 days', ar_aging.bucket_0_30],
                                ['31–60 days', ar_aging.bucket_31_60],
                                ['61–90 days', ar_aging.bucket_61_90],
                                ['> 90 days', ar_aging.bucket_90_plus],
                            ].map(([label, bucket]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[11px] text-slate-600">
                                            {label}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            Invoices: {bucket.count}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-slate-900">
                                        {money(bucket.amount)}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Payment modes */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-800">
                                Payment modes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                            {Object.keys(payment_modes).length === 0 && (
                                <p className="text-xs text-slate-500">
                                    No payments recorded.
                                </p>
                            )}
                            {Object.entries(payment_modes).map(([mode, amt]) => (
                                <div
                                    key={mode}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <span className="text-slate-600">{mode}</span>
                                    <span className="font-medium text-slate-900">
                                        {money(amt)}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Billing type split */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-800">
                                Revenue by billing type
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                            {Object.keys(by_billing_type).length === 0 && (
                                <p className="text-xs text-slate-500">
                                    No billing data yet.
                                </p>
                            )}
                            {Object.entries(by_billing_type).map(([btype, agg]) => (
                                <div
                                    key={btype}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-slate-700 uppercase">
                                            {btype}
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            Received: {money(agg.amount_paid)} · Balance:{' '}
                                            {money(agg.balance_due)}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-slate-900">
                                        {money(agg.net_total)}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
