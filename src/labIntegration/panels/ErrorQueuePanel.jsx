// src/labIntegration/panels/ErrorQueuePanel.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Eye, RefreshCcw, RotateCcw } from "lucide-react"

import { Badge, Button, Card, CardBody, CardHeader, Divider, EmptyState, Input, Label, Table } from "../_ui"
import { isCanceledError, listIntegrationErrorQueue, reprocessIntegrationMessage } from "@/api/labIntegration"
import MessageDetailDrawer from "../shared/MessageDetailDrawer"

export default function ErrorQueuePanel({ tenantCode }) {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [q, setQ] = useState("")
    const [openId, setOpenId] = useState(null)
    const [reprocessingId, setReprocessingId] = useState(null)

    async function load() {
        const ac = new AbortController()
        setLoading(true)
        try {
            const params = tenantCode ? { tenant_code: tenantCode } : {}
            const data = await listIntegrationErrorQueue(params, ac.signal)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load error queue")
        } finally {
            setLoading(false)
        }
        return () => ac.abort()
    }

    useEffect(() => { load() }, [tenantCode]) // eslint-disable-line

    const filtered = useMemo(() => {
        const s = (q || "").trim().toLowerCase()
        if (!s) return rows
        return rows.filter((r) => (`${r.id} ${r.error_reason || ""} ${r.message_control_id || ""}`.toLowerCase()).includes(s))
    }, [rows, q])

    function toneForError(reason) {
        const r = String(reason || "").toLowerCase()
        if (r.includes("unmapped")) return "warn"
        if (r.includes("invalid")) return "bad"
        return "bad"
    }

    async function reprocess(id) {
        setReprocessingId(id)
        try {
            await reprocessIntegrationMessage(id)
            toast.success("Reprocess completed")
            load()
        } catch (e) {
            toast.error(e?.message || "Reprocess failed")
        } finally {
            setReprocessingId(null)
        }
    }

    return (
        <Card>
            <CardHeader
                title="Error Queue"
                subtitle="Fix mappings/config → reprocess. Most errors are unmapped external codes."
                right={
                    <Button variant="secondary" onClick={load} disabled={loading}>
                        <RefreshCcw size={16} /> Refresh
                    </Button>
                }
            />
            <CardBody>
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <Label>Search</Label>
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="unmapped, control id, reason…" />
                    </div>
                    <div>
                        <Label>Tenant Filter</Label>
                        <Input value={tenantCode || ""} readOnly placeholder="Set tenant above" />
                    </div>
                </div>

                <Divider />

                {filtered.length === 0 ? (
                    <EmptyState title="No errors" subtitle="When mappings are correct, errors remain empty." />
                ) : (
                    <Table
                        rowKey={(r) => r.id}
                        columns={[
                            { key: "id", title: "Message ID", render: (r) => <span className="text-slate-900">{r.id}</span> },
                            { key: "received_at", title: "Received", render: (r) => <span className="text-slate-600">{new Date(r.received_at).toLocaleString()}</span> },
                            { key: "message_control_id", title: "Control ID", render: (r) => <span className="text-slate-700">{r.message_control_id || "—"}</span> },
                            {
                                key: "error_reason",
                                title: "Reason",
                                render: (r) => (
                                    <div className="flex flex-col gap-2">
                                        <Badge tone={toneForError(r.error_reason)}>{String(r.error_reason || "ERROR").slice(0, 28)}</Badge>
                                        <div className="text-[12.5px] text-slate-700">{String(r.error_reason || "—").slice(0, 160)}</div>
                                    </div>
                                ),
                            },
                            {
                                key: "actions",
                                title: "",
                                render: (r) => (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => setOpenId(r.id)}>
                                            <Eye size={16} /> View
                                        </Button>
                                        <Button size="sm" onClick={() => reprocess(r.id)} disabled={reprocessingId === r.id}>
                                            <RotateCcw size={16} />
                                            {reprocessingId === r.id ? "Reprocessing…" : "Reprocess"}
                                        </Button>
                                    </div>
                                ),
                            },
                        ]}
                        rows={filtered}
                    />
                )}

                <MessageDetailDrawer open={!!openId} messageId={openId} onClose={() => setOpenId(null)} onChanged={load} />
            </CardBody>
        </Card>
    )
}
