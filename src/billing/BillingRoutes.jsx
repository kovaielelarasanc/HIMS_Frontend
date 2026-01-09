// FILE: src/billing/BillingRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom"
import BillingDashboard from "./BillingDashboard"
import BillingCaseDetail from "./BillingCaseDetail"
import InvoiceEditor from "./InvoiceEditor"

export default function BillingRoutes() {
    return (
        <Routes>
            <Route path="/" element={<BillingDashboard />} />
            <Route path="/cases/:caseId" element={<BillingCaseDetail />} />
            <Route path="/invoices/:invoiceId" element={<InvoiceEditor />} />
            <Route path="*" element={<Navigate to="/billing" replace />} />
        </Routes>
    )
}
