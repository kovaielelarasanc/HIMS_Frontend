// src/labIntegration/panels/MessagesPanel.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Eye, RefreshCcw } from "lucide-react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Label, Select, Table } from "../_ui"
import { listIntegrationDevices, listIntegrationMessages, isCanceledError } from "@/api/labIntegration"
import MessageDetailDrawer from "../shared/MessageDetailDrawer"

const STATUSES = ["", "RECEIVED", "PARSED", "PROCESSED", "ERROR", "DUPLICATE"]

function tone(s) {
    if (s === "PROCESSED") return "ok"
    if (s === "ERROR") return "bad"
    if (s === "PARSED") return "info"
    if (s === "DUPLICATE") return "warn"
    return "neutral"
}

export default function MessagesPanel({ tenantCode }) {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [devices, setDevices] = useState([])
    const [deviceId, setDeviceId] = useState("")
    const [status, setStatus] = useState("")
    const [q, setQ] = useState("")
    const [openId, setOpenId] = useState(null)

    async function loadDevices() {
        const ac = new AbortController()
        try {
            const params = tenantCode ? { tenant_code: tenantCode } : {}
            const data = await listIntegrationDevices(params, ac.signal)
            setDevices(Array.isArray(data) ? data : [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load devices")
        }
        return () => ac.abort()
    }

    async function load() {
        const ac = new AbortController()
        setLoading(true)
        try {
            const params = {}
            if (tenantCode) params.tenant_code = tenantCode
            if (deviceId) params.device_id = Number(deviceId)
            if (status) params.status = status
            const data = await listIntegrationMessages(params, ac.signal)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load messages")
        } finally {
            setLoading(false)
        }
        return () => ac.abort()
    }

    useEffect(() => { loadDevices() }, [tenantCode]) // eslint-disable-line
    useEffect(() => { load() }, [tenantCode, deviceId, status]) // eslint-disable-line

    const filtered = useMemo(() => {
        const s = (q || "").trim().toLowerCase()
        if (!s) return rows
        return rows.filter((r) => (`${r.id} ${r.message_control_id || ""} ${r.error_reason || ""}`.toLowerCase()).includes(s))
    }, [rows, q])

    return (
        <Card>
            <CardHeader
                title="Messages"
                subtitle="Last 200 inbound messages (HL7/ASTM/vendor). Use View to inspect raw payload."
                right={
                    <Button variant="secondary" onClick={load} disabled={loading}>
                        <RefreshCcw size={16} /> Refresh
                    </Button>
                }
            />
            <CardBody>
                <div className="grid gap-3 md:grid-cols-4">
                    <div>
                        <Label>Device</Label>
                        <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                            <option value="">All</option>
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    #{d.id} · {d.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>{s || "All"}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Label>Search</Label>
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="control id, error text…" />
                    </div>
                </div>

                <div className="mt-4">
                    {filtered.length === 0 ? (
                        <EmptyState title="No messages" subtitle="When devices start sending, messages will appear here." />
                    ) : (
                        <Table
                            rowKey={(r) => r.id}
                            columns={[
                                { key: "id", title: "ID", render: (r) => <span className="text-slate-900">{r.id}</span> },
                                { key: "received_at", title: "Received", render: (r) => <span className="text-slate-600">{new Date(r.received_at).toLocaleString()}</span> },
                                { key: "protocol", title: "Protocol", render: (r) => <Badge tone="info">{r.protocol}</Badge> },
                                { key: "parse_status", title: "Status", render: (r) => <Badge tone={tone(r.parse_status)}>{r.parse_status}</Badge> },
                                { key: "message_control_id", title: "Control ID", render: (r) => <span className="text-slate-700">{r.message_control_id || "—"}</span> },
                                {
                                    key: "actions",
                                    title: "",
                                    render: (r) => (
                                        <div className="flex justify-end gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setOpenId(r.id)}>
                                                <Eye size={16} /> View
                                            </Button>
                                        </div>
                                    ),
                                },
                            ]}
                            rows={filtered}
                        />
                    )}
                </div>

                <MessageDetailDrawer open={!!openId} messageId={openId} onClose={() => setOpenId(null)} onChanged={load} />
            </CardBody>
        </Card>
    )
}
