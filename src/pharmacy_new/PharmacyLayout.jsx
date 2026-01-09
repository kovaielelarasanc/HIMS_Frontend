// FILE: src/pharmacy/PharmacyLayout.jsx
import React from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { PackageSearch, Boxes, ClipboardList, Truck, Pill, ShieldCheck, Bell, FileText, ScrollText } from "lucide-react"
import { cx } from "./ui/utils"
import { usePharmacyStore } from "./hooks/usePharmacyStore"

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            cx(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                "hover:bg-slate-100",
                isActive ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-700"
            )
        }
    >
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
    </NavLink>
)

export default function PharmacyLayout() {
    const { pathname } = useLocation()
    const { stores, storeId, setStoreId, loading } = usePharmacyStore()

    return (
        <div className="w-full">
            {/* Header */}
            <div className="sticky top-0 z-20">
                <div className="mx-auto max-w-7xl px-3 md:px-6 pt-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
                        <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                                        <Pill className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-base md:text-lg font-semibold text-slate-900 truncate">
                                            Pharmacy Inventory
                                        </h1>
                                        <p className="text-[12px] text-slate-500 truncate">
                                            Audit-ready • Insurance-aware • FEFO dispensing
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Store selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] text-slate-500">Store</span>
                                <select
                                    value={storeId || ""}
                                    onChange={(e) => setStoreId(e.target.value)}
                                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                                    disabled={loading}
                                >
                                    <option value="">{loading ? "Loading..." : "Select store"}</option>
                                    {stores.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name || `Store #${s.id}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Horizontal nav (mobile friendly) */}
                        <div className="border-t border-slate-200">
                            <div className="flex gap-2 overflow-x-auto p-2">
                                <NavItem to="/pharmacy" icon={Boxes} label="Dashboard" />
                                <NavItem to="/pharmacy/masters/items" icon={PackageSearch} label="Items" />
                                <NavItem to="/pharmacy/proc/grns" icon={Truck} label="GRN" />
                                <NavItem to="/pharmacy/stock" icon={ClipboardList} label="Stock" />
                                <NavItem to="/pharmacy/dispense" icon={Pill} label="Dispense" />
                                <NavItem to="/pharmacy/insurance" icon={ShieldCheck} label="Insurance" />
                                <NavItem to="/pharmacy/alerts" icon={Bell} label="Alerts" />
                                <NavItem to="/pharmacy/reports" icon={FileText} label="Reports" />
                                <NavItem to="/pharmacy/audit" icon={ScrollText} label="Audit" />
                            </div>
                            {/* subtle breadcrumb */}
                            <div className="px-3 pb-2">
                                <p className="text-[11px] text-slate-500 truncate">Path: {pathname}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-3 md:px-6 py-4">
                <Outlet />
            </div>
        </div>
    )
}
