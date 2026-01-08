// src/labIntegration/LabIntegrationPage.jsx
import { useMemo, useState } from "react"
import { Input, Label, SegmentedTabs } from "./_ui"

import DashboardPanel from "./panels/DashboardPanel"
import DevicesPanel from "./panels/DevicesPanel"
import MappingsPanel from "./panels/MappingsPanel"
import MessagesPanel from "./panels/MessagesPanel"
import ErrorQueuePanel from "./panels/ErrorQueuePanel"

const TABS = [
    { value: "dashboard", label: "Dashboard" },
    { value: "devices", label: "Devices" },
    { value: "mappings", label: "Mappings" },
    { value: "messages", label: "Messages" },
    { value: "errors", label: "Error Queue" },
]

function getTenant() {
    return localStorage.getItem("lab_integration_tenant") || ""
}
function setTenant(v) {
    localStorage.setItem("lab_integration_tenant", v || "")
}

export default function LabIntegrationPage() {
    const [tab, setTab] = useState("dashboard")
    const [tenantCode, setTenantCode] = useState(getTenant())
    const tenant = useMemo(() => (tenantCode || "").trim().toUpperCase(), [tenantCode])

    return (
        <div className="min-h-[calc(100vh-40px)] w-full bg-slate-50 text-slate-900 p-4 md:p-6">
            <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.12)] p-5 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="text-[20px] font-semibold text-slate-900">Lab Integration</div>
                        <div className="mt-1 text-[13px] text-slate-600">
                            Universal HL7 / ASTM / Vendor monitor (light theme)
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        <div className="w-full md:w-[260px]">
                            <Label>Tenant Code</Label>
                            <Input
                                value={tenantCode}
                                onChange={(e) => setTenantCode(e.target.value)}
                                placeholder="e.g., SMC25"
                                onBlur={() => setTenant(tenant)}
                            />
                            <div className="mt-1 text-[12px] text-slate-500">
                                Saved locally. Use to filter devices/messages.
                            </div>
                        </div>

                        <div className="md:pb-[2px]">
                            <SegmentedTabs value={tab} onChange={setTab} tabs={TABS} />
                        </div>
                    </div>
                </div>

                <div className="mt-5">
                    {tab === "dashboard" ? <DashboardPanel tenantCode={tenant} /> : null}
                    {tab === "devices" ? <DevicesPanel tenantCode={tenant} /> : null}
                    {tab === "mappings" ? <MappingsPanel tenantCode={tenant} /> : null}
                    {tab === "messages" ? <MessagesPanel tenantCode={tenant} /> : null}
                    {tab === "errors" ? <ErrorQueuePanel tenantCode={tenant} /> : null}
                </div>
            </div>
        </div>
    )
}
