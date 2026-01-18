// FILE: src/billing/caseTabs/SettingsTab.jsx
import React, { useMemo } from "react"
import { RefreshCcw } from "lucide-react"
import { Button, Card, CardBody, CardHeader, Field, Select, Textarea, cn } from "../_ui"

export default function SettingsTab({
    loading,
    payerMeta,
    refMeta,
    value,
    onChange,
    onReloadMeta,
    onSave,
    saving,
}) {
    const payers = payerMeta?.payers || []
    const tpas = payerMeta?.tpas || []
    const plans = payerMeta?.credit_plans || []
    const referrers = refMeta?.items || []

    const filteredTpas = useMemo(() => {
        const pid = value.default_payer_id ? Number(value.default_payer_id) : null
        if (!pid) return tpas
        return tpas.filter((x) => !x.payer_id || Number(x.payer_id) === pid)
    }, [tpas, value.default_payer_id])

    const filteredPlans = useMemo(() => {
        const pid = value.default_payer_id ? Number(value.default_payer_id) : null
        const tid = value.default_tpa_id ? Number(value.default_tpa_id) : null
        return plans.filter((x) => {
            if (pid && x.payer_id && Number(x.payer_id) !== pid) return false
            if (tid && x.tpa_id && Number(x.tpa_id) !== tid) return false
            return true
        })
    }, [plans, value.default_payer_id, value.default_tpa_id])

    return (
        <Card>
            <CardHeader
                title="Bill Type & Referral"
                subtitle="Set default payer / TPA / credit plan + referral user"
                right={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onReloadMeta} disabled={loading}>
                            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                            Reload
                        </Button>
                        <Button onClick={onSave} disabled={loading || saving}>
                            {saving ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                }
            />
            <CardBody>
                {loading ? (
                    <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card className="border border-slate-100">
                            <CardHeader title="Bill Types" subtitle="Default payer for this case" />
                            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Payer Mode">
                                    <Select value={value.payer_mode} onChange={(e) => onChange({ ...value, payer_mode: e.target.value })}>
                                        {["SELF", "INSURANCE", "CORPORATE", "MIXED"].map((x) => (
                                            <option key={x} value={x}>{x}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Default Bill Type">
                                    <Select value={value.default_payer_type} onChange={(e) => onChange({ ...value, default_payer_type: e.target.value })}>
                                        <option value="">(none)</option>
                                        <option value="PATIENT">PATIENT</option>
                                        <option value="PAYER">PAYER</option>
                                        <option value="TPA">TPA</option>
                                        <option value="CREDIT_PLAN">CREDIT PLAN</option>
                                    </Select>
                                </Field>

                                <Field label="Payer (Master)">
                                    <Select
                                        value={value.default_payer_id}
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                default_payer_id: e.target.value,
                                                default_tpa_id: "",
                                                default_credit_plan_id: "",
                                            })
                                        }
                                    >
                                        <option value="">(optional)</option>
                                        {payers.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.payer_type})
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="TPA (Master)">
                                    <Select
                                        value={value.default_tpa_id}
                                        onChange={(e) => onChange({ ...value, default_tpa_id: e.target.value, default_credit_plan_id: "" })}
                                    >
                                        <option value="">(optional)</option>
                                        {filteredTpas.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Credit Plan (Master)">
                                    <Select value={value.default_credit_plan_id} onChange={(e) => onChange({ ...value, default_credit_plan_id: e.target.value })}>
                                        <option value="">(optional)</option>
                                        {filteredPlans.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                                    Tip: You can keep payer mode SELF but still set a payer/plan for internal reporting.
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border border-slate-100">
                            <CardHeader title="Referral" subtitle="Who referred this patient (for dashboards & reports)" />
                            <CardBody className="grid grid-cols-1 gap-3">
                                <Field label="Referral User">
                                    <Select value={value.referral_user_id} onChange={(e) => onChange({ ...value, referral_user_id: e.target.value })}>
                                        <option value="">(none)</option>
                                        {referrers.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Referral Notes (optional)">
                                    <Textarea
                                        placeholder="Ex: Referred by Dr. X for follow-up / admission..."
                                        value={value.referral_notes}
                                        onChange={(e) => onChange({ ...value, referral_notes: e.target.value })}
                                    />
                                </Field>
                            </CardBody>
                        </Card>
                    </div>
                )}
            </CardBody>
        </Card>
    )
}
