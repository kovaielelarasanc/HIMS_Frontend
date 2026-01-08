// src/labIntegration/panels/DashboardPanel.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    Card,
    CardBody,
    CardHeader,
    StatTile,
    Badge,
    Button,
    Input,
    Label,
    Divider,
} from "../_ui"
import {
    isCanceledError,
    listIntegrationDevices,
    listIntegrationMessages,
    listIntegrationErrorQueue,
} from "@/api/labIntegration"

export default function DashboardPanel({ tenantCode }) {
    const [loading, setLoading] = useState(false)
    const [devices, setDevices] = useState([])
    const [recent, setRecent] = useState([])
    const [errors, setErrors] = useState([])

    const stats = useMemo(() => {
        const enabled = devices.filter((d) => d.enabled).length
        const down = devices.filter((d) => d.enabled && !d.last_seen_at).length
        const errorCount = errors.length
        const msgCount = recent.length
        return { enabled, down, errorCount, msgCount }
    }, [devices, recent, errors])

    async function load() {
        const ac = new AbortController()
        setLoading(true)
        try {
            const [d, m, e] = await Promise.all([
                listIntegrationDevices(tenantCode ? { tenant_code: tenantCode } : {}, ac.signal),
                listIntegrationMessages(tenantCode ? { tenant_code: tenantCode } : {}, ac.signal),
                listIntegrationErrorQueue(tenantCode ? { tenant_code: tenantCode } : {}, ac.signal),
            ])
            setDevices(Array.isArray(d) ? d : [])
            setRecent(Array.isArray(m) ? m.slice(0, 12) : [])
            setErrors(Array.isArray(e) ? e : [])
        } catch (err) {
            if (!isCanceledError(err)) toast.error(err?.message || "Failed to load dashboard")
        } finally {
            setLoading(false)
        }
        return () => ac.abort()
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantCode])

    return (
        <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-4">
                <StatTile
                    label="Enabled Devices"
                    value={loading ? "…" : stats.enabled}
                    hint="Active analyzer/LIS endpoints"
                    tone="ok"
                />
                <StatTile
                    label="Devices Not Seen"
                    value={loading ? "…" : stats.down}
                    hint="Never received any message"
                    tone={stats.down > 0 ? "warn" : "neutral"}
                />
                <StatTile
                    label="Error Queue"
                    value={loading ? "…" : stats.errorCount}
                    hint="Needs mapping or reprocess"
                    tone={stats.errorCount > 0 ? "bad" : "ok"}
                />
                <StatTile
                    label="Recent Messages"
                    value={loading ? "…" : stats.msgCount}
                    hint="Latest 12 in list"
                    tone="neutral"
                />
            </div>

            <Card>
                <CardHeader
                    title="Health Overview"
                    subtitle="Quick view of device heartbeat and recent integration activity"
                    right={
                        <Button variant="secondary" onClick={load} disabled={loading}>
                            Refresh
                        </Button>
                    }
                />
                <CardBody>
                    {devices.length === 0 ? (
                        <div className="text-[13px] text-black/65">
                            No devices found. Go to <b>Devices</b> tab and add a device.
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {devices.slice(0, 6).map((d) => (
                                <div
                                    key={d.id}
                                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="truncate text-[14px] font-semibold text-black">
                                                {d.name}
                                            </div>
                                            <div className="mt-1 text-[12.5px] text-black/60">
                                                {d.protocol} · Facility: <span className="text-black/80">{d.sending_facility_code}</span>
                                            </div>
                                        </div>
                                        <Badge tone={d.enabled ? "ok" : "neutral"}>{d.enabled ? "Enabled" : "Disabled"}</Badge>
                                    </div>
                                    <Divider />
                                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-black/70">
                                        <span className="rounded-full bg-white/10 px-2.5 py-1">
                                            Last seen: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "—"}
                                        </span>
                                        {d.last_error ? (
                                            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-200">
                                                Last error: {String(d.last_error).slice(0, 64)}
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                                                No recent errors
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Divider />

                    <div className="text-[13px] text-black/60">
                        Tip: For HL7 MLLP, ensure port <b>2575</b> is open only to LIS/middleware network. For ASTM HTTP ingest,
                        middleware must send <b>X-Integration-Token</b>.
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
