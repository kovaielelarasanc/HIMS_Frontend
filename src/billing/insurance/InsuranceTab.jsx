// FILE: frontend/src/billing/InsuranceTab.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import API from "@/api/client"
import { toast } from "sonner"
import {
  ShieldCheck,
  FileText,
  Split,
  RefreshCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  Wallet,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  insGet,
  insUpsert,
  insLines,
  insPatchLines,
  insSplit,
  preauthList,
  preauthCreate,
  preauthSubmit,
  preauthApprove,
  preauthPartial,
  preauthReject,
  claimList,
  claimCreate,
  claimSubmit,
  claimSettle,
  claimDeny,
  claimQuery,
  claimApprove,
} from "@/api/billingInsurance"

const CLEAR = "__CLEAR__" // ✅ Radix SelectItem value must NOT be empty string
const selectVal = (idStr) => (idStr ? String(idStr) : undefined)

const money = (v) => {
  const n = Number(v || 0)
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const STATUS_BADGE = (status) => {
  if (!status) return <Badge variant="secondary">—</Badge>
  const s = String(status).toUpperCase()
  if (s.includes("APPROV") || s.includes("SETT") || s.includes("PAID")) return <Badge className="bg-emerald-600 text-white">{s}</Badge>
  if (s.includes("REJECT") || s.includes("DENIED") || s.includes("VOID")) return <Badge className="bg-rose-600 text-white">{s}</Badge>
  if (s.includes("QUERY")) return <Badge className="bg-amber-600 text-white">{s}</Badge>
  if (s.includes("SUBMIT")) return <Badge className="bg-blue-600 text-white">{s}</Badge>
  return <Badge variant="outline">{s}</Badge>
}

const pickLabel = (o) => {
  if (!o) return "—"
  const name = o.name || o.display_name || o.title || o.legal_name || o.company_name || o.label
  const code = o.code || o.short_code || o.payer_code
  if (code && name) return `${name} (${code})`
  return name || code || `#${o.id}`
}
const pickKind = (o) => String(o?.kind || o?.type || o?.payer_kind || o?.payer_type || o?.category || "").toUpperCase()

function normalizeMeta(meta) {
  const payersRaw = meta?.payers || meta?.payer_list || meta?.items || meta?.data || meta?.insurers || []
  const tpasRaw = meta?.tpas || meta?.tpa_list || []
  const corporatesRaw = meta?.corporates || meta?.corporate_list || []

  const payers = Array.isArray(payersRaw) ? payersRaw : []
  const tpas = Array.isArray(tpasRaw) ? tpasRaw : []
  const corporates = Array.isArray(corporatesRaw) ? corporatesRaw : []

  const insurersDerived = payers.filter((p) => {
    const k = pickKind(p)
    return k.includes("INSUR") || k.includes("INSURANCE") || k.includes("PAYER")
  })

  const tpasDerived = tpas.length ? tpas : payers.filter((p) => pickKind(p).includes("TPA"))
  const corporatesDerived = corporates.length ? corporates : payers.filter((p) => pickKind(p).includes("CORP"))

  const safeList = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .filter((x) => x && x.id !== null && x.id !== undefined)

  return {
    insurers: safeList(insurersDerived.length ? insurersDerived : payers),
    tpas: safeList(tpasDerived),
    corporates: safeList(corporatesDerived),
    raw: meta || {},
  }
}

function suggestFromCase(caseInfo) {
  if (!caseInfo) return null
  const ct = String(caseInfo.default_payer_type || "").trim().toUpperCase()

  if (caseInfo.default_tpa_id) {
    return {
      payer_kind: "TPA",
      tpa_id: String(caseInfo.default_tpa_id),
      insurance_company_id:
        (ct === "PAYER" || ct === "INSURER" || ct === "INSURANCE") && caseInfo.default_payer_id
          ? String(caseInfo.default_payer_id)
          : "",
      corporate_id: "",
    }
  }

  if (ct === "CORPORATE" || ct === "CREDIT_PLAN") {
    return {
      payer_kind: "CORPORATE",
      corporate_id: caseInfo.default_payer_id ? String(caseInfo.default_payer_id) : "",
      insurance_company_id: "",
      tpa_id: "",
    }
  }

  if (caseInfo.default_payer_id) {
    return {
      payer_kind: "INSURANCE",
      insurance_company_id: String(caseInfo.default_payer_id),
      tpa_id: "",
      corporate_id: "",
    }
  }

  return null
}

export default function InsuranceTab({ caseId, canManage = true }) {
  const [loading, setLoading] = useState(true)

  const [caseInfo, setCaseInfo] = useState(null)
  const [meta, setMeta] = useState({ insurers: [], tpas: [], corporates: [], raw: {} })

  const [ins, setIns] = useState(null)
  const [lines, setLines] = useState([])
  const [preauths, setPreauths] = useState([])
  const [claims, setClaims] = useState([])

  // dialogs
  const [openIns, setOpenIns] = useState(false)
  const [openApproval, setOpenApproval] = useState(false) // preauth
  const [openClaim, setOpenClaim] = useState(false)

  // history toggles
  const [showApprovalHistory, setShowApprovalHistory] = useState(false)
  const [showClaimHistory, setShowClaimHistory] = useState(false)

  // drafts
  const [draftInsurerAmt, setDraftInsurerAmt] = useState({})

  // setup form
  const [insForm, setInsForm] = useState({
    payer_kind: "INSURANCE",
    insurance_company_id: "",
    tpa_id: "",
    corporate_id: "",
    policy_no: "",
    member_id: "",
    plan_name: "",
  })

  // follow-up forms
  const [approvalForm, setApprovalForm] = useState({ requested_amount: "", remarks: "" })
  const [claimForm, setClaimForm] = useState({ claim_amount: "", remarks: "" })

  const didInitDefaults = useRef(false)

  const byInvoice = useMemo(() => {
    const map = new Map()
    for (const r of lines) {
      const id = r?.invoice_id
      if (!id) continue
      if (!map.has(id)) map.set(id, { invoice_id: id, invoice_number: r.invoice_number, module: r.module, rows: [] })
      map.get(id).rows.push(r)
    }
    return Array.from(map.values())
  }, [lines])
  const insurerInvoiceIds = useMemo(() => {
    return byInvoice
      .filter(inv => String(inv.invoice_number || "").toUpperCase().startsWith("IINV"))
      .map(inv => Number(inv.invoice_id))
      .filter(Boolean)
  }, [byInvoice])

  const invoiceIdsFromLines = useMemo(() => {
    const s = new Set()
    for (const r of lines) if (r?.invoice_id) s.add(Number(r.invoice_id))
    return Array.from(s).filter(Boolean)
  }, [lines])

  const totals = useMemo(() => {
    let net = 0, insurer = 0, patient = 0
    for (const r of lines) {
      net += toNum(r.net_amount)
      insurer += toNum(r.insurer_pay_amount)
      patient += toNum(r.patient_pay_amount)
    }
    return { net, insurer, patient }
  }, [lines])

  // ✅ show Approval step only if any line is marked "Need approval?"
  const approvalNeeded = useMemo(() => {
    return lines.some(
      (r) =>
        !!r.requires_preauth &&
        toNum(r.insurer_pay_amount) > 0 &&
        String(r.is_covered || "NO").toUpperCase() !== "NO"
    )
  }, [lines])

  const approvalSuggestedAmount = useMemo(() => {
    return lines.reduce((sum, r) => {
      const ok =
        !!r.requires_preauth &&
        toNum(r.insurer_pay_amount) > 0 &&
        String(r.is_covered || "NO").toUpperCase() !== "NO"
      return ok ? sum + toNum(r.insurer_pay_amount) : sum
    }, 0)
  }, [lines])

  const latestApproval = useMemo(() => (preauths?.[0] || null), [preauths]) // list desc
  const latestClaim = useMemo(() => (claims?.[0] || null), [claims])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [insRes, lineRes, metaRes, caseRes] = await Promise.all([
        insGet(caseId).catch((e) => {
          if (e?.response?.status === 404) return null
          throw e
        }),
        insLines(caseId).catch((e) => {
          if (e?.response?.status === 404) return []
          throw e
        }),
        API.get("/billing/meta/payers").catch(() => ({ data: {} })),
        API.get(`/billing/cases/${caseId}`).catch(() => ({ data: null })),
      ])

      const metaData = metaRes?.data || {}
      const caseData = caseRes?.data || null

      setCaseInfo(caseData)
      setMeta(normalizeMeta(metaData))

      setIns(insRes || null)
      setLines(Array.isArray(lineRes) ? lineRes : [])

      const nextDraft = {}
      for (const r of (lineRes || [])) nextDraft[r.line_id] = String(r.insurer_pay_amount ?? "")
      setDraftInsurerAmt(nextDraft)

      if (insRes) {
        const [pa, cl] = await Promise.all([
          preauthList(caseId).catch(() => []),
          claimList(caseId).catch(() => []),
        ])
        setPreauths(pa || [])
        setClaims(cl || [])
      } else {
        setPreauths([])
        setClaims([])
      }

      // init setup form
      if (insRes) {
        const v = insRes
        setInsForm({
          payer_kind: v.payer_kind || "INSURANCE",
          insurance_company_id: v.insurance_company_id ? String(v.insurance_company_id) : "",
          tpa_id: v.tpa_id ? String(v.tpa_id) : "",
          corporate_id: v.corporate_id ? String(v.corporate_id) : "",
          policy_no: v.policy_no ?? "",
          member_id: v.member_id ?? "",
          plan_name: v.plan_name ?? "",
        })
        didInitDefaults.current = true
      } else if (!didInitDefaults.current && caseData) {
        const sug = suggestFromCase(caseData)
        if (sug) {
          setInsForm((s) => ({ ...s, ...sug }))
          didInitDefaults.current = true
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Failed to load insurance data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [caseId])

  // auto-fill follow-up dialogs with suggested values
  useEffect(() => {
    if (openApproval) {
      setApprovalForm({
        requested_amount: approvalSuggestedAmount ? String(approvalSuggestedAmount) : "",
        remarks: "",
      })
    }
  }, [openApproval, approvalSuggestedAmount])

  useEffect(() => {
    if (openClaim) {
      setClaimForm({
        claim_amount: totals.insurer ? String(totals.insurer) : "",
        remarks: "",
      })
    }
  }, [openClaim, totals.insurer])

  const autoFillFromCase = () => {
    const sug = suggestFromCase(caseInfo)
    if (!sug) return toast.error("No defaults found in this Billing Case")
    setInsForm((s) => ({ ...s, ...sug }))
    toast.success("Filled from Billing Case defaults")
  }

  const saveInsurance = async () => {
    try {
      const pk = insForm.payer_kind
      const payload = {
        payer_kind: pk,
        policy_no: insForm.policy_no || null,
        member_id: insForm.member_id || null,
        plan_name: insForm.plan_name || null,
        insurance_company_id: null,
        tpa_id: null,
        corporate_id: null,
      }

      if (pk === "INSURANCE") {
        payload.insurance_company_id = insForm.insurance_company_id ? Number(insForm.insurance_company_id) : null
      } else if (pk === "TPA") {
        payload.tpa_id = insForm.tpa_id ? Number(insForm.tpa_id) : null
        payload.insurance_company_id = insForm.insurance_company_id ? Number(insForm.insurance_company_id) : null
      } else {
        payload.corporate_id = insForm.corporate_id ? Number(insForm.corporate_id) : null
      }

      const data = await insUpsert(caseId, payload)
      setIns(data)
      setOpenIns(false)
      toast.success("Insurance saved")
      loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save insurance")
    }
  }

  const patchOneLine = async (row, patch) => {
    try {
      if (!row?.line_id) return

      const payload = { line_id: row.line_id, ...patch }

      if (payload.insurer_pay_amount != null) {
        const net = toNum(row.net_amount)
        const v = Math.max(0, Math.min(toNum(payload.insurer_pay_amount), net))
        payload.insurer_pay_amount = v
      }

      await insPatchLines(caseId, [payload])

      setLines((prev) =>
        prev.map((r) => {
          if (r.line_id !== row.line_id) return r
          const net = toNum(r.net_amount)
          const insurer =
            payload.insurer_pay_amount != null
              ? Math.max(0, Math.min(toNum(payload.insurer_pay_amount), net))
              : toNum(r.insurer_pay_amount)
          const patient = Math.max(0, net - insurer)
          return { ...r, ...payload, insurer_pay_amount: insurer, patient_pay_amount: patient }
        })
      )

      // keep input cleaned
      if (payload.insurer_pay_amount != null) {
        setDraftInsurerAmt((s) => ({ ...s, [row.line_id]: String(payload.insurer_pay_amount) }))
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update line")
    }
  }

  const doSplit = async () => {
    try {
      if (!ins) return toast.error("Setup insurance first")
      if (!invoiceIdsFromLines.length) return toast.error("No invoices to split")

      await insSplit(caseId, invoiceIdsFromLines, { allow_paid_split: true })
      toast.success("Split completed")
      loadAll()
    } catch (e) {
      const msg = e?.response?.data?.detail || "Split failed"
      if (String(msg).includes("has payments")) {
        toast.error("Cannot split: receipt already exists for one invoice. Refund/unapply receipt OR use Force Split.")
      } else {
        toast.error(msg)
      }
    }
  }

  // ---------- User-friendly actions ----------
  const doCreateAndSendApproval = async () => {
    try {
      if (!ins) return toast.error("Setup insurance first")
      const amt = toNum(approvalForm.requested_amount || approvalSuggestedAmount, 0)
      if (amt <= 0) return toast.error("Approval amount must be > 0")

      const pr = await preauthCreate(caseId, { requested_amount: amt, remarks: approvalForm.remarks || null })
      await preauthSubmit(caseId, pr.id)
      toast.success("Approval request sent to insurer/TPA")
      setOpenApproval(false)
      loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Approval request failed")
    }
  }

  const doCreateAndSendClaim = async () => {
    try {
      if (!ins) return toast.error("Setup insurance first")

      if (!insurerInvoiceIds.length) {
        return toast.error("No INSURER invoices found. Do Step 3 Split first.")
      }

      const amt = toNum(claimForm.claim_amount || totals.insurer, 0)
      if (amt <= 0) return toast.error("Claim amount must be > 0")

      const cl = await claimCreate(caseId, {
        claim_amount: amt,
        remarks: claimForm.remarks || null,
        insurer_invoice_ids: insurerInvoiceIds, // ✅ ONLY insurer invoices
      })

      await claimSubmit(caseId, cl.id)
      toast.success("Claim submitted to insurer/TPA")
      setOpenClaim(false)
      loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Claim submit failed")
    }
  }


  const submitExistingClaim = async (claimId) => {
    try {
      await claimSubmit(caseId, claimId)
      toast.success("Claim submitted")
      loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submit failed")
    }
  }

  const showInsurerCompany = insForm.payer_kind !== "CORPORATE"
  const showTpa = insForm.payer_kind === "TPA"
  const showCorporate = insForm.payer_kind === "CORPORATE"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <div className="text-lg font-semibold">Insurance Billing</div>
          {ins?.status ? STATUS_BADGE(ins.status) : <Badge variant="secondary">Not configured</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setOpenIns(true)} disabled={!canManage}>
            <FileText className="h-4 w-4 mr-2" /> {ins ? "Edit Insurance" : "Setup Insurance"}
          </Button>
        </div>
      </div>

      {/* Step 1 Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">₹ {money(totals.net)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Insurer Share</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">₹ {money(totals.insurer)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Patient Share</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">₹ {money(totals.patient)}</CardContent>
        </Card>
      </div>

      {/* Step 2: Decide share */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Step 2 — Decide Insurance Share (line-wise)</CardTitle>
          {!ins && (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Setup insurance to edit
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {byInvoice.map((inv) => (
            <div key={inv.invoice_id} className="rounded-xl border p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                <div className="font-semibold">
                  {inv.invoice_number} <span className="text-muted-foreground">• {inv.module || "—"}</span>
                </div>
                <Badge variant="outline">{inv.rows.length} lines</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Service</th>
                      <th className="text-right py-2 px-3">Net</th>
                      <th className="text-center py-2 px-3">Covered?</th>
                      <th className="text-right py-2 px-3">Insurer Pays</th>
                      <th className="text-right py-2 px-3">Patient Pays</th>
                      <th className="text-center py-2 pl-3">Need Approval?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.rows.map((r) => (
                      <tr key={r.line_id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.description}</div>
                          <div className="text-xs text-muted-foreground">{r.service_group}</div>
                        </td>

                        <td className="py-2 px-3 text-right whitespace-nowrap">₹ {money(r.net_amount)}</td>

                        <td className="py-2 px-3 text-center">
                          <Select
                            value={String(r.is_covered || "NO")}
                            onValueChange={(v) => patchOneLine(r, { is_covered: v })}
                            disabled={!canManage || !ins}
                          >
                            <SelectTrigger className="h-8 w-[120px] mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NO">NO</SelectItem>
                              <SelectItem value="YES">YES</SelectItem>
                              <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="py-2 px-3 text-right">
                          <Input
                            className="h-8 w-[130px] ml-auto text-right"
                            value={draftInsurerAmt[r.line_id] ?? ""}
                            onChange={(e) => setDraftInsurerAmt((s) => ({ ...s, [r.line_id]: e.target.value }))}
                            onBlur={() => patchOneLine(r, { insurer_pay_amount: toNum(draftInsurerAmt[r.line_id], 0) })}
                            disabled={!canManage || !ins}
                          />
                        </td>

                        <td className="py-2 px-3 text-right whitespace-nowrap">₹ {money(r.patient_pay_amount)}</td>

                        <td className="py-2 pl-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!r.requires_preauth}
                            onChange={(e) => patchOneLine(r, { requires_preauth: e.target.checked })}
                            disabled={!canManage || !ins}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!lines.length && <div className="text-sm text-muted-foreground">No invoice lines available.</div>}
        </CardContent>
      </Card>

      {/* Step 3: Split */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Step 3 — Generate Patient + Insurer Invoices</CardTitle>
          <Button onClick={doSplit} disabled={!canManage || !ins} className="gap-2">
            <Split className="h-4 w-4" />
            Generate Two Invoices
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This will hide old invoices and create:
          <span className="font-medium text-foreground"> Patient Invoice</span> +{" "}
          <span className="font-medium text-foreground">Insurer Invoice</span>.
          Use this before sending payment request to insurer/TPA.
        </CardContent>
      </Card>

      {/* Step 4: Follow-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Approval Request (Preauth) */}
        <Card className={!approvalNeeded ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" />
              Step 4A — Insurer Approval (only if required)
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setOpenApproval(true)}
              disabled={!canManage || !ins || !approvalNeeded}
            >
              <Plus className="h-4 w-4 mr-2" /> Create Request
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!approvalNeeded ? (
              <div className="text-sm text-muted-foreground">
                No lines are marked “Need Approval?”. If insurer asks for prior approval, tick “Need Approval?” for relevant lines.
              </div>
            ) : (
              <>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Suggested approval amount</div>
                  <div className="text-xl font-semibold">₹ {money(approvalSuggestedAmount)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Based on lines where “Need Approval?” is checked.
                  </div>
                </div>

                {latestApproval ? (
                  <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {latestApproval.ref_no || `APPROVAL-${latestApproval.id}`} {STATUS_BADGE(latestApproval.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Requested: ₹ {money(latestApproval.requested_amount)} • Approved: ₹ {money(latestApproval.approved_amount)}
                      </div>
                      {latestApproval.remarks ? <div className="text-sm mt-1">{latestApproval.remarks}</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          preauthSubmit(caseId, latestApproval.id)
                            .then(loadAll)
                            .catch((e) => toast.error(e?.response?.data?.detail || "Send failed"))
                        }
                        disabled={!canManage || String(latestApproval.status).toUpperCase() !== "DRAFT"}
                      >
                        <Send className="h-4 w-4 mr-1" /> Send
                      </Button>

                      <Button
                        size="sm"
                        onClick={() =>
                          preauthApprove(caseId, latestApproval.id, {
                            approved_amount: toNum(latestApproval.requested_amount),
                            remarks: "",
                          })
                            .then(loadAll)
                            .catch((e) => toast.error(e?.response?.data?.detail || "Approve failed"))
                        }
                        disabled={!canManage || String(latestApproval.status).toUpperCase() !== "SUBMITTED"}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Approved
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          preauthPartial(caseId, latestApproval.id, {
                            approved_amount: Math.max(0, toNum(latestApproval.requested_amount) * 0.5),
                            remarks: "",
                          })
                            .then(loadAll)
                            .catch((e) => toast.error(e?.response?.data?.detail || "Partial failed"))
                        }
                        disabled={!canManage || String(latestApproval.status).toUpperCase() !== "SUBMITTED"}
                      >
                        Partial
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          preauthReject(caseId, latestApproval.id, { approved_amount: 0, remarks: "" })
                            .then(loadAll)
                            .catch((e) => toast.error(e?.response?.data?.detail || "Reject failed"))
                        }
                        disabled={!canManage || String(latestApproval.status).toUpperCase() !== "SUBMITTED"}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">No approval request created yet</div>
                      <div className="text-sm text-muted-foreground">
                        Create & send approval if insurer requires it for these services.
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setOpenApproval(true)} disabled={!canManage || !ins}>
                      <Plus className="h-4 w-4 mr-2" /> Create
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setShowApprovalHistory((s) => !s)}
                  disabled={!preauths.length}
                >
                  <span>View approval history</span>
                  {showApprovalHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {showApprovalHistory && preauths.length > 0 && (
                  <div className="space-y-2">
                    {preauths.map((p) => (
                      <div key={p.id} className="rounded-lg border p-2 text-sm flex items-center justify-between">
                        <div className="font-medium">{p.ref_no || `APP-${p.id}`}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-muted-foreground">₹ {money(p.requested_amount)}</div>
                          {STATUS_BADGE(p.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Claim */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Step 4B — Insurer Payment (Claim)
            </CardTitle>
            <Button size="sm" onClick={() => setOpenClaim(true)} disabled={!canManage || !ins}>
              <Plus className="h-4 w-4 mr-2" /> Create Claim
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Suggested claim amount</div>
              <div className="text-xl font-semibold">₹ {money(totals.insurer)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                This is the insurer share from your line-wise mapping.
              </div>
            </div>

            {latestClaim ? (
              <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {latestClaim.ref_no || `CLAIM-${latestClaim.id}`} {STATUS_BADGE(latestClaim.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Claim: ₹ {money(latestClaim.claim_amount)} • Approved: ₹ {money(latestClaim.approved_amount)} • Settled: ₹ {money(latestClaim.settled_amount)}
                  </div>
                  {latestClaim.remarks ? <div className="text-sm mt-1">{latestClaim.remarks}</div> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => submitExistingClaim(latestClaim.id)} // ✅ fixed
                    disabled={!canManage || String(latestClaim.status).toUpperCase() !== "DRAFT"}
                  >
                    <Send className="h-4 w-4 mr-1" /> Submit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      claimApprove(caseId, latestClaim.id, {
                        approved_amount: toNum(latestClaim.claim_amount),
                        settled_amount: 0,
                        remarks: "",
                      })
                        .then(loadAll)
                        .catch((e) => toast.error(e?.response?.data?.detail || "Approve failed"))
                    }
                    disabled={!canManage || !["SUBMITTED", "UNDER_QUERY"].includes(String(latestClaim.status).toUpperCase())}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Approved
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      claimQuery(caseId, latestClaim.id, {
                        approved_amount: toNum(latestClaim.approved_amount),
                        settled_amount: toNum(latestClaim.settled_amount),
                        remarks: "",
                      })
                        .then(loadAll)
                        .catch((e) => toast.error(e?.response?.data?.detail || "Query failed"))
                    }
                    disabled={!canManage}
                  >
                    Under Query
                  </Button>

                  <Button
                    size="sm"
                    onClick={() =>
                      claimSettle(caseId, latestClaim.id, {
                        approved_amount: toNum(latestClaim.claim_amount),
                        settled_amount: toNum(latestClaim.claim_amount),
                        remarks: "",
                      })
                        .then(loadAll)
                        .catch((e) => toast.error(e?.response?.data?.detail || "Settle failed"))
                    }
                    disabled={!canManage}
                  >
                    Mark Settled
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      claimDeny(caseId, latestClaim.id, { approved_amount: 0, settled_amount: 0, remarks: "" })
                        .then(loadAll)
                        .catch((e) => toast.error(e?.response?.data?.detail || "Deny failed"))
                    }
                    disabled={!canManage}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">No claim created yet</div>
                  <div className="text-sm text-muted-foreground">
                    Create a claim to request payment from insurer/TPA.
                  </div>
                </div>
                <Button size="sm" onClick={() => setOpenClaim(true)} disabled={!canManage || !ins}>
                  <Plus className="h-4 w-4 mr-2" /> Create
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => setShowClaimHistory((s) => !s)}
              disabled={!claims.length}
            >
              <span>View claim history</span>
              {showClaimHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showClaimHistory && claims.length > 0 && (
              <div className="space-y-2">
                {claims.map((c) => (
                  <div key={c.id} className="rounded-lg border p-2 text-sm flex items-center justify-between">
                    <div className="font-medium">{c.ref_no || `CL-${c.id}`}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground">₹ {money(c.claim_amount)}</div>
                      {STATUS_BADGE(c.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insurance Setup Dialog */}
      <Dialog open={openIns} onOpenChange={setOpenIns}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Insurance Setup</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">
              Options loaded from <span className="font-medium">Billing → Meta Payers</span>.
            </div>
            <Button size="sm" variant="outline" onClick={autoFillFromCase} disabled={!caseInfo}>
              <Sparkles className="h-4 w-4 mr-2" /> Auto-fill from Case
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Payer Kind</div>
              <Select
                value={insForm.payer_kind}
                onValueChange={(v) =>
                  setInsForm((s) => ({
                    ...s,
                    payer_kind: v,
                    ...(v === "INSURANCE" ? { tpa_id: "", corporate_id: "" } : {}),
                    ...(v === "TPA" ? { corporate_id: "" } : {}),
                    ...(v === "CORPORATE" ? { insurance_company_id: "", tpa_id: "" } : {}),
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSURANCE">INSURANCE</SelectItem>
                  <SelectItem value="TPA">TPA</SelectItem>
                  <SelectItem value="CORPORATE">CORPORATE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showInsurerCompany && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Insurance Company {insForm.payer_kind === "TPA" ? "(optional)" : ""}
                </div>
                <Select
                  value={selectVal(insForm.insurance_company_id)}
                  onValueChange={(v) => setInsForm((s) => ({ ...s, insurance_company_id: v === CLEAR ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Insurance Company" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={CLEAR}>— None —</SelectItem>
                    {meta.insurers.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {pickLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showTpa && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">TPA</div>
                <Select
                  value={selectVal(insForm.tpa_id)}
                  onValueChange={(v) => setInsForm((s) => ({ ...s, tpa_id: v === CLEAR ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select TPA" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={CLEAR}>— None —</SelectItem>
                    {meta.tpas.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {pickLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showCorporate && (
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Corporate</div>
                <Select
                  value={selectVal(insForm.corporate_id)}
                  onValueChange={(v) => setInsForm((s) => ({ ...s, corporate_id: v === CLEAR ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Corporate" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={CLEAR}>— None —</SelectItem>
                    {meta.corporates.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {pickLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-1">Policy No</div>
              <Input value={insForm.policy_no} onChange={(e) => setInsForm((s) => ({ ...s, policy_no: e.target.value }))} />
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Member ID</div>
              <Input value={insForm.member_id} onChange={(e) => setInsForm((s) => ({ ...s, member_id: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Plan Name</div>
              <Input value={insForm.plan_name} onChange={(e) => setInsForm((s) => ({ ...s, plan_name: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenIns(false)}>Cancel</Button>
            <Button onClick={saveInsurance} disabled={!canManage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval (Preauth) Dialog */}
      <Dialog open={openApproval} onOpenChange={setOpenApproval}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create & Send Approval Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Use this only when insurer/TPA asks for prior approval (surgery/ICU/package).
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Requested Amount</div>
              <Input value={approvalForm.requested_amount} onChange={(e) => setApprovalForm((s) => ({ ...s, requested_amount: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Remarks</div>
              <Input value={approvalForm.remarks} onChange={(e) => setApprovalForm((s) => ({ ...s, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenApproval(false)}>Cancel</Button>
            <Button onClick={doCreateAndSendApproval} disabled={!canManage || !ins || !approvalNeeded}>
              <Send className="h-4 w-4 mr-2" /> Create & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claim Dialog */}
      <Dialog open={openClaim} onOpenChange={setOpenClaim}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create & Submit Claim</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Submit claim after invoices are ready (usually after discharge / final bill).
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Claim Amount</div>
              <Input value={claimForm.claim_amount} onChange={(e) => setClaimForm((s) => ({ ...s, claim_amount: e.target.value }))} />
              <div className="text-xs text-muted-foreground mt-1">Tip: this is normally the “Insurer Share”.</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Remarks</div>
              <Input value={claimForm.remarks} onChange={(e) => setClaimForm((s) => ({ ...s, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenClaim(false)}>Cancel</Button>
            <Button onClick={doCreateAndSendClaim} disabled={!canManage || !ins}>
              <Send className="h-4 w-4 mr-2" /> Create & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
