// FILE: src/emr/PatientEmrPage.jsx
import PatientBillingTab from "@/emr/PatientBillingTab";

// ...inside your component
<Tabs defaultValue="overview" className="space-y-4">
    <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="visits">Visits</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        {/* NEW */}
        <TabsTrigger value="billing">Billing</TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
        {/* your overview UI */}
    </TabsContent>

    <TabsContent value="visits">
        {/* your visits UI */}
    </TabsContent>

    <TabsContent value="documents">
        {/* your docs UI */}
    </TabsContent>

    {/* NEW: Billing tab */}
    <TabsContent value="billing">
        <PatientBillingTab patientId={patientId} />
    </TabsContent>
</Tabs>
