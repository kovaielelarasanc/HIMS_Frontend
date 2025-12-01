// frontend/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import RegisterAdmin from './pages/auth/RegisterAdmin'
import VerifyOtp from './pages/auth/VerifyOtp'
import AdminDashboard from './pages/dashboards/AdminDashboard'
import UserDashboard from './pages/dashboards/UserDashboard'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Roles from './pages/admin/Roles'
import Users from './pages/admin/Users'
import Permissions from './pages/admin/Permissions'
import Departments from './pages/admin/Departments'
import Patients from './patients/Patients'
// import Schedules from './opd/Schedules'
// import Appointments from './opd/Appointments'
// import Queue from './opd/Queue'
// import Triage from './opd/Triage'
// import Visit from './opd/Visit'
// import Masters from './opd/Masters'
// // 🔁 NEW OPD SCREENS
// import Followups from './opd/Followups'
// import NoShows from './opd/NoShows'


import IpMasters from './ipd/Masters'
import Admissions from './ipd/Admissions'
import AdmissionDetail from './ipd/AdmissionDetail'
import TrackingAdmissions from './ipd/TrackingAdmissions'
import MyAdmissions from './ipd/MyAdmissions'
import DischargedList from './ipd/DischargedList'
import BedBoard from './ipd/Bedboard'

import { Toaster } from 'sonner'
// import Medicines from './pharmacy/Medicines'
// import Suppliers from './pharmacy/Suppliers'
// import Locations from './pharmacy/Locations'
// import Inventory from './pharmacy/Inventory'
// import Transactions from './pharmacy/Transactions'
// import PurchaseOrders from './pharmacy/PurchaseOrders'
// import GRN from './pharmacy/GRN'
// import Alerts from './pharmacy/Alerts'
// import Dispense from './pharmacy/Dispense'
// import Returns from './pharmacy/Returns'
// import Prescriptions from './pharmacy/Prescriptions'
// import Pharmacy from './pharmacy/Pharmacy'
// import CreatePrescription from './pharmacy/CreatePrescription'

import LabOrders from './lab/Orders'
import LabOrderDetail from './lab/OrderDetail'
import LabMasters from './lab/Masters'
import RisOrders from './ris/Orders'
import RisMasters from './ris/Masters'
import RisOrderDetail from './ris/OrderDetail'
import OtOrders from './ot/Orders'
import OtOrderDetail from './ot/OrderDetail'
import OtMasters from './ot/Masters'
// import InvoiceList from './billing/InvoiceList'
import InvoiceDetail from './billing/InvoiceDetail'
import PatientEmrTimeline from './emr/PatientEmrTimeline'
import Templates from './pdftemplates/Templates'
import TemplateEditor from './pdftemplates/TemplateEditor'
import GenerateReport from './pdftemplates/GenerateReport'
import Consents from './pdftemplates/Consents'
import Dashboard from './pages/Dashboard'
import MIS from './pages/MIS'
import PatientPage from './patients/PatientPage'
import PatientMasters from './patients/PatientMasters'
// import BillingInvoicePage from './billing/BillingInvoicePage'
// import BillingListPage from './billing/BillingListPage'
import BillingConsole from './billing/BillingConsole'
import BrandingAndTemplates from './settings/BrandingAndTemplates'
import { BrandingProvider } from './branding/BrandingProvider'
import Schedules from './opd/Schedules'
import AppointmentBooking from './opd/Appointments'
import Queue from './opd/Queue'
import Triage from './opd/Triage'
import Visit from './opd/Visit'
// import Masters from './opd/Masters'
import Followups from './opd/Followups'
import NoShow from './opd/NoShows'
import OpdDashboard from './opd/Dashboard'
import InventoryPharmacy from './pages/InventoryPharmacy'
import MedicineQrLookup from './pharmacy/MedicineQrLookup'
import BarcodeLookup from './inventory/BarcodeLookup'
import PharmacyRxPage from './pharmacy/PharmacyRx'
import PharmacyRx from './pharmacy/PharmacyRx'
import PharmacyBilling from './pharmacy/PharmacyBilling'
import PharmacySales from './pharmacy/PharmacySales'
import PharmacyReturns from './pharmacy/PharmacyReturns'
import OpdPharmacyPrescriptionTab from './opd/OpdPharmacyPrescriptionTab'
import PharmacyRxExplorer from './pharmacy/PharmacyRxExplorer'
import OpdPharmacyOrder from './opd/OpdPharmacyPrescriptionTab'
import IpdPharmacyOrder from './pharmacy/IpdPharmacyOrder'
import PharmacyCounterOrder from './pharmacy/PharmacyCounterOrder'
import OtConsumableOrder from './pharmacy/OtConsumableOrder'
import PharmacyDispense from './pharmacy/PharmacyDispense'

export default function App() {
    return (
        <BrandingProvider>
            <>
                <Routes>
                    <Route path="/auth/login" element={<Login />} />
                    <Route path="/auth/register-admin" element={<RegisterAdmin />} />
                    <Route path="/auth/verify" element={<VerifyOtp />} />

                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/admin" element={<Dashboard />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/admin/roles" element={<Roles />} />
                            <Route path="/admin/permissions" element={<Permissions />} />
                            <Route path="/admin/users" element={<Users />} />
                            <Route path="/admin/departments" element={<Departments />} />

                            {/* patient management */}
                            <Route path="/patients" element={<PatientPage />} />

                            {/* OPD */}
                            <Route path="/opd/dashboard" element={<OpdDashboard />} />
                            <Route path="/opd/schedules" element={<Schedules />} />
                            <Route path="/opd/appointments" element={<AppointmentBooking />} />
                            <Route path="/opd/queue" element={<Queue />} />
                            <Route path="/opd/triage" element={<Triage />} />
                            <Route path="/opd/visit/:id" element={<Visit />} />
                            {/* <Route path="/opd/masters" element={<Masters />} /> */}
                            <Route path="/opd/followups" element={<Followups />} />
                            <Route path="/opd/no-shows" element={<NoShow />} />

                            {/* IPD */}
                            <Route path="/ipd/admissions" element={<Admissions />} />
                            <Route path="/ipd/admission/:id" element={<AdmissionDetail />} />
                            <Route path="/ipd/tracking" element={<TrackingAdmissions />} />
                            <Route path="/ipd/my" element={<MyAdmissions />} />
                            <Route path="/ipd/discharged" element={<DischargedList />} />
                            <Route path="/ipd/bedboard" element={<BedBoard />} />
                            <Route path="/ipd/masters" element={<IpMasters />} />

                            {/* pharmacy
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
                            <Route path="/pharmacy/prescriptions/new" element={<CreatePrescription />} />
                            <Route path="/pharmacy" element={<Pharmacy />} /> */}

                            {/* Lab / RIS / OT */}
                            <Route path="/lab/orders" element={<LabOrders />} />
                            <Route path="/lab/orders/:id" element={<LabOrderDetail />} />
                            <Route path="/lab/masters" element={<LabMasters />} />

                            <Route path="/ris/orders" element={<RisOrders />} />
                            <Route path="/ris/orders/:id" element={<RisOrderDetail />} />
                            <Route path="/ris/masters" element={<RisMasters />} />

                            <Route path="/ot/orders" element={<OtOrders />} />
                            <Route path="/ot/orders/:id" element={<OtOrderDetail />} />
                            <Route path="/ot/masters" element={<OtMasters />} />

                            {/* Billing */}
                            <Route path="/billing" element={<BillingConsole />} />
                            <Route path="/billing/invoices/:invoiceId" element={<InvoiceDetail />} />


                            {/* EMR */}
                            <Route path="/emr" element={<PatientEmrTimeline />} />

                            {/* Templates */}
                            <Route path="/templates" element={<Templates />} />
                            <Route path="/templates/new" element={<TemplateEditor mode="create" />} />
                            <Route path="/templates/:id/edit" element={<TemplateEditor mode="edit" />} />
                            <Route path="/templates/generate" element={<GenerateReport />} />
                            <Route path="/templates/consents" element={<Consents />} />

                            {/* Customization / Branding */}
                            <Route path="/settings/branding" element={<BrandingAndTemplates />} />

                            {/* MIS / Patient masters */}
                            <Route path="/mis" element={<MIS />} />
                            <Route path="/patients/masters" element={<PatientMasters />} />

                            <Route path="/pharmacy/inventory" element={<InventoryPharmacy />} />
                            <Route path="/pharmacy/qr-lookup" element={<MedicineQrLookup />} />
                            <Route path="/inventory/barcode-lookup" element={<BarcodeLookup />} />

                            <Route path="/pharmacy/rx" element={<PharmacyRx />} />
                            <Route path="/pharmacy/dispense" element={<PharmacyDispense />} />
                            <Route path="/pharmacy/billing" element={<PharmacyBilling />} />
                            <Route path="/pharmacy/sales" element={<PharmacySales />} />
                            <Route path="/pharmacy/returns" element={<PharmacyReturns />} />

                            <Route path="/opd/phramacy" element={<OpdPharmacyOrder />} />
                            <Route path="/ipd/phramacy" element={<IpdPharmacyOrder />} />
                            <Route path="/counter/phramacy" element={<PharmacyCounterOrder />} />
                            <Route path="/ot/phramacy" element={<OtConsumableOrder />} />
                            <Route path="/pharmacy/rx-explorer" element={<PharmacyRxExplorer />} />
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/auth/login" replace />} />
                </Routes>

                <Toaster position="top-right" richColors closeButton />
            </>
        </BrandingProvider>
    )
}
