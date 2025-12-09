// FILE: src/pharmacy/routes.jsx
import { Routes, Route } from 'react-router-dom'

import Pharmacy from './Pharmacy'
import Medicines from './Medicines'
import Suppliers from './Suppliers'
import Locations from './Locations'
import Inventory from './Inventory'
import Transactions from './Transactions'
import PurchaseOrders from './PurchaseOrders'
import GRN from './GRN'
import Alerts from './Alerts'
import Dispense from './Dispense'
import Returns from './Returns'
import Prescriptions from './Prescriptions'
import CreatePrescription from './CreatePrescription'
import PharmacyBilling from './Billing'

export default function PharmacyRoutes() {
    return (
        <Routes>
            <Route path="/pharmacy" element={<Pharmacy />} />

            {/* Masters */}
            <Route path="/pharmacy/medicines" element={<Medicines />} />
            <Route path="/pharmacy/suppliers" element={<Suppliers />} />
            <Route path="/pharmacy/locations" element={<Locations />} />

            {/* Inventory */}
            <Route path="/pharmacy/inventory" element={<Inventory />} />
            <Route path="/pharmacy/transactions" element={<Transactions />} />
            <Route path="/pharmacy/alerts" element={<Alerts />} />

            {/* Procurement */}
            <Route path="/pharmacy/po" element={<PurchaseOrders />} />
            <Route path="/pharmacy/grn" element={<GRN />} />

            {/* Operations */}
            <Route path="/pharmacy/dispense" element={<Dispense />} />
            <Route path="/pharmacy/returns" element={<Returns />} />

            {/* Clinical */}
            <Route path="/pharmacy/prescriptions" element={<Prescriptions />} />
            <Route path="/pharmacy/prescriptions/new" element={<CreatePrescription />} />

            <Route path="/pharmacy/billing" element={<PharmacyBilling />} />
        </Routes>
    )
}
