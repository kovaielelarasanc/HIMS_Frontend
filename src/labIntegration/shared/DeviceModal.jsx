// src/labIntegration/shared/DeviceModal.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button, Input, Label, Modal, Select, Textarea } from "../_ui"

const PROTOCOLS = ["HL7_MLLP", "HL7_HTTP", "ASTM_HTTP", "RAW_HTTP", "MISPA_VIVA_HTTP"]

function parseIPs(s) {
    const v = (s || "").trim()
    if (!v) return null
    const ips = v.split(",").map((x) => x.trim()).filter(Boolean)
    return ips.length ? ips : null
}

export default function DeviceModal({ open, onClose, mode = "create", initial, tenantCode, onSubmit }) {
    const [name, setName] = useState("")
    const [protocol, setProtocol] = useState("HL7_MLLP")
    const [facility, setFacility] = useState("")
    const [enabled, setEnabled] = useState(true)
    const [ipsText, setIpsText] = useState("")

    useEffect(() => {
        if (!open) return
        setName(initial?.name || "")
        setProtocol(initial?.protocol || "HL7_MLLP")
        setFacility(initial?.sending_facility_code || "")
        setEnabled(initial?.enabled ?? true)
        setIpsText((initial?.allowed_remote_ips || []).join(", "))
    }, [open, initial])

    const canSave = useMemo(() => {
        const t = (tenantCode || initial?.tenant_code || "").trim()
        if (!t) return false
        if (!name.trim()) return false
        if (!facility.trim()) return false
        return true
    }, [name, facility, tenantCode, initial])

    async function save() {
        try {
            const tc = (tenantCode || initial?.tenant_code || "").trim().toUpperCase()
            if (!tc) return toast.error("Tenant Code required")
            if (!name.trim()) return toast.error("Name required")
            if (!facility.trim()) return toast.error("Sending Facility Code required")

            const body = {
                tenant_code: tc,
                name: name.trim(),
                protocol,
                sending_facility_code: facility.trim().toUpperCase(),
                enabled,
                allowed_remote_ips: parseIPs(ipsText),
            }
            await onSubmit?.(body)
            toast.success(mode === "create" ? "Device created" : "Device updated")
            onClose?.()
        } catch (e) {
            toast.error(e?.message || "Save failed")
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={mode === "create" ? "Add Device" : "Edit Device"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={save} disabled={!canSave}>Save</Button>
                </>
            }
        >
            <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                    <Label>Tenant Code</Label>
                    <Input value={(tenantCode || initial?.tenant_code || "").toUpperCase()} readOnly />
                </div>

                <div className="md:col-span-2">
                    <Label>Device Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Count X Plus (Analyzer 1)" />
                </div>

                <div>
                    <Label>Protocol</Label>
                    <Select value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                        {PROTOCOLS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </Select>
                </div>

                <div>
                    <Label>Sending Facility Code (device key)</Label>
                    <Input value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="e.g., SMC25_LIS_01" />
                </div>

                <div className="md:col-span-2">
                    <Label>Allowed Remote IPs (optional, comma separated)</Label>
                    <Textarea value={ipsText} onChange={(e) => setIpsText(e.target.value)} placeholder="10.0.0.10, 10.0.0.11" />
                    <div className="mt-1 text-[12px] text-slate-500">
                        If set, messages from other IPs will be rejected.
                    </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                    <input
                        id="enabled"
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor="enabled" className="text-[13px] text-slate-800">
                        Enabled
                    </label>
                </div>
            </div>
        </Modal>
    )
}
