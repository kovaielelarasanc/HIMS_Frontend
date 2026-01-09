// FILE: src/pharmacy/pages/reports/ReportsPage.jsx
import React from "react"
import { FileText } from "lucide-react"

export default function ReportsPage() {
    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Reports</h2>
                    <p className="text-[12px] text-slate-500">Stock ledger • valuation • expiry • mismatch • consumption • controlled drugs</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-700">
                    Next step: tell me your preferred report output style:
                    <span className="font-medium text-slate-900"> JSON only</span> or
                    <span className="font-medium text-slate-900"> CSV/PDF export</span>.
                </p>
            </div>
        </div>
    )
}
