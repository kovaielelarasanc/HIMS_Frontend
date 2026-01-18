
// FILE: src/billing/caseTabs/shared.jsx
import React from "react"
import { Card, CardBody, cn, money } from "../_ui"

export const PAYMENT_MODES = ["CASH", "CARD", "UPI", "BANK", "WALLET"]
export const ADV_TYPES = ["ADVANCE", "REFUND", "ADJUSTMENT"]
export const INVOICE_STATUSES = ["ALL", "DRAFT", "APPROVED", "POSTED", "VOID"]
export const GROUP_BY = [
    { value: "module", label: "Group by Module" },
    { value: "service_group", label: "Group by Service Group" },
    { value: "invoice", label: "Group by Invoice" },
]

export const normItems = (x) =>
    Array.isArray(x) ? x : x?.items ?? x?.results ?? x?.data?.items ?? x?.data ?? []

export function fmtDate(v) {
    if (!v) return "—"
    try {
        return new Date(v).toLocaleString("en-IN")
    } catch {
        return String(v)
    }
}

export function toNum(v, d = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
}

export function upper(v) {
    return String(v || "").toUpperCase()
}

/* -------------------- Small UI blocks -------------------- */

export function StatCard({ title, value, icon: Icon, right }) {
    return (
        <Card>
            <CardBody className="flex items-center justify-between ">
                <div>
                    <div className="text-xs text-slate-500">{title}</div>
                    <div className="text-lg font-extrabold text-slate-900">{value}</div>
                </div>
                {right ? right : Icon ? <Icon className="h-5 w-5 text-slate-400" /> : null}
            </CardBody>
        </Card>
    )
}

export function Info({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">{label}</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
        </div>
    )
}

/* -------------------- Modal -------------------- */

export function Modal({ title, children, onClose, right, wide = false }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className={cn("w-full rounded-2xl bg-white shadow-xl", wide ? "max-w-4xl" : "max-w-xl")}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-base font-extrabold text-slate-900">{title}</div>
                    <div className="flex items-center gap-2">
                        {right}
                        <button
                            onClick={onClose}
                            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                            Close
                        </button>
                    </div>
                </div>
                <div className="max-h-[78vh] overflow-auto px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

// optional helper if you want in multiple places
export function moneyText(v) {
    return `₹ ${money(v || 0)}`
}