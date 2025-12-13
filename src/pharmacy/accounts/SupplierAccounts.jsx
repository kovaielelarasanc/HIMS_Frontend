import SupplierLedgerScreen from './SupplierLedgerScreen'
import SupplierPaymentsScreen from './SupplierPaymentsScreen'
import SupplierMonthlySummaryScreen from './SupplierMonthlySummaryScreen'
import SupplierStatementScreen from './SupplierStatementScreen'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SupplierAccounts() {
    return (
        <div className="p-4 space-y-4">
            <div>
                <h1 className="text-lg font-semibold text-slate-900">Pharmacy · Accounts</h1>
                <p className="text-xs text-slate-500">
                    Supplier ledger, pending invoices, payments, and monthly summary.
                </p>
            </div>

            <Tabs defaultValue="ledger" className="w-full">
                <TabsList className="w-full justify-start flex-wrap">
                    <TabsTrigger value="ledger">Supplier Ledger</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
                    <TabsTrigger value="statement">Supplier Statement</TabsTrigger>
                </TabsList>

                <TabsContent value="ledger"><SupplierLedgerScreen /></TabsContent>
                <TabsContent value="payments"><SupplierPaymentsScreen /></TabsContent>
                <TabsContent value="summary"><SupplierMonthlySummaryScreen /></TabsContent>
                <TabsContent value="statement"><SupplierStatementScreen /></TabsContent>
            </Tabs>
        </div>
    )
}
