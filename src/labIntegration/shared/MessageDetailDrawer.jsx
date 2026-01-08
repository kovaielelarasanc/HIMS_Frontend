// src/labIntegration/shared/MessageDetailDrawer.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Copy, RotateCcw } from "lucide-react"
import { Badge, Button, Drawer, Divider } from "../_ui"
import { isCanceledError, readIntegrationMessage, reprocessIntegrationMessage } from "@/api/labIntegration"

function prettyJson(obj) {
    try { return JSON.stringify(obj, null, 2) } catch { return String(obj ?? "") }
}
function tone(s) {
    if (s === "PROCESSED") return "ok"
    if (s === "ERROR") return "bad"
    if (s === "PARSED") return "info"
    if (s === "DUPLICATE") return "warn"
    return "neutral"
}

export default function MessageDetailDrawer({ open, messageId, onClose, onChanged }) {
    const [loading, setLoading] = useState(false)
    const [row, setRow] = useState(null)
    const [doing, setDoing] = useState(false)

    async function load() {
        if (!messageId) return
        const ac = new AbortController()
        setLoading(true)
        try {
            const data = await readIntegrationMessage(messageId, ac.signal)
            setRow(data || null)
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load message")
        } finally {
            setLoading(false)
        }
        return () => ac.abort()
    }

    useEffect(() => { if (open) load() }, [open, messageId]) // eslint-disable-line

    const title = useMemo(() => row ? `Message #${row.id} · ${row.protocol} · ${row.parse_status}` : "Message", [row])

    async function copyText(txt) {
        try { await navigator.clipboard.writeText(String(txt || "")); toast.success("Copied") }
        catch { toast.error("Copy failed") }
    }

    async function reprocess() {
        if (!row?.id) return
        setDoing(true)
        try {
            await reprocessIntegrationMessage(row.id)
            toast.success("Reprocess completed")
            await load()
            onChanged?.()
        } catch (e) {
            toast.error(e?.message || "Reprocess failed")
        } finally {
            setDoing(false)
        }
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <Button onClick={reprocess} disabled={doing}>
                        <RotateCcw size={16} />
                        {doing ? "Reprocessing…" : "Reprocess"}
                    </Button>
                </>
            }
        >
            {loading || !row ? (
                <div className="text-[13px] text-slate-600">{loading ? "Loading…" : "No data"}</div>
            ) : (
                <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone(row.parse_status)}>{row.parse_status}</Badge>
                        <Badge tone="neutral">{row.protocol}</Badge>
                        {row.message_type ? <Badge tone="info">{row.message_type}</Badge> : null}
                        {row.message_control_id ? <Badge tone="neutral">Control: {row.message_control_id}</Badge> : null}
                    </div>

                    {row.error_reason ? (
                        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
                            <div className="font-semibold">Error</div>
                            <div className="mt-1">{row.error_reason}</div>
                        </div>
                    ) : null}

                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[13.5px] font-semibold text-slate-900">Parsed Summary</div>
                            <Button variant="secondary" size="sm" onClick={() => copyText(prettyJson(row.parsed_json))}>
                                <Copy size={16} /> Copy JSON
                            </Button>
                        </div>
                        <pre className="mt-3 overflow-auto rounded-2xl bg-slate-50 p-3 text-[12px] text-slate-800">
                            {prettyJson(row.parsed_json)}
                        </pre>
                    </div>

                    <Divider />

                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[13.5px] font-semibold text-slate-900">Raw Payload</div>
                            <Button variant="secondary" size="sm" onClick={() => copyText(row.raw_payload)}>
                                <Copy size={16} /> Copy Raw
                            </Button>
                        </div>
                        <pre className="mt-3 overflow-auto rounded-2xl bg-slate-50 p-3 text-[12px] text-slate-800 whitespace-pre-wrap">
                            {String(row.raw_payload || "")}
                        </pre>
                    </div>
                </div>
            )}
        </Drawer>
    )
}
