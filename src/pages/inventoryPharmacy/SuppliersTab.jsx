import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

import {
  Plus,
  MoreVertical,
  Eye,
  Copy,
  Search,
  Building2,
  Phone,
  Mail,
  ReceiptText,
  User,
  CreditCard,
  Landmark,
  QrCode,
  Save,
  X,
} from "lucide-react"

import { GLASS_CARD } from "./UI"
import { listSuppliers, createSupplier, updateSupplier } from "@/api/inventory"

// ---------------- helpers ----------------
const clean = (v) => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

const onlyDigits = (s) => String(s || "").replace(/[^\d]/g, "")

const UPI_RE = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const CODE_RE = /^[A-Z0-9/_\.\-]{2,50}$/

const PAYMENT_METHODS = [
  { value: "UPI", label: "UPI", icon: QrCode },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Landmark },
  { value: "CASH", label: "Cash", icon: CreditCard },
  { value: "CHEQUE", label: "Cheque", icon: CreditCard },
  { value: "OTHER", label: "Other", icon: CreditCard },
]

function SupplierBadge({ method }) {
  const v = (method || "UPI").toUpperCase()
  const item = PAYMENT_METHODS.find((x) => x.value === v) || PAYMENT_METHODS[0]
  const Icon = item.icon
  return (
    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {item.value}
      </span>
    </Badge>
  )
}

export default function SuppliersTab({ onCopy }) {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])

  // dialog
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState("create") // create | edit
  const [active, setActive] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    code: "",
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    payment_terms: "",

    payment_method: "UPI",
    upi_id: "",

    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_name: "",
    bank_branch: "",
  })

  // fallback copy
  const copyFn = useCallback(
    async (val, label = "Copied") => {
      try {
        if (onCopy) return onCopy(val, label)
        await navigator.clipboard.writeText(String(val))
        toast.success(label)
      } catch {
        toast.error("Unable to copy")
      }
    },
    [onCopy]
  )

  // ---------------- API ----------------
  const fetchSuppliers = useCallback(async (search = "") => {
    setLoading(true)
    try {
      const res = await listSuppliers(search)
      const data = res?.data?.data ?? res?.data ?? res ?? []
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      toast.error("Failed to load suppliers")
    } finally {
      setLoading(false)
    }
  }, [])

  // debounce search (server-side)
  const debounceRef = useRef(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuppliers(q.trim()), 250)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [q, fetchSuppliers])

  useEffect(() => {
    fetchSuppliers("")
  }, [fetchSuppliers])

  // ---------------- dialog open helpers ----------------
  const openCreate = () => {
    setMode("create")
    setActive(null)
    setErrors({})
    setForm({
      code: "",
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      gstin: "",
      address: "",
      payment_terms: "",

      payment_method: "UPI",
      upi_id: "",

      bank_account_name: "",
      bank_account_number: "",
      bank_ifsc: "",
      bank_name: "",
      bank_branch: "",
    })
    setOpen(true)
  }

  const openEdit = (s) => {
    setMode("edit")
    setActive(s)
    setErrors({})
    setForm({
      code: s?.code ?? "",
      name: s?.name ?? "",
      contact_person: s?.contact_person ?? "",
      phone: s?.phone ?? "",
      email: s?.email ?? "",
      gstin: s?.gstin ?? s?.gst_number ?? "",
      address: s?.address ?? "",
      payment_terms: s?.payment_terms ?? "",

      payment_method: (s?.payment_method ?? "UPI").toUpperCase(),
      upi_id: s?.upi_id ?? "",

      bank_account_name: s?.bank_account_name ?? "",
      bank_account_number: s?.bank_account_number ?? "",
      bank_ifsc: s?.bank_ifsc ?? "",
      bank_name: s?.bank_name ?? "",
      bank_branch: s?.bank_branch ?? "",
    })
    setOpen(true)
  }

  // ---------------- validation ----------------
  const validate = (state) => {
    const e = {}
    const name = clean(state.name)
    if (!name) e.name = "Supplier name is required."

    // code only required on create
    if (mode === "create") {
      const code = clean(state.code)
      const normalized = (code || "").toUpperCase().replace(/\s+/g, "_")
      if (!normalized) e.code = "Supplier code is required."
      else if (!CODE_RE.test(normalized)) e.code = "Use A-Z, 0-9, -, _, /, . (no spaces)."
    }

    const email = clean(state.email)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Enter a valid email or leave blank."
    }

    const pm = (state.payment_method || "UPI").toUpperCase()

    if (pm === "UPI") {
      const upi = clean(state.upi_id)
      if (!upi) e.upi_id = "UPI ID is required (example: name@bank)."
      else if (!UPI_RE.test(upi)) e.upi_id = "Invalid UPI format (example: name@bank)."
    }

    if (pm === "BANK_TRANSFER") {
      const an = clean(state.bank_account_name)
      const acc = onlyDigits(state.bank_account_number)
      const ifsc = (clean(state.bank_ifsc) || "").toUpperCase()

      if (!an) e.bank_account_name = "Account name is required."
      if (!acc) e.bank_account_number = "Account number is required."
      else if (acc.length < 6 || acc.length > 20) e.bank_account_number = "Account number must be 6–20 digits."
      if (!ifsc) e.bank_ifsc = "IFSC is required."
      else if (!IFSC_RE.test(ifsc)) e.bank_ifsc = "Invalid IFSC (example: HDFC0001234)."
    }

    return e
  }

  // ---------------- submit ----------------
  const onSubmit = async (ev) => {
    ev.preventDefault()
    const e = validate(form)
    setErrors(e)
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields")
      return
    }

    setSaving(true)
    try {
      const payload = {
        // create: include code, edit: backend may ignore but we’ll keep safe
        ...(mode === "create"
          ? { code: (clean(form.code) || "").toUpperCase().replace(/\s+/g, "_") }
          : {}),

        name: clean(form.name),
        contact_person: clean(form.contact_person),
        phone: clean(form.phone),
        email: clean(form.email),
        gstin: clean(form.gstin),
        address: clean(form.address),
        payment_terms: clean(form.payment_terms),

        payment_method: (form.payment_method || "UPI").toUpperCase(),
        upi_id: clean(form.upi_id),

        bank_account_name: clean(form.bank_account_name),
        bank_account_number: clean(onlyDigits(form.bank_account_number)),
        bank_ifsc: clean(form.bank_ifsc)?.toUpperCase() ?? null,
        bank_name: clean(form.bank_name),
        bank_branch: clean(form.bank_branch),
      }

      if (mode === "create") {
        await createSupplier(payload)
        toast.success("Supplier created")
      } else {
        await updateSupplier(active.id, payload)
        toast.success("Supplier updated")
      }

      setOpen(false)
      await fetchSuppliers(q.trim())
    } catch (err) {
      console.error(err)
      const msg = err?.response?.data?.detail || err?.response?.data?.error?.msg || "Failed to save supplier"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ---------------- UI list ----------------
  const count = rows?.length || 0

  return (
    <Card className={GLASS_CARD}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            Suppliers
            <Badge variant="outline" className="text-xs">{count}</Badge>
            {loading ? <Badge variant="outline" className="text-xs">Loading…</Badge> : null}
          </CardTitle>
          <p className="text-xs text-slate-500">Vendor master for PO, GRN, returns and payments.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search supplier… (name, code, phone, UPI, IFSC)"
              className="h-10 rounded-2xl pl-9 bg-white/70"
            />
          </div>

          <Button size="sm" className="gap-1 rounded-2xl" onClick={openCreate}>
            <Plus className="w-3 h-3" />
            New supplier
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {count === 0 && !loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white/60 backdrop-blur p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Building2 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="text-sm font-semibold text-slate-900">No suppliers found</div>
            <div className="mt-1 text-xs text-slate-500">Try a different keyword, or create a new supplier.</div>
            <div className="mt-4">
              <Button className="rounded-2xl" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create supplier
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {(rows || []).map((s) => (
              <div
                key={s.id}
                className="group rounded-3xl border border-slate-200 bg-white/70 backdrop-blur shadow-sm transition hover:shadow-md hover:bg-white"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                          {s.code || "—"}
                        </Badge>
                        <SupplierBadge method={s.payment_method} />
                      </div>

                      {s.contact_person ? (
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{s.contact_person}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-400 italic">No contact person</div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-2xl bg-white/70 border-slate-200 hover:bg-white"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="rounded-2xl">
                        <DropdownMenuLabel>Supplier actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(s)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View / Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyFn(s.name, "Supplier name copied")}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy name
                        </DropdownMenuItem>
                        {s.email ? (
                          <DropdownMenuItem onClick={() => copyFn(s.email, "Email copied")}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy email
                          </DropdownMenuItem>
                        ) : null}
                        {s.phone ? (
                          <DropdownMenuItem onClick={() => copyFn(s.phone, "Phone copied")}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy phone
                          </DropdownMenuItem>
                        ) : null}
                        {(s.gstin || s.gst_number) ? (
                          <DropdownMenuItem onClick={() => copyFn(s.gstin || s.gst_number, "GST copied")}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy GST
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* info cards */}
                  <div className="mt-4 grid gap-2">
                    {s.phone ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500">Phone</div>
                          <div className="text-xs font-medium text-slate-900 truncate">{s.phone}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 rounded-2xl"
                          onClick={() => copyFn(s.phone, "Phone copied")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}

                    {s.email ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500">Email</div>
                          <div className="text-xs font-medium text-slate-900 truncate">{s.email}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 rounded-2xl"
                          onClick={() => copyFn(s.email, "Email copied")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}

                    {(s.gstin || s.gst_number) ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                        <ReceiptText className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500">GSTIN</div>
                          <div className="text-xs font-medium text-slate-900 truncate">{s.gstin || s.gst_number}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 rounded-2xl"
                          onClick={() => copyFn(s.gstin || s.gst_number, "GST copied")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">GST not provided</div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                      Supplier ID: <span className="font-medium text-slate-900">{s.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl bg-white/70 border-slate-200 hover:bg-white"
                        onClick={() => copyFn(s.name, "Supplier name copied")}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copy
                      </Button>
                      <Button size="sm" className="rounded-2xl" onClick={() => openEdit(s)}>
                        <Eye className="h-3.5 w-3.5 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="h-1 w-full rounded-b-3xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 opacity-70 group-hover:opacity-100 transition" />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ✅ RESPONSIVE SUPPLIER MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="
            w-[calc(100vw-1.5rem)]
            sm:w-full sm:max-w-4xl
            max-h-[calc(100vh-1.5rem)]
            overflow-hidden
            rounded-3xl
            p-0
          "
        >
          <div className="flex max-h-[calc(100vh-1.5rem)] flex-col bg-white/90 backdrop-blur">
            {/* header */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    {mode === "create" ? "New supplier" : "Edit supplier"}
                  </DialogTitle>
                  <p className="text-xs text-slate-500">
                    Basic details + payment method specific fields (UPI / Bank Transfer)
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-2xl"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* body (scroll) */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <form onSubmit={onSubmit} className="space-y-5">
                {/* basic details */}
                <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900">Basic details</div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        disabled={mode === "edit"}
                        onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                        placeholder="SUPP001"
                        className={`h-10 rounded-2xl ${errors.code ? "border-rose-400" : ""}`}
                      />
                      {errors.code ? <p className="text-xs text-rose-600">{errors.code}</p> : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="ABC Pharma Distributors"
                        className={`h-10 rounded-2xl ${errors.name ? "border-rose-400" : ""}`}
                      />
                      {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Contact person</Label>
                      <Input
                        value={form.contact_person}
                        onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
                        className="h-10 rounded-2xl"
                        placeholder="Person name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        className="h-10 rounded-2xl"
                        placeholder="Mobile / Landline"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        className={`h-10 rounded-2xl ${errors.email ? "border-rose-400" : ""}`}
                        placeholder="mail@domain.com"
                      />
                      {errors.email ? <p className="text-xs text-rose-600">{errors.email}</p> : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label>GSTIN</Label>
                      <Input
                        value={form.gstin}
                        onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value }))}
                        className="h-10 rounded-2xl"
                        placeholder="GSTIN"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={form.address}
                        onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                        className="h-10 rounded-2xl"
                        placeholder="City / area / full address"
                      />
                    </div>
                  </div>
                </div>

                {/* payment details */}
                <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Payment details</div>
                      <p className="text-xs text-slate-500">Required fields depend on Payment Method.</p>
                    </div>
                    <SupplierBadge method={form.payment_method} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Payment method</Label>
                      <Select
                        value={form.payment_method}
                        onValueChange={(val) =>
                          setForm((p) => ({
                            ...p,
                            payment_method: val,
                            // reset conditional fields when switching method
                            upi_id: val === "UPI" ? p.upi_id : "",
                            bank_account_name: val === "BANK_TRANSFER" ? p.bank_account_name : "",
                            bank_account_number: val === "BANK_TRANSFER" ? p.bank_account_number : "",
                            bank_ifsc: val === "BANK_TRANSFER" ? p.bank_ifsc : "",
                            bank_name: val === "BANK_TRANSFER" ? p.bank_name : "",
                            bank_branch: val === "BANK_TRANSFER" ? p.bank_branch : "",
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 rounded-2xl bg-white">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Payment terms</Label>
                      <Input
                        value={form.payment_terms}
                        onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))}
                        className="h-10 rounded-2xl"
                        placeholder="Net 7 / Net 15 / Immediate"
                      />
                    </div>

                    {/* UPI */}
                    {form.payment_method === "UPI" ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>UPI ID</Label>
                        <Input
                          value={form.upi_id}
                          onChange={(e) => setForm((p) => ({ ...p, upi_id: e.target.value }))}
                          className={`h-10 rounded-2xl ${errors.upi_id ? "border-rose-400" : ""}`}
                          placeholder="name@bank"
                        />
                        {errors.upi_id ? <p className="text-xs text-rose-600">{errors.upi_id}</p> : (
                          <p className="text-xs text-slate-500">Example: supplier@hdfc</p>
                        )}
                      </div>
                    ) : null}

                    {/* BANK */}
                    {form.payment_method === "BANK_TRANSFER" ? (
                      <>
                        <div className="space-y-1.5">
                          <Label>Account name</Label>
                          <Input
                            value={form.bank_account_name}
                            onChange={(e) => setForm((p) => ({ ...p, bank_account_name: e.target.value }))}
                            className={`h-10 rounded-2xl ${errors.bank_account_name ? "border-rose-400" : ""}`}
                            placeholder="Account holder name"
                          />
                          {errors.bank_account_name ? <p className="text-xs text-rose-600">{errors.bank_account_name}</p> : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Account number</Label>
                          <Input
                            value={form.bank_account_number}
                            onChange={(e) => setForm((p) => ({ ...p, bank_account_number: onlyDigits(e.target.value) }))}
                            className={`h-10 rounded-2xl ${errors.bank_account_number ? "border-rose-400" : ""}`}
                            placeholder="Digits only"
                            inputMode="numeric"
                          />
                          {errors.bank_account_number ? <p className="text-xs text-rose-600">{errors.bank_account_number}</p> : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label>IFSC</Label>
                          <Input
                            value={form.bank_ifsc}
                            onChange={(e) => setForm((p) => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))}
                            className={`h-10 rounded-2xl ${errors.bank_ifsc ? "border-rose-400" : ""}`}
                            placeholder="HDFC0001234"
                          />
                          {errors.bank_ifsc ? <p className="text-xs text-rose-600">{errors.bank_ifsc}</p> : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Bank name</Label>
                          <Input
                            value={form.bank_name}
                            onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                            className="h-10 rounded-2xl"
                            placeholder="HDFC / SBI / ICICI"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Branch</Label>
                          <Input
                            value={form.bank_branch}
                            onChange={(e) => setForm((p) => ({ ...p, bank_branch: e.target.value }))}
                            className="h-10 rounded-2xl"
                            placeholder="Branch / city"
                          />
                        </div>

                        <div className="sm:col-span-2 text-xs text-slate-500">
                          Required: <span className="text-slate-900 font-medium">Account name + Account number + IFSC</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>

            {/* footer (sticky) */}
            <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/80 backdrop-blur px-5 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  className="rounded-2xl"
                  disabled={saving}
                  onClick={(e) => {
                    // submit via form handler
                    const fake = { preventDefault: () => {} }
                    onSubmit(fake)
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving…" : (mode === "create" ? "Create supplier" : "Save changes")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
