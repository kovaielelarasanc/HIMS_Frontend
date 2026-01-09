// FILE: src/pharmacy/PharmacyRoutes.jsx
import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import PharmacyLayout from "./PharmacyLayout"

import PharmacyDashboard from "./pages/PharmacyDashboard"
import ItemsPage from "./pages/masters/ItemsPage"
import GrnsPage from "./pages/procurement/GrnsPage"
import GrnEditor from "./pages/procurement/GrnEditor"
import StockPage from "./pages/stock/StockPage"
import DispensePage from "./pages/dispense/DispensePage"
import DispenseEditor from "./pages/dispense/DispenseEditor"
import InsurancePage from "./pages/insurance/InsurancePage"
import AlertsPage from "./pages/alerts/AlertsPage"
import ReportsPage from "./pages/reports/ReportsPage"
import AuditPage from "./pages/audit/AuditPage"

export default function PharmacyRoutes() {
    return (
        <Routes>
            <Route path="/" element={<PharmacyLayout />}>
                <Route index element={<PharmacyDashboard />} />

                <Route path="masters/items" element={<ItemsPage />} />

                <Route path="proc/grns" element={<GrnsPage />} />
                <Route path="proc/grns/new" element={<GrnEditor mode="create" />} />
                <Route path="proc/grns/:grnId" element={<GrnEditor mode="edit" />} />

                <Route path="stock" element={<StockPage />} />

                <Route path="new/dispense" element={<DispensePage />} />
                <Route path="new/dispense/new" element={<DispenseEditor mode="create" />} />
                <Route path="new/dispense/:dispenseId" element={<DispenseEditor mode="edit" />} />

                <Route path="insurance" element={<InsurancePage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit" element={<AuditPage />} />

                <Route path="*" element={<Navigate to="/pharmacy" replace />} />
            </Route>
        </Routes>
    )
}
