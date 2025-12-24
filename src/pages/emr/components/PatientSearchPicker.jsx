// frontend/src/components/emr/PatientSearchPicker.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Search } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"

import { patientFullName, patientPrimaryMeta } from "./patientFormat"

export default function PatientSearchPicker({
    title = "Patient Search",
    placeholder = "Search by UHID / Name / Phone (min 2 chars)",
    fetchPatients, // async ({ q, limit, offset }) => array
    minChars = 2,
    debounceMs = 250,
    limit = 25,
    selectedPatient,
    onSelect,
}) {
    const [q, setQ] = useState("")
    const [loading, setLoading] = useState(false)
    const [patients, setPatients] = useState([])
    const [activeIndex, setActiveIndex] = useState(-1)

    const inputRef = useRef(null)

    // ---- debounced search ----
    useEffect(() => {
        const term = (q || "").trim()
        if (term.length < minChars) {
            setPatients([])
            setActiveIndex(-1)
            return
        }

        let alive = true
        const t = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetchPatients({ q: term, limit, offset: 0 })
                const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
                if (!alive) return
                setPatients(arr)
                setActiveIndex(arr.length ? 0 : -1)
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Patient search failed")
            } finally {
                if (alive) setLoading(false)
            }
        }, debounceMs)

        return () => {
            alive = false
            clearTimeout(t)
        }
    }, [q, minChars, debounceMs, limit, fetchPatients])

    const selectedId = selectedPatient?.id

    const onKeyDown = (e) => {
        if (!patients.length) return

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(patients.length - 1, Math.max(0, i + 1)))
        }
        if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
        }
        if (e.key === "Enter") {
            e.preventDefault()
            const idx = activeIndex >= 0 ? activeIndex : 0
            const p = patients[idx]
            if (p?.id) onSelect?.(p)
        }
    }

    const emptyHint = useMemo(() => {
        const term = (q || "").trim()
        if (term.length < minChars) return "Type to search patients…"
        if (!loading && patients.length === 0) return "No patients found."
        return ""
    }, [q, minChars, loading, patients.length])

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent>
                <div className="space-y-3">
                    <Input
                        ref={inputRef}
                        placeholder={placeholder}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={onKeyDown}
                    />

                    <div className="rounded-xl border bg-white">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-600">
                            Results
                        </div>
                        <Separator />
                        <div className="h-[360px]">
                            <ScrollArea className="h-full">
                                <div className="p-2 space-y-2">
                                    {loading && (
                                        <div className="space-y-2">
                                            <Skeleton className="h-14 w-full" />
                                            <Skeleton className="h-14 w-full" />
                                            <Skeleton className="h-14 w-full" />
                                        </div>
                                    )}

                                    {!loading && !!emptyHint && (
                                        <div className="p-3 text-sm text-slate-500">{emptyHint}</div>
                                    )}

                                    {!loading &&
                                        patients.map((p, idx) => {
                                            const active = selectedId === p.id
                                            const focused = idx === activeIndex

                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => onSelect?.(p)}
                                                    onMouseEnter={() => setActiveIndex(idx)}
                                                    className={[
                                                        "w-full text-left rounded-xl border p-3 transition outline-none",
                                                        active
                                                            ? "border-slate-900 bg-slate-50"
                                                            : "border-slate-200 hover:bg-slate-50",
                                                        focused && !active ? "ring-2 ring-slate-300" : "",
                                                    ].join(" ")}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-900 truncate">
                                                                {patientFullName(p)}
                                                            </div>
                                                            <div className="text-xs text-slate-600 mt-1">
                                                                {patientPrimaryMeta(p)}
                                                            </div>
                                                        </div>

                                                        <Badge variant="secondary" className="shrink-0">
                                                            #{p.id}
                                                        </Badge>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                        Keyboard: ↑ ↓ to navigate, Enter to select
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
