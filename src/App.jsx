// frontend/src/App.jsx
import { useEffect } from 'react'
import { refreshAccessToken } from './api/client'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import RegisterAdmin from './pages/auth/RegisterAdmin'
import VerifyOtp from './pages/auth/VerifyOtp'
import AdminDashboard from './pages/dashboards/AdminDashboard'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Roles from './pages/admin/Roles'
import Users from './pages/admin/Users'
import Permissions from './pages/admin/Permissions'
import Departments from './pages/admin/Departments'

import IpMasters from './ipd/Masters'
import Admissions from './ipd/Admissions'
import AdmissionDetail from './ipd/AdmissionDetail'
import TrackingAdmissions from './ipd/TrackingAdmissions'
import MyAdmissions from './ipd/MyAdmissions'
import DischargedList from './ipd/DischargedList'
import BedBoard from './ipd/Bedboard'

import { Toaster } from 'sonner'


import LabOrderDetail from './lab/OrderDetail'
import LabMasters from './lab/Masters'
import RisOrders from './ris/Orders'
import RisMasters from './ris/Masters'
import RisOrderDetail from './ris/OrderDetail'


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

import BillingConsole from './billing/BillingConsole'
import BrandingAndTemplates from './settings/BrandingAndTemplates'
import { BrandingProvider } from './branding/BrandingProvider'

import Schedules from './opd/Schedules'
import AppointmentBooking from './opd/Appointments'
import Queue from './opd/Queue'
import Triage from './opd/Triage'
import Visit from './opd/Visit'

import Followups from './opd/Followups'
import NoShow from './opd/NoShows'
import OpdDashboard from './opd/Dashboard'

import InventoryPharmacy from './pages/InventoryPharmacy'
import MedicineQrLookup from './pharmacy/MedicineQrLookup'
import BarcodeLookup from './inventory/BarcodeLookup'
import PharmacyRx from './pharmacy/PharmacyRx'
import PharmacyBilling from './pharmacy/PharmacyBilling'
import PharmacySales from './pharmacy/PharmacySales'
import PharmacyReturns from './pharmacy/PharmacyReturns'
import PharmacyDispense from './pharmacy/PharmacyDispense'
import PharmacyRxExplorer from './pharmacy/PharmacyRxExplorer'
import IpdPharmacyOrder from './pharmacy/IpdPharmacyOrder'
import PharmacyCounterOrder from './pharmacy/PharmacyCounterOrder'
import OtConsumableOrder from './pharmacy/OtConsumableOrder'
import OpdPharmacyOrder from './opd/OpdPharmacyPrescriptionTab'
import DoctorFees from './opd/DoctorFees'
import LisMasters from './lab/LisMasters'
import LabReportPrint from './lab/LabReportPrint'
import OrdersList from './lab/Orders'
import OtTheatreSchedulePage from './ot/OtTheatreSchedulePage'
import OtMastersPage from './ot/OtMastersPage'
import OtCaseDetailPage from './ot/OtCaseDetailPage'

export default function App() {
    useEffect(() => {
        const REFRESH_INTERVAL_MS = 29 * 60 * 1000 // 29 minutes

        const tick = async () => {
            const token = localStorage.getItem('access_token')
            if (!token) return // not logged in, nothing to do
            try {
                await refreshAccessToken()
            } catch (err) {
                console.error('Auto token refresh failed', err)
                // we don't show toast here to avoid noise;
                // error is handled if any API actually fails
            }
        }

        // optional: try once on app load
        tick()

        const id = setInterval(tick, REFRESH_INTERVAL_MS)
        return () => clearInterval(id)
    }, [])
    return (
        <>
            <Routes>
                {/* Auth routes – NO BrandingProvider here */}
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/register-admin" element={<RegisterAdmin />} />
                <Route path="/auth/verify" element={<VerifyOtp />} />

                {/* Protected app – BrandingProvider only for the main app */}
                <Route element={<ProtectedRoute />}>
                    <Route
                        element={
                            <BrandingProvider>
                                <Layout />
                            </BrandingProvider>
                        }
                    >
                        {/* Dashboards */}
                        <Route path="/admin" element={<Dashboard />} />
                        <Route path="/dashboard" element={<Dashboard />} />

                        {/* Admin */}
                        <Route path="/admin/roles" element={<Roles />} />
                        <Route path="/admin/permissions" element={<Permissions />} />
                        <Route path="/admin/users" element={<Users />} />
                        <Route path="/admin/departments" element={<Departments />} />

                        {/* Patient management */}
                        <Route path="/patients" element={<PatientPage />} />
                        <Route path="/patients/masters" element={<PatientMasters />} />

                        {/* OPD */}
                        <Route path="/opd/dashboard" element={<OpdDashboard />} />
                        <Route path="/opd/schedules" element={<Schedules />} />
                        <Route path="/opd/appointments" element={<AppointmentBooking />} />
                        <Route path="/opd/queue" element={<Queue />} />
                        <Route path="/opd/triage" element={<Triage />} />
                        <Route path="/opd/visit/:id" element={<Visit />} />
                        <Route path="/opd/followups" element={<Followups />} />
                        <Route path="/opd/no-shows" element={<NoShow />} />
                        <Route path="/opd/doctor-fees" element={<DoctorFees />} />

                        {/* IPD */}
                        <Route path="/ipd/admissions" element={<Admissions />} />
                        <Route path="/ipd/admission/:id" element={<AdmissionDetail />} />
                        <Route path="/ipd/tracking" element={<TrackingAdmissions />} />
                        <Route path="/ipd/my" element={<MyAdmissions />} />
                        <Route path="/ipd/discharged" element={<DischargedList />} />
                        <Route path="/ipd/bedboard" element={<BedBoard />} />
                        <Route path="/ipd/masters" element={<IpMasters />} />

                        {/* Lab / RIS / OT */}
                        <Route path="/lab/orders" element={<OrdersList />} />
                        <Route path="/lab/orders/:id" element={<LabOrderDetail />} />
                        <Route path="/lab/masters" element={<LabMasters />} />
                        <Route path="/lab/service/masters" element={<LisMasters />} />
                        <Route path="/lab/orders/:id/print" element={<LabReportPrint  />} />

                        <Route path="/ris/orders" element={<RisOrders />} />
                        <Route path="/ris/orders/:id" element={<RisOrderDetail />} />
                        <Route path="/ris/masters" element={<RisMasters />} />


                        <Route path="/ot/schedule" element={<OtTheatreSchedulePage />} />
                        <Route path="/ot/masters" element={<OtMastersPage />} />
                        <Route path="/ot/cases/:caseId" element={<OtCaseDetailPage />} />

                        {/* Billing */}
                        <Route path="/billing" element={<BillingConsole />} />
                        <Route
                            path="/billing/invoices/:invoiceId"
                            element={<InvoiceDetail />}
                        />

                        {/* EMR */}
                        <Route path="/emr" element={<PatientEmrTimeline />} />

                        {/* Templates */}
                        <Route path="/templates" element={<Templates />} />
                        <Route
                            path="/templates/new"
                            element={<TemplateEditor mode="create" />}
                        />
                        <Route
                            path="/templates/:id/edit"
                            element={<TemplateEditor mode="edit" />}
                        />
                        <Route path="/templates/generate" element={<GenerateReport />} />
                        <Route path="/templates/consents" element={<Consents />} />

                        {/* Customization / Branding */}
                        <Route
                            path="/settings/branding"
                            element={<BrandingAndTemplates />}
                        />

                        {/* MIS */}
                        <Route path="/mis" element={<MIS />} />

                        {/* Pharmacy / Inventory */}
                        <Route
                            path="/pharmacy/inventory"
                            element={<InventoryPharmacy />}
                        />
                        <Route
                            path="/pharmacy/qr-lookup"
                            element={<MedicineQrLookup />}
                        />
                        <Route
                            path="/inventory/barcode-lookup"
                            element={<BarcodeLookup />}
                        />

                        <Route path="/pharmacy/rx" element={<PharmacyRx />} />
                        <Route path="/pharmacy/dispense" element={<PharmacyDispense />} />
                        <Route path="/pharmacy/billing" element={<PharmacyBilling />} />
                        <Route path="/pharmacy/sales" element={<PharmacySales />} />
                        <Route path="/pharmacy/returns" element={<PharmacyReturns />} />
                        <Route
                            path="/pharmacy/rx-explorer"
                            element={<PharmacyRxExplorer />}
                        />

                        <Route path="/opd/phramacy" element={<OpdPharmacyOrder />} />
                        <Route path="/ipd/phramacy" element={<IpdPharmacyOrder />} />
                        <Route
                            path="/counter/phramacy"
                            element={<PharmacyCounterOrder />}
                        />
                        <Route path="/ot/phramacy" element={<OtConsumableOrder />} />
                    </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/auth/login" replace />} />
            </Routes>

            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
