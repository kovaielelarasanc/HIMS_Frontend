// FILE: src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "react-router-dom"
import { fetchDashboardData } from "../api/dashboard"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import {
  Calendar,
  RefreshCcw,
  AlertCircle,
  BarChart3,
  Activity,
  Stethoscope,
  BedDouble,
  Pill,
  FlaskConical,
  ScanLine,
  IndianRupee,
  Clock3,
  ArrowUpRight,
  Sparkles,
  Layers,
  Dot,
} from "lucide-react"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

import { cn } from "@/lib/utils"

/**
 * ✅ Adjust routes here to match your app router
 */
const ROUTES = {
  patients: "/patients",
  opd: "/opd/appointments",
  ipd: "/ipd/bedboard",
  lab: "/lab/orders",
  radiology: "/ris/orders",
  pharmacy: "/pharmacy/inventory",
  billing: "/billing",
  ot: "/ot/schedule",
}

const chartColors = ["#0f172a", "#0284c7", "#22c55e", "#e11d48", "#6366f1"]

function formatDateInputLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(base, delta) {
  const d = new Date(base)
  d.setDate(d.getDate() + delta)
  return d
}

function isFiniteNumber(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function formatINR(x) {
  const n = isFiniteNumber(x)
  return `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

// Animations (premium but subtle)
const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut" },
  },
}

const blockVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
}

const metricsContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const metricItemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: "easeOut" },
  },
}

export default function Dashboard() {
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(() => formatDateInputLocal(today))
  const [dateTo, setDateTo] = useState(() => formatDateInputLocal(today))
  const [activePreset, setActivePreset] = useState("today")
  const [activeTab, setActiveTab] = useState("overview")

  const [data, setData] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  const datesValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo)

  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setIsLoading(false)
      setError("")
      setData(null)
      return
    }

    if (dateFrom > dateTo) {
      setIsLoading(false)
      setError("Invalid date range: From date must be <= To date.")
      setData(null)
      return
    }

    const load = async () => {
      setIsLoading(true)
      setError("")
      try {
        const params = { date_from: dateFrom, date_to: dateTo }
        const res = await fetchDashboardData(params)
        setData(res?.data ?? null)
        setLastUpdated(new Date())
      } catch (err) {
        console.error(err)
        setError(
          err?.response?.data?.detail ||
          "Failed to load dashboard data. Please try again."
        )
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [dateFrom, dateTo, refreshKey])

  const caps = data?.filters?.caps || {}
  const hasCaps = Object.keys(caps).length > 0

  // Widgets
  const metricWidgets = useMemo(
    () => data?.widgets?.filter((w) => w.widget_type === "metric") || [],
    [data]
  )
  const tableWidgets = useMemo(
    () => data?.widgets?.filter((w) => w.widget_type === "table") || [],
    [data]
  )
  const chartWidgets = useMemo(
    () => data?.widgets?.filter((w) => w.widget_type === "chart") || [],
    [data]
  )

  const patientFlowWidget = chartWidgets.find((w) => w.code === "patient_flow")
  const bedOccWidget = chartWidgets.find((w) => w.code === "ipd_bed_occupancy")
  const revenueStreamWidget = chartWidgets.find((w) => w.code === "revenue_by_stream")
  const apptStatusWidget = chartWidgets.find((w) => w.code === "appointment_status")
  const ipdStatusWidget = chartWidgets.find((w) => w.code === "ipd_status")
  const paymentModeWidget = chartWidgets.find((w) => w.code === "payment_modes")
  const topLabTestsWidget = chartWidgets.find((w) => w.code === "top_lab_tests")
  const topRadiologyTestsWidget = chartWidgets.find((w) => w.code === "top_radiology_tests")
  const billingSummaryWidget = chartWidgets.find((w) => w.code === "billing_summary")
  const topMedicinesWidget = chartWidgets.find((w) => w.code === "top_medicines")

  const recentAdmissionsWidget = tableWidgets.find(
    (w) => w.code === "recent_ipd_admissions"
  )

  const revenueMetricWidgets = metricWidgets.filter((w) =>
    w.code.startsWith("revenue_")
  )
  const nonRevenueMetricWidgets = metricWidgets.filter(
    (w) => !w.code.startsWith("revenue_")
  )

  const handleRefresh = () => setRefreshKey((k) => k + 1)

  const handlePresetChange = (preset) => {
    setActivePreset(preset)
    const base = new Date()
    if (preset === "today") {
      const d = formatDateInputLocal(base)
      setDateFrom(d)
      setDateTo(d)
    } else if (preset === "7d") {
      setDateFrom(formatDateInputLocal(addDays(base, -6)))
      setDateTo(formatDateInputLocal(base))
    } else if (preset === "30d") {
      setDateFrom(formatDateInputLocal(addDays(base, -29)))
      setDateTo(formatDateInputLocal(base))
    } else if (preset === "month") {
      const first = new Date(base.getFullYear(), base.getMonth(), 1)
      setDateFrom(formatDateInputLocal(first))
      setDateTo(formatDateInputLocal(base))
    }
  }

  const handleDateChange = (setter) => (e) => {
    setActivePreset("custom")
    setter(e.target.value)
  }

  const capabilityChips = useMemo(() => {
    if (!hasCaps) return []
    const chips = []
    if (caps.can_patients) chips.push({ key: "patients", label: "Patients", icon: Activity })
    if (caps.can_opd) chips.push({ key: "opd", label: "OPD", icon: Stethoscope })
    if (caps.can_ipd) chips.push({ key: "ipd", label: "IPD / Beds", icon: BedDouble })
    if (caps.can_lab) chips.push({ key: "lab", label: "Lab", icon: FlaskConical })
    if (caps.can_radiology) chips.push({ key: "radiology", label: "Radiology", icon: ScanLine })
    if (caps.can_pharmacy) chips.push({ key: "pharmacy", label: "Pharmacy", icon: Pill })
    if (caps.can_billing) chips.push({ key: "billing", label: "Billing", icon: IndianRupee })
    if (caps.can_ot) chips.push({ key: "ot", label: "OT", icon: Layers })
    return chips
  }, [hasCaps, caps])

  // Quick pills (glance strip)
  const quickPills = useMemo(() => {
    if (!data) return []

    const findMetric = (code) => metricWidgets.find((w) => w.code === code)?.data ?? 0

    const newPatients = isFiniteNumber(findMetric("metric_new_patients"))
    const opdVisits = isFiniteNumber(findMetric("metric_opd_visits"))
    const ipdAdmissions = isFiniteNumber(findMetric("metric_ipd_admissions"))

    const bedData = bedOccWidget?.data || {}
    const occupancyPct = isFiniteNumber(bedData.occupancy_pct ?? 0)

    const streams = revenueStreamWidget?.data || []
    const topStream =
      Array.isArray(streams) && streams.length
        ? [...streams].sort((a, b) => isFiniteNumber(b.value) - isFiniteNumber(a.value))[0]
        : null

    const pills = []

    if (caps.can_patients) {
      pills.push({
        key: "patients",
        label: "New Patients",
        value: newPatients,
        helper: "Registered in period",
        icon: Activity,
        tone: "sky",
      })
    }
    if (caps.can_opd) {
      pills.push({
        key: "opd",
        label: "OPD Visits",
        value: opdVisits,
        helper: "Consults in period",
        icon: Stethoscope,
        tone: "emerald",
      })
    }
    if (caps.can_ipd) {
      pills.push({
        key: "ipd",
        label: "IPD Admissions",
        value: ipdAdmissions,
        helper: "Admitted cases",
        icon: BedDouble,
        tone: "violet",
      })
      pills.push({
        key: "beds",
        label: "Bed Occupancy",
        value: occupancyPct,
        suffix: "%",
        helper: "Across wards",
        icon: BedDouble,
        tone: "amber",
      })
    }

    if (
      topStream &&
      (caps.can_billing || caps.can_pharmacy || caps.can_lab || caps.can_radiology)
    ) {
      pills.push({
        key: "revenue",
        label: "Top Stream",
        value: isFiniteNumber(topStream.value || 0),
        helper: topStream.label || "—",
        icon:
          topStream.label === "Pharmacy"
            ? Pill
            : topStream.label === "Lab"
              ? FlaskConical
              : topStream.label === "Radiology"
                ? ScanLine
                : IndianRupee,
        tone: "rose",
      })
    }

    return pills
  }, [data, metricWidgets, bedOccWidget, revenueStreamWidget, caps])

  // Quick Actions
  const quickActions = useMemo(() => {
    const findMetricValue = (code) => {
      const raw = metricWidgets.find((w) => w.code === code)?.data
      return isFiniteNumber(
        typeof raw === "number"
          ? raw
          : typeof raw === "object" && raw
            ? raw.value ?? raw.total ?? raw.amount ?? 0
            : Number(raw || 0)
      )
    }

    const bed = bedOccWidget?.data || {}
    const occupancy = Number.isFinite(Number(bed.occupancy_pct)) ? Number(bed.occupancy_pct) : null

    const list = []

    if (caps.can_patients) {
      list.push({
        key: "patients",
        title: "Patients",
        desc: "Search, register, timeline & EMR",
        icon: Activity,
        href: ROUTES.patients,
        stat: findMetricValue("metric_new_patients"),
        statLabel: "new",
        tone: "sky",
      })
    }
    if (caps.can_opd) {
      list.push({
        key: "opd",
        title: "OPD",
        desc: "Appointments, queue & visits",
        icon: Stethoscope,
        href: ROUTES.opd,
        stat: findMetricValue("metric_opd_visits"),
        statLabel: "visits",
        tone: "emerald",
      })
    }
    if (caps.can_ipd) {
      list.push({
        key: "ipd",
        title: "IPD / Beds",
        desc: "Admissions, bed board & occupancy",
        icon: BedDouble,
        href: ROUTES.ipd,
        stat: occupancy,
        statSuffix: occupancy != null ? "%" : "",
        statLabel: "occupied",
        tone: "violet",
      })
    }
    if (caps.can_lab) {
      list.push({
        key: "lab",
        title: "Laboratory",
        desc: "Orders, sample, results & reports",
        icon: FlaskConical,
        href: ROUTES.lab,
        tone: "amber",
      })
    }
    if (caps.can_radiology) {
      list.push({
        key: "radiology",
        title: "Radiology",
        desc: "Orders, scheduling & reporting",
        icon: ScanLine,
        href: ROUTES.radiology,
        tone: "sky",
      })
    }
    if (caps.can_pharmacy) {
      list.push({
        key: "pharmacy",
        title: "Pharmacy",
        desc: "Billing, GRN & stock movement",
        icon: Pill,
        href: ROUTES.pharmacy,
        tone: "emerald",
      })
    }
    if (caps.can_billing) {
      list.push({
        key: "billing",
        title: "Billing",
        desc: "Invoices, payments & refunds",
        icon: IndianRupee,
        href: ROUTES.billing,
        tone: "rose",
      })
    }
    if (caps.can_ot) {
      list.push({
        key: "ot",
        title: "OT",
        desc: "Cases, checklists & theatre flow",
        icon: Layers,
        href: ROUTES.ot,
        tone: "violet",
      })
    }

    return list
  }, [caps, metricWidgets, bedOccWidget])

  // Visible tabs based on perms
  const visibleTabs = useMemo(() => {
    const list = [
      { key: "overview", label: "Overview", show: true },
      { key: "clinical", label: "Clinical", show: caps.can_patients || caps.can_opd || caps.can_ipd },
      {
        key: "revenue",
        label: "Revenue",
        show: caps.can_billing || caps.can_pharmacy || caps.can_lab || caps.can_radiology,
      },
      {
        key: "operations",
        label: "Operations",
        show: caps.can_ipd || caps.can_pharmacy || caps.can_lab || caps.can_radiology,
      },
    ]
    return list.filter((t) => t.show)
  }, [caps])

  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeTab)) {
      if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].key)
    }
  }, [visibleTabs, activeTab])

  const rangeLabel = useMemo(() => {
    if (!dateFrom || !dateTo) return "—"
    if (dateFrom === dateTo) return dateFrom
    return `${dateFrom} → ${dateTo}`
  }, [dateFrom, dateTo])

  return (
    <motion.div
      className="relative min-h-[calc(100vh-4rem)] px-3 py-3 md:px-6 md:py-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Premium background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute top-24 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-12xl space-y-4">
        {/* HEADER */}
        <div className="space-y-3">
          <motion.div
            className={cn(
              "rounded-3xl border bg-white/80 backdrop-blur-xl",
              "shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
              "border-slate-200/70"
            )}
          >
            <div className="p-3 md:p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      NUTRYAH-premium dashboard
                      <Dot className="h-4 w-4 text-emerald-500" />
                      <span className="text-slate-600">Live</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200iG200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-medium">{rangeLabel}</span>
                    </div>

                    {lastUpdated && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                        <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                        {lastUpdated.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
                      <BarChart3 className="h-5 w-5 text-slate-800" />
                    </span>
                    <div>
                      <h1 className="text-xl md:text-3xl font-semibold tracking-tight text-slate-900">
                        Dashboard
                      </h1>
                      <p className="text-xs md:text-sm text-slate-600">
                        Monitor clinical activity, diagnostics, pharmacy and revenue — in one place.
                      </p>
                    </div>
                  </div>

                  {/* Capability chips */}
                  {hasCaps && capabilityChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {capabilityChips.map((chip) => (
                        <span
                          key={chip.key}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full",
                            "border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700",
                            "shadow-[0_8px_18px_rgba(15,23,42,0.03)]"
                          )}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-50 border border-slate-200">
                            <chip.icon className="h-3.5 w-3.5 text-slate-700" />
                          </span>
                          <span className="font-medium">{chip.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div className="w-full lg:w-[520px] space-y-2">
                  <PresetSegment
                    active={activePreset}
                    onChange={handlePresetChange}
                    items={[
                      { key: "today", label: "Today" },
                      { key: "7d", label: "7D" },
                      { key: "30d", label: "30D" },
                      { key: "month", label: "Month" },
                      { key: "custom", label: "Custom" },
                    ]}
                  />

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <div className="space-y-1">
                            <div className="text-[10px] font-medium text-slate-500">From</div>
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={handleDateChange(setDateFrom)}
                              className={cn(
                                "w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5",
                                "text-[12px] text-slate-900 outline-none",
                                "focus:ring-2 focus:ring-sky-500/30 focus:border-sky-300"
                              )}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] font-medium text-slate-500">To</div>
                            <input
                              type="date"
                              value={dateTo}
                              onChange={handleDateChange(setDateTo)}
                              className={cn(
                                "w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5",
                                "text-[12px] text-slate-900 outline-none",
                                "focus:ring-2 focus:ring-sky-500/30 focus:border-sky-300"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      onClick={handleRefresh}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-2xl",
                        "border border-slate-200 bg-slate-900 text-white",
                        "px-4 py-2.5 text-sm font-medium shadow-sm",
                        "hover:bg-slate-800 transition-colors"
                      )}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200/90 to-transparent" />

            {/* Quick Actions */}
            <div className="p-3 md:p-5 pt-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <ArrowUpRight className="h-4 w-4 text-slate-800" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Quick access</div>
                  <div className="text-[12px] text-slate-600">
                    Jump into modules you have permission for.
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[84px] rounded-2xl" />
                  ))}
                </div>
              ) : quickActions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No module shortcuts available for your role.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {quickActions.map((a) => (
                    <QuickActionTile key={a.key} action={a} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ERROR */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <AlertTitle>Dashboard error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </div>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AT A GLANCE */}
          {!isLoading && data && quickPills.length > 0 && (
            <motion.div
              className={cn(
                "rounded-3xl border border-slate-200/70 bg-white/85 backdrop-blur-xl",
                "shadow-[0_18px_50px_rgba(15,23,42,0.06)] p-3 md:p-4"
              )}
              variants={blockVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center gap-3 mb-2 px-1">
                <h2 className="text-xs font-semibold text-slate-700">At a glance</h2>
                <span className="h-px flex-1 bg-slate-200/80" />
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPills.map((pill) => (
                  <QuickPill key={pill.key} pill={pill} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* LOADING */}
        {isLoading && dateFrom && dateTo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Skeleton className="h-24 rounded-3xl" />
              <Skeleton className="h-24 rounded-3xl" />
              <Skeleton className="h-24 rounded-3xl" />
              <Skeleton className="h-24 rounded-3xl" />
            </div>
            <Skeleton className="h-72 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        )}

        {/* MAIN CONTENT */}
        {!isLoading && datesValid && data && (
          <motion.div variants={blockVariants} initial="hidden" animate="visible" className="pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-between items-center mb-2">
                <TabsList
                  className={cn(
                    "flex flex-nowrap overflow-x-auto gap-1 rounded-full",
                    "bg-white/80 backdrop-blur-xl border border-slate-200/70 p-1",
                    "shadow-[0_18px_50px_rgba(15,23,42,0.05)]"
                  )}
                >
                  {visibleTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className={cn(
                        "px-4 py-2 text-xs sm:text-sm rounded-full",
                        "data-[state=active]:bg-slate-900 data-[state=active]:text-white",
                        "data-[state=active]:shadow-sm"
                      )}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="space-y-4 mt-2">
                {metricWidgets.length > 0 && (
                  <section className="space-y-2">
                    <SectionTitle icon={BarChart3} title="Key metrics" subtitle="High-signal numbers for the selected range" />
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                      variants={metricsContainerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {metricWidgets.map((w) => (
                        <motion.div key={w.code} variants={metricItemVariants} whileHover={{ y: -3, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 240, damping: 20 }}>
                          <MetricWidgetCard widget={w} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </section>
                )}

                <section className="space-y-2">
                  <SectionTitle icon={Activity} title="Activity & revenue mix" subtitle="Trends and distribution" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                    {patientFlowWidget && <ChartWidgetCard widget={patientFlowWidget} />}
                    {revenueStreamWidget && <ChartWidgetCard widget={revenueStreamWidget} />}
                  </div>
                </section>
              </TabsContent>

              {/* CLINICAL */}
              <TabsContent value="clinical" className="space-y-4 mt-2">
                {nonRevenueMetricWidgets.length > 0 && (
                  <section className="space-y-2">
                    <SectionTitle icon={Stethoscope} title="Clinical metrics" subtitle="Patients, OPD & IPD indicators" />
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                      variants={metricsContainerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {nonRevenueMetricWidgets.map((w) => (
                        <motion.div key={w.code} variants={metricItemVariants} whileHover={{ y: -3, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 240, damping: 20 }}>
                          <MetricWidgetCard widget={w} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </section>
                )}

                <section className="space-y-2">
                  <SectionTitle icon={Activity} title="Flow & appointment status" subtitle="OPD flow + appointment distribution" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                    {patientFlowWidget && <ChartWidgetCard widget={patientFlowWidget} />}
                    {apptStatusWidget && <ChartWidgetCard widget={apptStatusWidget} />}
                  </div>
                </section>

                <section className="space-y-2">
                  <SectionTitle icon={BedDouble} title="IPD beds & admissions" subtitle="Occupancy snapshot and status mix" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                    {bedOccWidget && <ChartWidgetCard widget={bedOccWidget} />}
                    {ipdStatusWidget && <ChartWidgetCard widget={ipdStatusWidget} />}
                  </div>
                </section>

                {recentAdmissionsWidget && (
                  <section className="space-y-2">
                    <SectionTitle icon={BedDouble} title="Recent IPD admissions" subtitle="Latest activity records" />
                    <ListWidgetCard widget={recentAdmissionsWidget} />
                  </section>
                )}
              </TabsContent>

              {/* REVENUE */}
              <TabsContent value="revenue" className="space-y-4 mt-2">
                {revenueMetricWidgets.length > 0 && (
                  <section className="space-y-2">
                    <SectionTitle icon={IndianRupee} title="Revenue KPIs" subtitle="Billing and collections performance" />
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                      variants={metricsContainerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {revenueMetricWidgets.map((w) => (
                        <motion.div key={w.code} variants={metricItemVariants} whileHover={{ y: -3, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 240, damping: 20 }}>
                          <MetricWidgetCard widget={w} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </section>
                )}

                <section className="space-y-2">
                  <SectionTitle icon={IndianRupee} title="Revenue & payment mix" subtitle="Stream split + payment distribution" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                    {revenueStreamWidget && <ChartWidgetCard widget={revenueStreamWidget} />}
                    {paymentModeWidget && <ChartWidgetCard widget={paymentModeWidget} />}
                  </div>
                </section>

                <section className="space-y-2">
                  <SectionTitle icon={FlaskConical} title="Billing summary & top tests" subtitle="Billed vs pending + diagnostics leaders" />
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4">
                    {billingSummaryWidget && <ChartWidgetCard widget={billingSummaryWidget} />}
                    {topLabTestsWidget && <ChartWidgetCard widget={topLabTestsWidget} />}
                    {topRadiologyTestsWidget && <ChartWidgetCard widget={topRadiologyTestsWidget} />}
                  </div>
                </section>

                {topMedicinesWidget && (
                  <section className="space-y-2">
                    <SectionTitle icon={Pill} title="Top medicines" subtitle="Top 10 by quantity (selected range)" />
                    <ChartWidgetCard widget={topMedicinesWidget} />
                  </section>
                )}
              </TabsContent>

              {/* OPERATIONS */}
              <TabsContent value="operations" className="space-y-4 mt-2">
                <section className="space-y-2">
                  <SectionTitle icon={Layers} title="Capacity & utilization" subtitle="Occupancy + flow side by side" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                    {bedOccWidget && <ChartWidgetCard widget={bedOccWidget} />}
                    {patientFlowWidget && <ChartWidgetCard widget={patientFlowWidget} />}
                  </div>
                </section>

                <section className="space-y-2">
                  <SectionTitle icon={ScanLine} title="Pharmacy & diagnostics focus" subtitle="Top movers across modules" />
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4">
                    {topMedicinesWidget && <ChartWidgetCard widget={topMedicinesWidget} />}
                    {topLabTestsWidget && <ChartWidgetCard widget={topLabTestsWidget} />}
                    {topRadiologyTestsWidget && <ChartWidgetCard widget={topRadiologyTestsWidget} />}
                  </div>
                </section>

                {recentAdmissionsWidget && (
                  <section className="space-y-2">
                    <SectionTitle icon={BedDouble} title="Latest IPD activity" subtitle="Admission timeline (latest records)" />
                    <ListWidgetCard widget={recentAdmissionsWidget} />
                  </section>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

/* ------------------------ UI PIECES ------------------------ */

function PresetSegment({ items, active, onChange }) {
  return (
    <div className={cn("relative rounded-2xl border border-slate-200 bg-white px-1 py-1", "shadow-sm")}>
      <div className="grid grid-cols-5 gap-1">
        {items.map((p) => {
          const isActive = active === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.key)}
              className={cn(
                "relative rounded-xl px-2 py-2 text-[12px] font-medium transition-colors",
                isActive ? "text-white" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="presetActivePill"
                  className="absolute inset-0 rounded-xl bg-slate-900"
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                />
              )}
              <span className="relative z-10">{p.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          {Icon ? <Icon className="h-4 w-4 text-slate-800" /> : null}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="text-[12px] text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}

function QuickActionTile({ action }) {
  const { title, desc, icon: Icon, href, stat, statLabel, statSuffix, tone } = action

  const toneRing =
    {
      sky: "ring-sky-200/50",
      emerald: "ring-emerald-200/50",
      violet: "ring-violet-200/50",
      amber: "ring-amber-200/50",
      rose: "ring-rose-200/50",
    }[tone] || "ring-slate-200/50"

  const toneIcon =
    {
      sky: "bg-sky-50 text-sky-700 border-sky-200/60",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      violet: "bg-violet-50 text-violet-700 border-violet-200/60",
      amber: "bg-amber-50 text-amber-700 border-amber-200/60",
      rose: "bg-rose-50 text-rose-700 border-rose-200/60",
    }[tone] || "bg-slate-50 text-slate-700 border-slate-200/60"

  return (
    <Link
      to={href}
      className={cn(
        "group rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl",
        "shadow-[0_18px_50px_rgba(15,23,42,0.05)]",
        "p-3 transition-all",
        "hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.08)]",
        "focus:outline-none focus:ring-2 focus:ring-sky-500/25",
        "ring-1",
        toneRing
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("h-10 w-10 rounded-2xl border flex items-center justify-center", toneIcon)}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>

        <div className="flex items-center gap-2">
          {typeof stat === "number" && Number.isFinite(stat) && (
            <div className="text-right">
              <div className="text-[16px] font-semibold text-slate-900 leading-tight">
                {stat.toLocaleString("en-IN", { maximumFractionDigits: statSuffix === "%" ? 1 : 0 })}
                {statSuffix ? <span className="text-[12px] ml-0.5">{statSuffix}</span> : null}
              </div>
              <div className="text-[10px] text-slate-500">{statLabel || "—"}</div>
            </div>
          )}

          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm transition-colors group-hover:bg-slate-800">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mt-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-[12px] text-slate-600 leading-snug">{desc}</div>
      </div>
    </Link>
  )
}

function QuickPill({ pill }) {
  const { label, value, helper, icon: Icon, tone, suffix } = pill
  const toneClasses =
    {
      sky: "bg-sky-50 border-sky-100 text-sky-900",
      emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
      violet: "bg-violet-50 border-violet-100 text-violet-900",
      amber: "bg-amber-50 border-amber-100 text-amber-900",
      rose: "bg-rose-50 border-rose-100 text-rose-900",
    }[tone || "sky"] || "bg-slate-50 border-slate-200 text-slate-900"

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={cn(
        "flex-1 min-w-[150px] sm:min-w-[170px] rounded-3xl border px-3 py-2.5",
        "flex items-center gap-3 shadow-[0_18px_50px_rgba(15,23,42,0.05)]",
        toneClasses
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 border border-white/60 shadow-sm shrink-0">
        {Icon && <Icon className="w-4 h-4 text-slate-800" />}
      </div>
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wide font-semibold opacity-90">{label}</div>
        <div className="text-base sm:text-lg font-semibold leading-tight">
          {typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: suffix === "%" ? 1 : 0 }) : value}
          {suffix && <span className="ml-0.5 text-[11px]">{suffix}</span>}
        </div>
        {helper && <div className="text-[11px] leading-tight opacity-80">{helper}</div>}
      </div>
    </motion.div>
  )
}

function MetricWidgetCard({ widget }) {
  const raw = widget.data
  const isMoney =
    widget?.config?.currency === "INR" ||
    widget?.code?.startsWith("revenue_") ||
    widget?.code === "billing_summary"

  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw || 0)
        : typeof raw === "object" && raw !== null
          ? raw.value ?? raw.total ?? raw.amount ?? 0
          : 0

  const display = isMoney ? formatINR(value) : isFiniteNumber(value).toLocaleString("en-IN")

  return (
    <Card
      className={cn(
        "rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl",
        "shadow-[0_18px_50px_rgba(15,23,42,0.06)] overflow-hidden",
        "transition-colors hover:border-sky-200/70"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
          {widget.title}
        </CardTitle>
        <Badge variant="outline" className="text-[9px] uppercase tracking-wide border-slate-200 text-slate-500 bg-white">
          {widget.code}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 text-slate-900">
          {display}
        </div>
        {widget.description && <p className="text-[12px] text-slate-600 mt-1">{widget.description}</p>}
      </CardContent>
    </Card>
  )
}

function ChartWidgetCard({ widget }) {
  const chartType = widget.config?.chart_type || "bar"

  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 12px 30px rgba(15,23,42,0.10)",
  }

  // Donut = IPD beds
  if (chartType === "donut") {
    const d = widget.data || {}
    const data = [
      { label: "Occupied", value: d.occupied || 0 },
      { label: "Available", value: d.available || 0 },
    ]

    return (
      <Card className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">{widget.title}</CardTitle>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">Snapshot</span>
        </CardHeader>
        <CardContent className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie dataKey="value" data={data} innerRadius={52} outerRadius={84} paddingAngle={3}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>

          {typeof d.occupancy_pct === "number" && (
            <p className="text-xs text-slate-700 text-center mt-2">
              Occupancy: <span className="font-semibold text-emerald-600">{d.occupancy_pct}%</span>{" "}
              <span className="opacity-80">({d.occupied}/{d.total} beds)</span>
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Pie
  if (chartType === "pie") {
    const data = Array.isArray(widget.data) ? widget.data : []
    return (
      <Card className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">{widget.title}</CardTitle>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">Distribution</span>
        </CardHeader>
        <CardContent className="h-56 sm:h-64">
          {data.length === 0 ? (
            <p className="text-sm text-slate-500 mt-4">No data to display.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" outerRadius={84} paddingAngle={3} labelLine={false}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    )
  }

  // multi_bar (FIXED: consistent colors per series)
  if (chartType === "multi_bar") {
    const data = Array.isArray(widget.data) ? widget.data : []
    const series = widget.config?.series || []
    const xKey = widget.config?.x_key || "label"

    return (
      <Card className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent className="h-56 sm:h-64">
          {data.length === 0 ? (
            <p className="text-sm text-slate-500 mt-4">No data to display.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <XAxis dataKey={xKey} stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                {series.map((s, idx) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    radius={[6, 6, 0, 0]}
                    fill={chartColors[idx % chartColors.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    )
  }

  // default bar
  const data = Array.isArray(widget.data) ? widget.data : []
  const normalized =
    data.length > 0
      ? data.map((r, i) => ({
        label: r.label ?? r.name ?? `Item ${i + 1}`,
        value: r.value ?? r.amount ?? 0,
      }))
      : []

  return (
    <Card className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-900">{widget.title}</CardTitle>
        <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
          {widget.description ? "Insight" : "Summary"}
        </span>
      </CardHeader>
      <CardContent className="h-56 sm:h-64">
        {normalized.length === 0 ? (
          <p className="text-sm text-slate-500 mt-4">No data to display.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={normalized} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {normalized.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function ListWidgetCard({ widget }) {
  const rows = Array.isArray(widget.data) ? widget.data : []
  const columns = widget.config?.columns || (rows[0] ? Object.keys(rows[0]) : [])

  return (
    <Card className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-900">{widget.title}</CardTitle>
        <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
          Latest records
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No records found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5",
                  "flex flex-col gap-1 text-xs md:text-sm"
                )}
              >
                {columns.map((col, ci) => (
                  <div
                    key={col}
                    className={cn("flex justify-between gap-2", ci === 0 ? "font-semibold text-slate-900" : "text-slate-700")}
                  >
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      {col.replace(/_/g, " ")}
                    </span>
                    <span className="text-right">{formatCell(row[col])}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatCell(value) {
  if (value == null) return "-"
  if (typeof value === "number") return value.toLocaleString("en-IN", { maximumFractionDigits: 1 })
  if (typeof value === "string" && value.length > 40) return value.slice(0, 40) + "…"
  return String(value)
}
