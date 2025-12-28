// FILE: src/components/PatientPicker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { emrSearchPatients } from "../api/emr"

const norm = (v) => String(v ?? "").toLowerCase().trim()

const getDisplayName = (p) =>
    (
        p.name ||
        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
        "Unnamed"
    ).trim()

const getHaystack = (p) => {
    const name = getDisplayName(p)
    return [
        p.uhid,
        p.phone,
        p.mobile,
        p.contact_no,
        p.first_name,
        p.last_name,
        name,
        p.id,
    ]
        .filter(Boolean)
        .map(norm)
        .join(" ")
}

export default function PatientPicker({ value, onChange, onSelect, limit = 20 }) {
    const [q, setQ] = useState("")
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)

    // prevent old responses overriding new searches
    const reqSeq = useRef(0)

    useEffect(() => {
        const term = (q || "").trim()

        if (term.length < 2) {
            setItems([])
            setLoading(false)
            return
        }

        const seq = ++reqSeq.current

        const run = async () => {
            setLoading(true)
            try {
                // ✅ pass object (not string)
                const res = await emrSearchPatients({ q: term, limit, offset: 0 })

                const data = res?.data
                const list = Array.isArray(data)
                    ? data
                    : data?.items || data?.results || []

                // ignore stale responses
                if (seq !== reqSeq.current) return

                // ✅ client-side filter (prevents "all patients" showing)
                const t = norm(term)
                const filtered = list.filter((p) => getHaystack(p).includes(t))

                setItems(filtered)
            } catch (err) {
                if (seq !== reqSeq.current) return
                console.error("emrSearchPatients failed", err)
                setItems([])
            } finally {
                if (seq === reqSeq.current) setLoading(false)
            }
        }

        const h = setTimeout(run, 300)
        return () => clearTimeout(h)
    }, [q, limit])

    function handlePick(p) {
        const cb = onChange || onSelect
        if (cb) cb(p.id, p)

        // optional: set input to selected patient label and close list
        const uhid = p.uhid || `NH-${String(p.id ?? "").padStart(6, "0")}`
        const name = getDisplayName(p)
        setQ(`${uhid} — ${name}`)
        setItems([])
    }

    return (
        <div className="space-y-1">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patient (UHID / Name / Phone)…"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-500 bg-white shadow-sm">
                {loading && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                        Searching…
                    </div>
                )}

                {!loading && q.trim().length < 2 && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                        Type at least 2 characters to search.
                    </div>
                )}

                {!loading && q.trim().length >= 2 && items.length === 0 && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                        No patients found.
                    </div>
                )}

                {items.map((p) => {
                    const uhid =
                        p.uhid || `NH-${String(p.id ?? "").padStart(6, "0")}`
                    const name = getDisplayName(p)

                    return (
                        <button
                            type="button"
                            key={p.id}
                            onClick={() => handlePick(p)}
                            className="w-full text-left px-3 py-2 text-xs md:text-sm hover:bg-indigo-50 flex flex-col gap-0.5"
                        >
                            <span className="font-medium text-slate-800">
                                {uhid} — {name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                                {p.gender ? `${p.gender} • ` : ""}
                                {p.phone || p.mobile || "No phone"}
                            </span>
                        </button>
                    )
                })}
            </div>

            {value && (
                <div className="text-[11px] text-slate-500">
                    Selected patient ID:{" "}
                    <span className="font-semibold text-slate-800">{value}</span>
                </div>
            )}
        </div>
    )
}
