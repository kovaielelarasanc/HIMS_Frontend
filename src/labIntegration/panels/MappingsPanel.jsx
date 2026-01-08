// src/labIntegration/panels/MappingsPanel.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCcw, Trash2 } from "lucide-react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Label, Select, Table } from "../_ui"
import {
    listIntegrationDevices,
    listIntegrationMappings,
    createIntegrationMapping,
    deleteIntegrationMapping,
    isCanceledError,
} from "@/api/labIntegration"
import MappingModal from "../shared/MappingModal"

export default function MappingsPanel({ tenantCode }) {
    const [loading, setLoading] = useState(false)
    const [devices, setDevices] = useState([])
    const [deviceId, setDeviceId] = useState("")
    const [rows, setRows] = useState([])
    const [q, setQ] = useState("")
    const [open, setOpen] = useState(false)

    async function loadDevices() {
        const ac = new AbortController()
        try {
            const params = tenantCode ? { tenant_code: tenantCode } : {}
            const data = await listIntegrationDevices(params, ac.signal)
            setDevices(Array.isArray(data) ? data : [])
            if (!deviceId && data?.[0]?.id) setDeviceId(String(data[0].id))
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load devices")
        }
        return () => ac.abort()
    }

    async function loadMappings(id) {
        if (!tenantCode) return
        if (!id) return setRows([])
        const ac = new AbortController()
        setLoading(true)
        try {
            const data = await listIntegrationMappings({ tenant_code: tenantCode, source_device_id: Number(id) }, ac.signal)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load mappings")
        } finally {
            setLoading(false)
        }
        return () => ac.abort()
    }

    useEffect(() => { loadDevices() }, [tenantCode]) // eslint-disable-line
    useEffect(() => { loadMappings(deviceId) }, [tenantCode, deviceId]) // eslint-disable-line

    const filtered = useMemo(() => {
        const s = (q || "").trim().toLowerCase()
        if (!s) return rows
        return rows.filter((r) => (`${r.external_code} ${r.internal_test_id}`.toLowerCase()).includes(s))
    }, [rows, q])

    const curDevice = useMemo(() => devices.find((d) => String(d.id) === String(deviceId)), [devices, deviceId])

    async function addMapping(body) {
        await createIntegrationMapping(body)
        await loadMappings(deviceId)
    }
    async function del(id) {
        if (!confirm("Deactivate this mapping?")) return
        await deleteIntegrationMapping(id)
        toast.success("Mapping deactivated")
        await loadMappings(deviceId)
    }

    return (
        <Card>
            <CardHeader
                title="Mappings"
                subtitle="Map external test codes (OBX-3 / ASTM) to your internal Test Master ID"
                right={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => loadMappings(deviceId)} disabled={loading}>
                            <RefreshCcw size={16} /> Refresh
                        </Button>
                        <Button onClick={() => { if (!tenantCode) return toast.error("Set tenant first"); if (!deviceId) return toast.error("Select device"); setOpen(true) }}>
                            <Plus size={16} /> Add Mapping
                        </Button>
                    </div>
                }
            />
            <CardBody>
                <div className="grid gap-3 md:grid-cols-3">
                    <div>
                        <Label>Device</Label>
                        <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                            <option value="">Select…</option>
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    #{d.id} · {d.name} · {d.protocol}
                                </option>
                            ))}
                        </Select>
                        {curDevice ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge tone="info">{curDevice.protocol}</Badge>
                                <Badge tone="neutral">{curDevice.sending_facility_code}</Badge>
                            </div>
                        ) : null}
                    </div>

                    <div className="md:col-span-2">
                        <Label>Search</Label>
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="external code / internal id…" />
                    </div>
                </div>

                <div className="mt-4">
                    {filtered.length === 0 ? (
                        <EmptyState title="No mappings" subtitle="Create mappings to avoid ‘Unmapped test codes’ errors." />
                    ) : (
                        <Table
                            rowKey={(r) => r.id}
                            columns={[
                                { key: "external_code", title: "External Code", render: (r) => <span className="font-medium">{r.external_code}</span> },
                                { key: "internal_test_id", title: "Internal Test ID", render: (r) => <span>{r.internal_test_id}</span> },
                                { key: "active", title: "Status", render: (r) => <Badge tone={r.active ? "ok" : "warn"}>{r.active ? "Active" : "Inactive"}</Badge> },
                                {
                                    key: "actions",
                                    title: "",
                                    render: (r) => (
                                        <div className="flex justify-end">
                                            <Button variant="secondary" size="sm" onClick={() => del(r.id)}>
                                                <Trash2 size={16} /> Remove
                                            </Button>
                                        </div>
                                    ),
                                },
                            ]}
                            rows={filtered}
                        />
                    )}
                </div>

                <MappingModal
                    open={open}
                    onClose={() => setOpen(false)}
                    tenantCode={tenantCode}
                    deviceId={deviceId ? Number(deviceId) : null}
                    onSubmit={addMapping}
                />
            </CardBody>
        </Card>
    )
}
