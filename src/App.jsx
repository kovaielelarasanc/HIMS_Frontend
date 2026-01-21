// frontend/src/App.jsx
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { refreshAccessToken } from "./api/client";

import Login from "./pages/auth/Login";
import RegisterAdmin from "./pages/auth/RegisterAdmin";
import VerifyOtp from "./pages/auth/VerifyOtp";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import ProviderRoute from "./routes/ProviderRoute";

import Roles from "./pages/admin/Roles";
import Users from "./pages/admin/Users";
import Permissions from "./pages/admin/Permissions";
import Departments from "./pages/admin/Departments";

import IpMasters from "./ipd/Masters";
import Admissions from "./ipd/Admissions";
import AdmissionDetail from "./ipd/AdmissionDetail";
import TrackingAdmissions from "./ipd/TrackingAdmissions";
import MyAdmissions from "./ipd/MyAdmissions";
import DischargedList from "./ipd/DischargedList";
import BedBoard from "./ipd/Bedboard";

import LabOrderDetail from "./lab/OrderDetail";
import LabMasters from "./lab/Masters";
import OrdersList from "./lab/Orders";
// import LisMasters from "./lab/LisMasters";
import LabReportPrint from "./lab/LabReportPrint";

import RisOrders from "./ris/Orders";
import RisMasters from "./ris/Masters";
import RisOrderDetail from "./ris/OrderDetail";

import OtTheatreSchedulePage from "./ot/OtTheatreSchedulePage";
import OtMastersPage from "./ot/OtMastersPage";
import OtCaseDetailPage from "./ot/OtCaseDetailPage";
// import OtLogsAdmin from "./ot/OtLogsAdmin";



// import InvoiceDetail from "./billing/InvoiceDetail";
// import BillingConsole from "./billing/BillingConsole";
// import Advances from "./billing/AdvanceDeposit";

// import PatientEmrTimeline from "./emr/PatientEmrTimeline";

import Templates from "./pdftemplates/Templates";
import TemplateEditor from "./pdftemplates/TemplateEditor";
import GenerateReport from "./pdftemplates/GenerateReport";
import Consents from "./pdftemplates/Consents";

import Dashboard from "./pages/Dashboard";
import MIS from "./pages/MIS";

import PatientPage from "./patients/PatientPage";
import PatientMasters from "./patients/PatientMasters";

import BrandingAndTemplates from "./settings/BrandingAndTemplates";
import { BrandingProvider } from "./branding/BrandingProvider";

import Schedules from "./opd/Schedules";
import AppointmentBooking from "./opd/Appointments";
import Queue from "./opd/Queue";
import Triage from "./opd/Triage";
import Visit from "./opd/Visit";
import Followups from "./opd/Followups";
import NoShow from "./opd/NoShows";
import OpdDashboard from "./opd/Dashboard";
import DoctorFees from "./opd/DoctorFees";

import InventoryPharmacy from "./pages/InventoryPharmacy";
import MedicineQrLookup from "./pharmacy/MedicineQrLookup";
import BarcodeLookup from "./inventory/BarcodeLookup";
import PharmacyRx from "./pharmacy/PharmacyRx";
import PharmacyBilling from "./pharmacy/PharmacyBilling";
import PharmacySales from "./pharmacy/PharmacySales";
import PharmacyReturns from "./pharmacy/PharmacyReturns";
import PharmacyDispense from "./pharmacy/PharmacyDispense";
import PharmacyRxExplorer from "./pharmacy/PharmacyRxExplorer";
import IpdPharmacyOrder from "./pharmacy/IpdPharmacyOrder";
import PharmacyCounterOrder from "./pharmacy/PharmacyCounterOrder";
import OtConsumableOrder from "./pharmacy/OtConsumableOrder";
import OpdPharmacyOrder from "./opd/OpdPharmacyPrescriptionTab";

import SupplierLedger from "./pharmacy/accounts/SupplierLedger";
import SupplierMonthlySummary from "./pharmacy/accounts/SupplierMonthlySummary";
import SupplierPaymentAdvanced from "./pharmacy/accounts/SupplierPaymentAdvanced";
import SupplierPayments from "./pharmacy/accounts/SupplierPayments";

import MigrationsConsole from "./pages/master/MigrationsConsole";

import { Toaster } from "sonner";
import EmrPage from "./pages/emr/Emr";
import EmrConsole from "./pages/emr/EmrConsole";
import AdmissionsDashboard from "./ipd/AdmissionsDashboard";
import StockAlertsDashboard from "./pages/inventoryPharmacy/StockAlertsTab";
import LabIntegrationPage from "./labIntegration/LabIntegrationPage";

import BillingRoutes from "./billing/BillingRoutes";
import BillingCaseDetail from "./billing/BillingCaseDetail";
import InvoiceEditor from "./billing/InvoiceEditor";
import BillingDashboard from "./billing/BillingDashboard";
import BillingAddItem from "./billing/BillingAddItem";
import ChargeMaster from "./billing/ChargeMaster";
import InventoryCommonStockPage from "./pages/inventory/InventoryCommonStockPage";
import WardPatientUsagePage from "./components/quickorders/WardPatientUsagePage";
import InventoryIndentsPage from "./pages/inventory/InventoryIndentsPage";
import InventoryIssuesPage from "./pages/inventory/InventoryIssuesPage";
import LisMasters from "./lab/LisMasters";
import BillingRevenueDashboard from "./billing/BillingRevenueDashboard";
import EmrPatientChart from "./emr/new/EmrPatientChart";
import EmrTemplateLibrary from "./emr/new/EmrTemplateLibrary";
import EmrRecordsInbox from "./emr/new/EmrRecordsInbox";
import EmrExportRelease from "./emr/new/EmrExportRelease";


export default function App() {
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 29 * 60 * 1000;

    const tick = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      try {
        await refreshAccessToken();
      } catch (err) {
        console.error("Auto token refresh failed", err);
      }
    };

    tick();
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Routes>
        {/* Auth */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register-admin" element={<RegisterAdmin />} />
        <Route path="/auth/verify" element={<VerifyOtp />} />

        {/* Protected */}
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

            {/* Patient */}
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
            <Route path="/ipd/dashboard" element={<AdmissionsDashboard />} />
            <Route path="/ipd/admissions" element={<Admissions />} />
            <Route path="/ipd/admission/:id" element={<AdmissionDetail />} />
            <Route path="/ipd/tracking" element={<TrackingAdmissions />} />
            <Route path="/ipd/my" element={<MyAdmissions />} />
            <Route path="/ipd/discharged" element={<DischargedList />} />
            <Route path="/ipd/bedboard" element={<BedBoard />} />
            <Route path="/ipd/masters" element={<IpMasters />} />


            {/* Lab */}
            <Route path="/lab/orders" element={<OrdersList />} />
            <Route path="/lab/orders/:id" element={<LabOrderDetail />} />
            <Route path="/lab/masters" element={<LabMasters />} />
            <Route path="/lab/service/masters" element={<LisMasters />} />
            <Route path="/lab/orders/:id/print" element={<LabReportPrint />} />
            <Route path="/lab/integration" element={<LabIntegrationPage />} />



            {/* RIS */}
            <Route path="/ris/orders" element={<RisOrders />} />
            <Route path="/ris/orders/:id" element={<RisOrderDetail />} />
            <Route path="/ris/masters" element={<RisMasters />} />

            {/* OT */}
            <Route path="/ot/schedule" element={<OtTheatreSchedulePage />} />
            <Route path="/ot/masters" element={<OtMastersPage />} />
            <Route path="/ot/cases/:caseId" element={<OtCaseDetailPage />} />
            {/* <Route path="/ot/logs" element={<OtLogsAdmin />} /> */}

            {/* Billing */}
            {/* <Route path="/billing" element={<BillingConsole />} />
            <Route path="/billing/invoices/:invoiceId" element={<InvoiceDetail />} />
            <Route path="/billing/advance" element={<Advances />} /> */}

            {/* EMR */}
            <Route path="/emr" element={<EmrConsole />} />
            <Route path="/emr/chart" element={<EmrPatientChart />} />
            <Route path="/emr/templates" element={<EmrTemplateLibrary />} />
            <Route path="/emr/record/inbox" element={<EmrRecordsInbox />} />
            <Route path="/emr/export/release" element={<EmrExportRelease />} />

            {/* Templates */}
            <Route path="/templates" element={<Templates />} />
            <Route path="/templates/new" element={<TemplateEditor mode="create" />} />
            <Route path="/templates/:id/edit" element={<TemplateEditor mode="edit" />} />
            <Route path="/templates/generate" element={<GenerateReport />} />
            <Route path="/templates/consents" element={<Consents />} />

            {/* Branding */}
            <Route path="/settings/branding" element={<BrandingAndTemplates />} />

            {/* ✅ Provider-only */}
            <Route element={<ProviderRoute reqAny={["master.migrations.view"]} />}>
              <Route path="/master/migrations" element={<MigrationsConsole />} />
            </Route>

            {/* MIS */}
            <Route path="/mis" element={<MIS />} />

            {/* Pharmacy / Inventory */}
            <Route path="/pharmacy/inventory" element={<InventoryPharmacy />} />
            <Route path="/pharmacy/qr-lookup" element={<MedicineQrLookup />} />
            <Route path="/pharmacy/inventory/barcode-lookup" element={<BarcodeLookup />} />

            <Route path="/pharmacy/rx" element={<PharmacyRx />} />
            <Route path="/pharmacy/dispense" element={<PharmacyDispense />} />
            <Route path="/pharmacy/billing" element={<PharmacyBilling />} />
            <Route path="/pharmacy/sales" element={<PharmacySales />} />
            <Route path="/pharmacy/returns" element={<PharmacyReturns />} />
            <Route path="/pharmacy/rx-explorer" element={<PharmacyRxExplorer />} />
            <Route path="/pharmacy/stock/alerts" element={<StockAlertsDashboard />} />
            <Route path="/inventory/indents" element={<InventoryIndentsPage />} />
            <Route path="/inventory/indents/issue" element={<InventoryIssuesPage />} />
            <Route path="/inventory/common/stock" element={<InventoryCommonStockPage />} />
            <Route path="/opd/phramacy" element={<OpdPharmacyOrder />} />
            <Route path="/ipd/phramacy" element={<IpdPharmacyOrder />} />
            <Route path="/counter/phramacy" element={<PharmacyCounterOrder />} />
            <Route path="/ot/phramacy" element={<OtConsumableOrder />} />

            <Route path="/pharmacy/accounts/supplier-ledger" element={<SupplierLedger />} />
            <Route path="/pharmacy/accounts/supplier-monthly-summary" element={<SupplierMonthlySummary />} />
            <Route path="/pharmacy/accounts/supplier-payments" element={<SupplierPaymentAdvanced />} />
            <Route path="/pharmacy/accounts/supplier-statement" element={<SupplierPayments />} />

            {/* <Route path="/billing/dashboard" element={<BillingDashboard />} />
            <Route path="/billing/cases" element={<BillingCasesList />} />
            <Route path="/billing/cases/:caseId" element={<BillingCaseDetail />} />
            <Route path="/billing/cases/:caseId/invoices/:invoiceId" element={<InvoiceDetail />} /> */}
            <Route path="/billing/revenue-dashboard" element={<BillingRevenueDashboard />} />
            <Route path="/billing/*" element={<BillingRoutes />} />
            <Route path="/billing/dashboard" element={<BillingDashboard />} />
            <Route path="/billing/cases/:caseId" element={<BillingCaseDetail />} />
            <Route path="/billing/invoices/:invoiceId" element={<InvoiceEditor />} />
            <Route path="/billing/cases/:caseId/add-item" element={<BillingAddItem />} />

            <Route path="/masters/charge-master" element={<ChargeMaster />} />
            <Route path="*" element={<Navigate to="/billing" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>

      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
