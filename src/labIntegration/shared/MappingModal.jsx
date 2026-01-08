// src/labIntegration/shared/MappingModal.jsx
import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { Button, Input, Label, Modal } from "../_ui"

export default function MappingModal({ open, onClose, tenantCode, deviceId, onSubmit }) {
    const [externalCode, setExternalCode] = useState("")
    const [internalTestId, setInternalTestId] = useState("")

    useEffect(() => {
        if (!open) return
        setExternalCode("")
        setInternalTestId("")
    }, [open])

    const canSave = useMemo(() => {
        if (!tenantCode) return false
        if (!deviceId) return false
        if (!externalCode.trim()) return false
        if (!String(internalTestId).trim()) return false
        if (Number(internalTestId) <= 0) return false
        return true
    }, [tenantCode, deviceId, externalCode, internalTestId])

    async function save() {
        try {
            const body = {
                tenant_code: tenantCode,
                source_device_id: deviceId,
                external_code: externalCode.trim(),
                internal_test_id: Number(internalTestId),
            }
            await onSubmit?.(body)
            toast.success("Mapping created")
            onClose?.()
        } catch (e) {
            toast.error(e?.message || "Save failed")
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add Mapping"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={save} disabled={!canSave}>Save</Button>
                </>
            }
        >
            <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                    <Label>External Code (OBX-3 / ASTM test code)</Label>
                    <Input value={externalCode} onChange={(e) => setExternalCode(e.target.value)} placeholder="e.g., WBC" />
                </div>
                <div className="md:col-span-2">
                    <Label>Internal Test ID (your HMIS test master id)</Label>
                    <Input value={internalTestId} onChange={(e) => setInternalTestId(e.target.value)} placeholder="e.g., 1201" />
                </div>
            </div>
        </Modal>
    )
}
