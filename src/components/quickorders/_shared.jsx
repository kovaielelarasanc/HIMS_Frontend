// FILE: src/components/quickorders/_shared.js
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// -----------------------------
// Small helpers
// -----------------------------
export function cx(...a) {
  return a.filter(Boolean).join(" ")
}

export function safePatientName(p) {
  if (!p) return "Unknown patient"
  return (
    p.full_name ||
    p.name ||
    `${p.prefix || ""} ${p.first_name || ""} ${p.last_name || ""}`
      .replace(/\s+/g, " ")
      .trim()
  )
}

export function safeGenderAge(p) {
  if (!p) return "—"
  const gender = p.gender || p.sex || "—"
  const age = p.age_display || p.age || "—"
  return `${gender} • ${age}`
}

export function fmtIST(v) {
  if (!v) return "—"
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(v)
  }
}

export function extractApiError(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail

  if (detail && !Array.isArray(detail) && typeof detail === "object") {
    if (detail.msg) return detail.msg
    try {
      return JSON.stringify(detail)
    } catch {
      return fallback
    }
  }

  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => d?.msg).filter(Boolean)
    if (msgs.length) return msgs.join(", ")
    try {
      return JSON.stringify(detail)
    } catch {
      return fallback
    }
  }

  if (err?.message) return err.message
  return fallback
}

// -----------------------------
// Media Query
// -----------------------------
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    onChange()
    m.addEventListener?.("change", onChange) || m.addListener(onChange)
    return () => m.removeEventListener?.("change", onChange) || m.removeListener(onChange)
  }, [query])

  return matches
}

// -----------------------------
// Premium UI Tokens
// -----------------------------
export const TONE = {
  lab: {
    solid:
      "bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 text-white shadow-[0_12px_30px_rgba(2,132,199,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
    soft: "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100/70",
    ring: "focus-visible:ring-sky-500/35",
    chip: "bg-sky-50 text-sky-700",
    icon: "text-sky-600",
  },
  ris: {
    solid:
      "bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
    soft: "bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100/70",
    ring: "focus-visible:ring-indigo-500/35",
    chip: "bg-indigo-50 text-indigo-700",
    icon: "text-indigo-600",
  },
  rx: {
    solid:
      "bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
    soft: "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/70",
    ring: "focus-visible:ring-emerald-500/35",
    chip: "bg-emerald-50 text-emerald-700",
    icon: "text-emerald-600",
  },
  ot: {
    solid:
      "bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 text-white shadow-[0_12px_30px_rgba(245,158,11,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
    soft: "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/70",
    ring: "focus-visible:ring-amber-500/35",
    chip: "bg-amber-50 text-amber-800",
    icon: "text-amber-600",
  },
  slate: {
    solid:
      "bg-gradient-to-b from-slate-800 via-slate-900 to-black text-white shadow-[0_14px_34px_rgba(2,6,23,0.24)] hover:brightness-[1.06] active:brightness-[0.98]",
    soft: "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100/70",
    ring: "focus-visible:ring-slate-500/30",
    chip: "bg-slate-100 text-slate-700",
    icon: "text-slate-600",
  },
}

export function StatusChip({ children, tone = "slate" }) {
  const t = TONE[tone] || TONE.slate
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", t.chip)}>
      {children}
    </span>
  )
}

export function PremiumButton({ tone = "slate", variant = "solid", className = "", ...props }) {
  const t = TONE[tone] || TONE.slate
  const base =
    "rounded-2xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 disabled:pointer-events-none"
  const v =
    variant === "solid"
      ? t.solid
      : variant === "soft"
        ? t.soft
        : "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50"
  return (
    <Button
      {...props}
      className={cx(base, v, t.ring, className)}
      variant={variant === "outline" ? "outline" : "default"}
    />
  )
}

// -----------------------------
// RX frequency helpers
// -----------------------------
export function freqToSlots(freq) {
  if (!freq) return { am: 0, af: 0, pm: 0, night: 0 }
  const f = String(freq).trim().toUpperCase()

  if (f.includes("-")) {
    const parts = f.split("-").map((x) => parseInt(x || "0", 10) || 0)
    if (parts.length === 3) return { am: parts[0], af: parts[1], pm: 0, night: parts[2] }
    if (parts.length >= 4) return { am: parts[0], af: parts[1], pm: parts[2], night: parts[3] }
  }

  const map = {
    OD: { am: 1, af: 0, pm: 0, night: 0 },
    QD: { am: 1, af: 0, pm: 0, night: 0 },
    BD: { am: 1, af: 0, pm: 0, night: 1 },
    BID: { am: 1, af: 0, pm: 0, night: 1 },
    TID: { am: 1, af: 1, pm: 0, night: 1 },
    TDS: { am: 1, af: 1, pm: 0, night: 1 },
    QID: { am: 1, af: 1, pm: 1, night: 1 },
    HS: { am: 0, af: 0, pm: 0, night: 1 },
    NIGHT: { am: 0, af: 0, pm: 0, night: 1 },
  }
  return map[f] || { am: 0, af: 0, pm: 0, night: 0 }
}

export function slotsToFreq(slots) {
  const a = slots?.am ? 1 : 0
  const b = slots?.af ? 1 : 0
  const c = slots?.pm ? 1 : 0
  const d = slots?.night ? 1 : 0
  return `${a}-${b}-${c}-${d}`
}

// -----------------------------
// PDF helpers
// -----------------------------
export function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function printBlob(blob) {
  const url = URL.createObjectURL(blob)
  const w = window.open(url, "_blank", "noopener,noreferrer")
  if (!w) {
    toast.error("Popup blocked. Please allow popups to print.")
    return
  }
  const timer = setInterval(() => {
    try {
      w.focus()
      w.print()
      clearInterval(timer)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {}
  }, 700)
  setTimeout(() => clearInterval(timer), 8000)
}
