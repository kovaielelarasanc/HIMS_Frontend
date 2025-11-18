// src/pharmacy/routes.jsx
import { Routes, Route } from 'react-router-dom'
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
import Pharmacy from './Pharmacy'

export default function PharmacyRoutes() {
    return (
        <Routes>
            <Route path="/pharmacy" element={<Pharmacy />} />
            <Route path="/pharmacy/medicines" element={<Medicines />} />
            <Route path="/pharmacy/suppliers" element={<Suppliers />} />
            <Route path="/pharmacy/locations" element={<Locations />} />
            <Route path="/pharmacy/inventory" element={<Inventory />} />
            <Route path="/pharmacy/transactions" element={<Transactions />} />
            <Route path="/pharmacy/po" element={<PurchaseOrders />} />
            <Route path="/pharmacy/grn" element={<GRN />} />
            <Route path="/pharmacy/alerts" element={<Alerts />} />
            <Route path="/pharmacy/dispense" element={<Dispense />} />
            <Route path="/pharmacy/returns" element={<Returns />} />
            <Route path="/pharmacy/prescriptions" element={<Prescriptions />} />
        </Routes>
    )
}
