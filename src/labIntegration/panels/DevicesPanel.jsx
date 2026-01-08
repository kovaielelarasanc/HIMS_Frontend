// src/labIntegration/panels/DevicesPanel.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCcw, Pencil } from "lucide-react"
import { Card, CardBody, CardHeader, EmptyState, Input, Label, Table, Button, Badge } from "../_ui"
import { createIntegrationDevice, listIntegrationDevices, updateIntegrationDevice, isCanceledError } from "@/api/labIntegration"
import DeviceModal from "../shared/DeviceModal"

export default function DevicesPanel({ tenantCode }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)

  async function load() {
    const ac = new AbortController()
    setLoading(true)
    try {
      const params = tenantCode ? { tenant_code: tenantCode } : {}
      const data = await listIntegrationDevices(params, ac.signal)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (!isCanceledError(e)) toast.error(e?.message || "Failed to load devices")
    } finally {
      setLoading(false)
    }
    return () => ac.abort()
  }

  useEffect(() => { load() }, [tenantCode]) // eslint-disable-line

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => (`${r.name} ${r.protocol} ${r.sending_facility_code}`.toLowerCase()).includes(s))
  }, [rows, q])

  function toneEnabled(v) { return v ? "ok" : "warn" }

  async function onCreate(body) {
    await createIntegrationDevice(body)
    await load()
  }
  async function onUpdate(body) {
    if (!edit?.id) return
    await updateIntegrationDevice(edit.id, body)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="Devices"
        subtitle="Configure analyzer/LIS endpoints and routing via Sending Facility Code"
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              <RefreshCcw size={16} /> Refresh
            </Button>
            <Button onClick={() => { if (!tenantCode) return toast.error("Set tenant code first"); setEdit(null); setOpen(true) }}>
              <Plus size={16} /> Add Device
            </Button>
          </div>
        }
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, protocol, facility code…" />
          </div>
          <div>
            <Label>Tenant Filter</Label>
            <Input value={tenantCode || ""} readOnly placeholder="Set tenant above" />
          </div>
        </div>

        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              title="No devices"
              subtitle="Add your first device to start routing HL7/ASTM/vendor results."
              action={
                <Button onClick={() => { if (!tenantCode) return toast.error("Set tenant code first"); setEdit(null); setOpen(true) }}>
                  <Plus size={16} /> Add Device
                </Button>
              }
            />
          ) : (
            <Table
              rowKey={(r) => r.id}
              columns={[
                { key: "id", title: "ID", render: (r) => <span className="text-slate-900">{r.id}</span> },
                { key: "name", title: "Name", render: (r) => <div className="font-medium text-slate-900">{r.name}</div> },
                { key: "protocol", title: "Protocol", render: (r) => <Badge tone="info">{r.protocol}</Badge> },
                { key: "sending_facility_code", title: "Facility Code", render: (r) => <span className="text-slate-800">{r.sending_facility_code}</span> },
                { key: "enabled", title: "Status", render: (r) => <Badge tone={toneEnabled(r.enabled)}>{r.enabled ? "Enabled" : "Disabled"}</Badge> },
                {
                  key: "actions",
                  title: "",
                  render: (r) => (
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" onClick={() => { setEdit(r); setOpen(true) }}>
                        <Pencil size={16} /> Edit
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={filtered}
            />
          )}
        </div>

        <DeviceModal
          open={open}
          onClose={() => setOpen(false)}
          mode={edit ? "edit" : "create"}
          initial={edit}
          tenantCode={tenantCode}
          onSubmit={edit ? onUpdate : onCreate}
        />
      </CardBody>
    </Card>
  )
}
