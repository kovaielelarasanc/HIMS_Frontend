// FILE: src/ipd/AdmissionsDashboard.jsx
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import {
  Search,
  Download,
  RefreshCcw,
  ArrowRight,
  BedDouble,
  Stethoscope,
  SlidersHorizontal,
  CalendarRange,
  X,
  Filter,
  ListFilter,
} from "lucide-react"

import { listIpdAdmissions, exportIpdAdmissionsExcel } from "@/api/ipdAdmissions"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent } from "@/components/ui/sheet"

import { formatIST } from "@/ipd/components/timeZONE"

// ✅ Use your existing picker
import DoctorPicker from "@/opd/components/DoctorPicker"

const cx = (...a) => a.filter(Boolean).join(" ")

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function statusBadge(status) {
  const s = (status || "").toLowerCase()
  if (["discharged", "dama", "lama"].includes(s)) return "secondary"
  if (["admitted", "transferred", "active"].includes(s)) return "default"
  return "outline"
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function cleanParams(obj) {
  const out = {}
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (typeof v === "string" && v.trim() === "") return
    out[k] = v
  })
  return out
}

function SoftDivider() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200/70 to-transparent" />
  )
}

function DesktopTableSkeleton() {
  return (
    <tbody className="divide-y divide-slate-200/60">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-5 py-4">
            <div className="h-4 w-40 rounded bg-slate-200/70" />
            <div className="mt-2 h-3 w-56 rounded bg-slate-200/60" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-32 rounded bg-slate-200/70" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-200/60" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-36 rounded bg-slate-200/70" />
            <div className="mt-2 h-3 w-28 rounded bg-slate-200/60" />
          </td>
          <td className="px-5 py-4">
            <div className="h-6 w-24 rounded-full bg-slate-200/70" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-28 rounded bg-slate-200/70" />
          </td>
          <td className="px-5 py-4 text-right">
            <div className="ml-auto h-9 w-28 rounded-2xl bg-slate-200/70" />
          </td>
        </tr>
      ))}
    </tbody>
  )
}

function MobileCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          className="rounded-3xl border-slate-200/60 bg-white/80 backdrop-blur shadow-sm animate-pulse"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-40 rounded bg-slate-200/70" />
                <div className="mt-2 h-3 w-56 rounded bg-slate-200/60" />
              </div>
              <div className="h-6 w-20 rounded-full bg-slate-200/70" />
            </div>

            <div className="mt-4 h-3 w-44 rounded bg-slate-200/60" />
            <div className="mt-3 h-3 w-60 rounded bg-slate-200/60" />
            <div className="mt-3 h-3 w-36 rounded bg-slate-200/60" />

            <div className="mt-5 h-10 w-full rounded-2xl bg-slate-200/70" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function AdmissionsDashboard() {
  const nav = useNavigate()
  const reduceMotion = useReducedMotion()

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState("")

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  // ✅ Search
  const [q, setQ] = useState("")
  const dq = useDebounced(q)

  // ✅ Filters
  const [fromAdmit, setFromAdmit] = useState("")
  const [toAdmit, setToAdmit] = useState("")
  const [departmentId, setDepartmentId] = useState(null)
  const [doctorUserId, setDoctorUserId] = useState(null)
  const [status, setStatus] = useState("")

  const limit = 30
  const [offset, setOffset] = useState(0)

  // ✅ Mobile filter sheet
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ✅ normalize primitives/objects safely
  const normalizeId = useCallback((v) => {
    if (v === null || v === undefined) return null
    if (typeof v === "number") return v
    if (typeof v === "string") return v
    if (typeof v === "object") return v.id ?? v.value ?? v.user_id ?? v.doctor_user_id ?? null
    return null
  }, [])

  // ✅ DoctorPicker returns: sometimes id, sometimes object having doctor + department
  const applyDoctorPick = useCallback(
    (v) => {
      // cleared
      if (v === null || v === undefined || v === "") {
        setDoctorUserId(null)
        setDepartmentId(null)
        setOffset(0)
        return
      }

      // primitive: treat as doctor id only
      if (typeof v === "number" || typeof v === "string") {
        setDoctorUserId(normalizeId(v))
        setDepartmentId(null)
        setOffset(0)
        return
      }

      // object: try to extract both doctor & department
      const doc =
        v.user_id ??
        v.doctor_user_id ??
        v.doctorId ??
        v.doctor_id ??
        v.id ??
        v.value ??
        null

      const dept =
        v.department_id ??
        v.departmentId ??
        v.dept_id ??
        v.deptId ??
        v.department?.id ??
        null

      setDoctorUserId(normalizeId(doc))
      setDepartmentId(normalizeId(dept))
      setOffset(0)
    },
    [normalizeId]
  )

  const params = useMemo(() => {
    return cleanParams({
      q: dq,
      status,
      from_admit: fromAdmit,
      to_admit: toAdmit,
      department_id: departmentId ? Number(departmentId) : undefined,
      doctor_user_id: doctorUserId ? Number(doctorUserId) : undefined,
      limit,
      offset,
    })
  }, [dq, status, fromAdmit, toAdmit, departmentId, doctorUserId, limit, offset])

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const data = await listIpdAdmissions(params)
      setRows(data?.items ?? [])
      setTotal(data?.total ?? 0)
    } catch (e) {
      const msg = e?.message || "Failed to load admissions"
      setErr(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  const hasFiltersOnly = useMemo(() => {
    return Boolean(status || fromAdmit || toAdmit || departmentId || doctorUserId)
  }, [status, fromAdmit, toAdmit, departmentId, doctorUserId])

  const hasActiveFilters = useMemo(() => {
    return Boolean(q.trim() || hasFiltersOnly)
  }, [q, hasFiltersOnly])

  const clearFilters = useCallback(() => {
    setFromAdmit("")
    setToAdmit("")
    setDepartmentId(null)
    setDoctorUserId(null)
    setStatus("")
    setOffset(0)
  }, [])

  const clearAll = useCallback(() => {
    setQ("")
    clearFilters()
  }, [clearFilters])

  const onExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await exportIpdAdmissionsExcel(
        cleanParams({
          q: dq,
          status,
          from_admit: fromAdmit,
          to_admit: toAdmit,
          department_id: departmentId ? Number(departmentId) : undefined,
          doctor_user_id: doctorUserId ? Number(doctorUserId) : undefined,
        })
      )

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const filename = `ipd_admissions_${new Date()
        .toISOString()
        .slice(0, 19)
        .replaceAll(":", "")}.xlsx`
      downloadBlob(blob, filename)
      toast.success("Excel exported")
    } catch (e) {
      toast.error(e?.message || "Export failed")
    } finally {
      setExporting(false)
    }
  }, [dq, status, fromAdmit, toAdmit, departmentId, doctorUserId])

  const canPrev = offset > 0
  const canNext = offset + limit < total

  const rangeLabel = useMemo(() => {
    if (!total) return "0–0"
    const start = Math.min(total, offset + 1)
    const end = Math.min(total, offset + rows.length)
    return `${start}–${end}`
  }, [total, offset, rows.length])

  const detailUrl = useCallback((id) => `/ipd/admission/${id}`, [])

  return (
    <div className="w-full">
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-[#F7F7FB] to-white">
        <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-6">
          {/* =========================
              MOBILE TOP: sticky search + filters
             ========================= */}
          <div className="md:hidden sticky top-0 z-20 -mx-3 px-3 pb-3 pt-2 bg-[#F7F7FB]/90 backdrop-blur border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setOffset(0)
                  }}
                  placeholder="Search patient / UHID / doctor / admission"
                  className="pl-9 pr-9 rounded-2xl bg-white/80 backdrop-blur border-slate-200/70 focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label="Search admissions"
                />
                {q ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 transition"
                    onClick={() => {
                      setQ("")
                      setOffset(0)
                    }}
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                ) : null}
              </div>

              <Button
                variant="outline"
                className="rounded-2xl h-10 w-10 px-0 bg-white/70 backdrop-blur border-slate-200/70"
                onClick={() => setFiltersOpen(true)}
                title="Filters"
                aria-label="Open filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Card className="rounded-3xl border-slate-200/60 bg-white/70 backdrop-blur shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Total
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {total}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-200/60 bg-white/70 backdrop-blur shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Showing
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {total ? rangeLabel : "—"}
                  </div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    {rows.length} item(s)
                  </div>
                </CardContent>
              </Card>
            </div>

            {err ? (
              <div className="mt-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[13px] text-rose-700">
                {err}
              </div>
            ) : null}
          </div>

          {/* =========================
              DESKTOP HEADER
             ========================= */}
          <div className="hidden md:flex mb-5 items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight text-slate-900">
                IPD Admissions
              </h1>
              <p className="mt-1 text-[13px] text-slate-500">
                Fast search + audit-friendly filters (date, department, doctor, status)
              </p>

              {hasActiveFilters ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-xl">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    Filters active
                  </Badge>

                  {q.trim() ? (
                    <Badge variant="outline" className="rounded-xl">
                      Search:{" "}
                      <span className="ml-1 font-medium text-slate-800">
                        {q.trim()}
                      </span>
                    </Badge>
                  ) : null}

                  {fromAdmit || toAdmit ? (
                    <Badge variant="outline" className="rounded-xl">
                      Date:{" "}
                      <span className="ml-1 font-medium text-slate-800">
                        {fromAdmit || "…"} → {toAdmit || "…"}
                      </span>
                    </Badge>
                  ) : null}

                  {status ? (
                    <Badge variant="outline" className="rounded-xl capitalize">
                      Status: <span className="ml-1 font-medium">{status}</span>
                    </Badge>
                  ) : null}

                  {(doctorUserId || departmentId) ? (
                    <Badge variant="outline" className="rounded-xl">
                      Doctor/Dept:{" "}
                      <span className="ml-1 font-medium text-slate-800">
                        {doctorUserId ? `Doctor#${doctorUserId}` : "—"}
                        {departmentId ? ` • Dept#${departmentId}` : ""}
                      </span>
                    </Badge>
                  ) : null}

                  <Button
                    variant="ghost"
                    className="rounded-2xl h-8 px-3"
                    onClick={clearAll}
                    title="Clear all"
                  >
                    Clear all
                  </Button>
                </div>
              ) : null}

              {err ? (
                <div className="mt-3 w-fit rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[13px] text-rose-700">
                  {err}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Card className="rounded-3xl border-slate-200/60 bg-white/70 backdrop-blur shadow-sm">
                <CardContent className="px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Total
                  </div>
                  <div className="text-[22px] font-semibold text-slate-900 leading-tight">
                    {total}
                  </div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    Showing{" "}
                    <span className="font-medium text-slate-700">
                      {rangeLabel}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                onClick={load}
                disabled={loading}
                className="rounded-2xl bg-white/70 backdrop-blur border-slate-200/70"
                title="Refresh"
              >
                <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
              </Button>

              <Button
                onClick={onExport}
                disabled={exporting}
                className="rounded-2xl"
                title="Export Excel"
              >
                <Download
                  className={cx("h-4 w-4 mr-2", exporting && "animate-pulse")}
                />
                Export
              </Button>
            </div>
          </div>

          {/* =========================
              DESKTOP FILTER BAR
              ✅ DoctorPicker BELOW Search
             ========================= */}
          <div className="hidden md:block">
            <Card className="rounded-3xl shadow-sm border-slate-200/60 bg-white/70 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-[14px] font-semibold text-slate-800">
                    Search & Filters
                  </CardTitle>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="rounded-2xl h-9"
                      onClick={clearFilters}
                      disabled={!hasFiltersOnly}
                      title="Clear filters"
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-12 gap-3">
                  {/* Search + DoctorPicker (stacked) */}
                  <div className="col-span-5 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value)
                          setOffset(0)
                        }}
                        placeholder="Search patient / UHID / doctor / admission"
                        className="pl-9 pr-9 rounded-2xl bg-white/80 border-slate-200/70"
                        aria-label="Search admissions"
                      />
                      {q ? (
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 transition"
                          onClick={() => {
                            setQ("")
                            setOffset(0)
                          }}
                          aria-label="Clear search"
                          title="Clear"
                        >
                          <X className="h-4 w-4 text-slate-500" />
                        </button>
                      ) : null}
                    </div>

                    {/* ✅ Department + Doctor in one picker */}
                    <DoctorPicker
                      value={doctorUserId}
                      doctorUserId={doctorUserId}
                      selectedId={doctorUserId}
                      onChange={applyDoctorPick}
                      onSelect={applyDoctorPick}
                      placeholder="Department / Doctor"
                    />
                  </div>

                  {/* Date range */}
                  <div className="col-span-2">
                    <Input
                      type="date"
                      value={fromAdmit}
                      onChange={(e) => {
                        setFromAdmit(e.target.value)
                        setOffset(0)
                      }}
                      className="rounded-2xl bg-white/80 border-slate-200/70"
                      aria-label="From admit date"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">From</div>
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="date"
                      value={toAdmit}
                      onChange={(e) => {
                        setToAdmit(e.target.value)
                        setOffset(0)
                      }}
                      className="rounded-2xl bg-white/80 border-slate-200/70"
                      aria-label="To admit date"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">To</div>
                  </div>

                  {/* Right side empty space (keeps layout clean) */}
                  <div className="col-span-3" />

                  {/* Status chips + actions */}
                  <div className="col-span-12 flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant={status === "" ? "default" : "outline"}
                      className="rounded-2xl"
                      onClick={() => {
                        setStatus("")
                        setOffset(0)
                      }}
                    >
                      All
                    </Button>

                    {["admitted", "transferred", "discharged", "dama", "lama"].map((s) => (
                      <Button
                        key={s}
                        variant={status === s ? "default" : "outline"}
                        className="rounded-2xl capitalize"
                        onClick={() => {
                          setStatus(s)
                          setOffset(0)
                        }}
                      >
                        {s}
                      </Button>
                    ))}

                    <div className="flex-1" />

                    <Button
                      variant="outline"
                      className="rounded-2xl bg-white/70 backdrop-blur border-slate-200/70"
                      onClick={load}
                      disabled={loading}
                      title="Refresh"
                    >
                      <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
                    </Button>

                    <Button
                      className="rounded-2xl"
                      onClick={onExport}
                      disabled={exporting}
                      title="Export"
                    >
                      <Download className={cx("h-4 w-4 mr-2", exporting && "animate-pulse")} />
                      Export
                    </Button>
                  </div>

                  <div className="col-span-12 pt-2">
                    <SoftDivider />
                  </div>

                  {/* Pagination meta */}
                  <div className="col-span-12 flex items-center justify-between text-[12px] text-slate-500 pt-2">
                    <span>
                      Showing{" "}
                      <span className="font-medium text-slate-700">{rangeLabel}</span> of{" "}
                      <span className="font-medium text-slate-700">{total}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        disabled={!canPrev}
                        onClick={() => setOffset((v) => Math.max(0, v - limit))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        disabled={!canNext}
                        onClick={() => setOffset((v) => v + limit)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* =========================
              MOBILE FILTER SHEET
              ✅ Only DoctorPicker (dept+doctor)
             ========================= */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="bottom" className="p-0 border-t border-slate-200/60 bg-transparent">
              <div className="bg-white rounded-t-3xl shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.25)]">
                <div className="flex justify-center pt-3">
                  <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <ListFilter className="h-4 w-4 text-slate-600" />
                    Filters
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-2xl h-9 bg-white/70 backdrop-blur border-slate-200/70"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-4 py-4 space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" />
                      Date range (Admitted)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={fromAdmit}
                        onChange={(e) => {
                          setFromAdmit(e.target.value)
                          setOffset(0)
                        }}
                        className="rounded-2xl"
                        aria-label="From date"
                      />
                      <Input
                        type="date"
                        value={toAdmit}
                        onChange={(e) => {
                          setToAdmit(e.target.value)
                          setOffset(0)
                        }}
                        className="rounded-2xl"
                        aria-label="To date"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Department / Doctor
                    </div>
                    <DoctorPicker
                      value={doctorUserId}
                      doctorUserId={doctorUserId}
                      selectedId={doctorUserId}
                      onChange={applyDoctorPick}
                      onSelect={applyDoctorPick}
                      placeholder="Select Department / Doctor"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={status === "" ? "default" : "outline"}
                        className="rounded-2xl"
                        onClick={() => {
                          setStatus("")
                          setOffset(0)
                        }}
                      >
                        All
                      </Button>
                      {["admitted", "transferred", "discharged", "dama", "lama"].map((s) => (
                        <Button
                          key={s}
                          variant={status === s ? "default" : "outline"}
                          className="rounded-2xl capitalize"
                          onClick={() => {
                            setStatus(s)
                            setOffset(0)
                          }}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Card className="rounded-3xl border-slate-200/60 bg-slate-50/70">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
                        <div className="text-xl font-semibold text-slate-900">{total}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                          Showing <span className="font-medium text-slate-700">{rangeLabel}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="rounded-2xl bg-white/70 backdrop-blur border-slate-200/70"
                          onClick={load}
                          disabled={loading}
                          title="Refresh"
                          aria-label="Refresh list"
                        >
                          <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
                        </Button>
                        <Button
                          className="rounded-2xl"
                          onClick={onExport}
                          disabled={exporting}
                          title="Export"
                          aria-label="Export to Excel"
                        >
                          <Download className={cx("h-4 w-4", exporting && "animate-pulse")} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl w-full"
                      onClick={clearAll}
                      disabled={!hasActiveFilters}
                    >
                      Clear all
                    </Button>
                    <Button className="rounded-2xl w-full" onClick={() => setFiltersOpen(false)}>
                      Apply
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-slate-500 pt-1">
                    <span>
                      Showing <span className="font-medium text-slate-700">{rangeLabel}</span> of{" "}
                      <span className="font-medium text-slate-700">{total}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        disabled={!canPrev}
                        onClick={() => setOffset((v) => Math.max(0, v - limit))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        disabled={!canNext}
                        onClick={() => setOffset((v) => v + limit)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <div className="h-2" />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* =========================
              RESULTS
             ========================= */}
          <div className={cx("mt-4", "md:mt-6")}>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="rounded-3xl border border-slate-200/60 bg-white/70 backdrop-blur shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr className="text-left text-slate-600">
                        <th className="px-5 py-4 font-semibold">Patient</th>
                        <th className="px-5 py-4 font-semibold">Doctor</th>
                        <th className="px-5 py-4 font-semibold">Bed / Ward</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Admitted</th>
                        <th className="px-5 py-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>

                    {loading ? (
                      <DesktopTableSkeleton />
                    ) : (
                      <tbody className="divide-y divide-slate-200/60">
                        {rows.length === 0 ? (
                          <tr>
                            <td className="px-5 py-10 text-slate-500" colSpan={6}>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                                  <Search className="h-5 w-5 text-slate-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-slate-700">No admissions found</div>
                                  <div className="text-[12px] text-slate-500">
                                    Try adjusting filters or date range.
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          rows.map((a) => (
                            <tr
                              key={a.id}
                              className="hover:bg-slate-50/60 transition cursor-pointer"
                              onClick={() => nav(detailUrl(a.id))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") nav(detailUrl(a.id))
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Open admission ${a.admission_code || a.id}`}
                            >
                              <td className="px-5 py-4">
                                <div className="leading-tight">
                                  <div className="font-semibold text-slate-900">{a.patient_name}</div>
                                  <div className="text-[12px] text-slate-500">
                                    UHID: {a.uhid} • {a.admission_code}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="font-medium text-slate-800">{a.doctor_name || "—"}</div>
                                <div className="text-[12px] text-slate-500">Attending Doctor</div>
                              </td>

                              <td className="px-5 py-4 text-slate-700">
                                <div className="flex items-center gap-2">
                                  <BedDouble className="h-4 w-4 text-slate-400" />
                                  <div>
                                    <div className="font-medium">
                                      {a.bed_code || "—"}
                                      {a.room_number ? ` / Room ${a.room_number}` : ""}
                                    </div>
                                    <div className="text-[12px] text-slate-500">{a.ward_name || "—"}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <Badge variant={statusBadge(a.status)} className="rounded-xl capitalize">
                                  {a.status}
                                </Badge>
                              </td>

                              <td className="px-5 py-4 text-slate-700">
                                {a.admitted_at ? formatIST(a.admitted_at) : "—"}
                              </td>

                              <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <Button className="rounded-2xl" onClick={() => nav(detailUrl(a.id))}>
                                  View <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {loading ? (
                <div className="mt-3">
                  <MobileCardSkeleton />
                </div>
              ) : rows.length === 0 ? (
                <div className="mt-3 rounded-3xl border border-slate-200/60 bg-white/70 backdrop-blur p-4 text-slate-600">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">No admissions found</div>
                      <div className="mt-1 text-[13px] text-slate-500">
                        Try clearing filters or expanding the date range.
                      </div>
                      {hasActiveFilters ? (
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" className="rounded-2xl" onClick={clearAll}>
                            Clear all
                          </Button>
                          <Button className="rounded-2xl" onClick={() => setFiltersOpen(true)}>
                            Open filters
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    <div className="grid grid-cols-1 gap-3 mt-3">
                      {rows.map((a) => (
                        <motion.div
                          key={a.id}
                          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0.9 } : { opacity: 0, y: 10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className="rounded-3xl shadow-sm border-slate-200/60 bg-white/80 backdrop-blur">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[15px] font-semibold text-slate-900 truncate">
                                    {a.patient_name}
                                  </div>
                                  <div className="text-[12px] text-slate-500 mt-0.5">
                                    UHID:{" "}
                                    <span className="font-medium text-slate-700">{a.uhid}</span>
                                    <span className="mx-2">•</span>
                                    <span className="text-slate-600">{a.admission_code}</span>
                                  </div>
                                </div>
                                <Badge
                                  variant={statusBadge(a.status)}
                                  className="rounded-xl capitalize shrink-0"
                                >
                                  {a.status}
                                </Badge>
                              </div>

                              <div className="mt-3 flex items-center gap-2 text-slate-700">
                                <Stethoscope className="h-4 w-4 text-slate-400" />
                                <div className="text-[13px]">
                                  <span className="text-slate-500">Doctor:</span>{" "}
                                  <span className="font-medium text-slate-800">
                                    {a.doctor_name || "—"}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-2 text-slate-700">
                                <BedDouble className="h-4 w-4 text-slate-400" />
                                <div className="text-[13px]">
                                  <span className="text-slate-500">Bed:</span>{" "}
                                  <span className="font-medium">{a.bed_code || "—"}</span>
                                  {a.room_number ? (
                                    <span className="text-slate-500"> • Room {a.room_number}</span>
                                  ) : null}
                                  {a.ward_name ? (
                                    <span className="text-slate-500"> • {a.ward_name}</span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-2 text-[12px] text-slate-500">
                                Admitted: {a.admitted_at ? formatIST(a.admitted_at) : "—"}
                              </div>

                              <div className="mt-4">
                                <Button
                                  className="rounded-2xl w-full"
                                  onClick={() => nav(detailUrl(a.id))}
                                >
                                  View Admission <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </AnimatePresence>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl w-full"
                      disabled={!canPrev}
                      onClick={() => setOffset((v) => Math.max(0, v - limit))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl w-full"
                      disabled={!canNext}
                      onClick={() => setOffset((v) => v + limit)}
                    >
                      Next
                    </Button>
                  </div>

                  <div className="mt-2 text-center text-[12px] text-slate-500">
                    Showing <span className="font-medium text-slate-700">{rangeLabel}</span> of{" "}
                    <span className="font-medium text-slate-700">{total}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
