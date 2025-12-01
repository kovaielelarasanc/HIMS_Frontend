// FILE: src/components/PatientPicker.jsx
import React, { useEffect, useState } from "react";
import { lookupPatients } from "../api/emr";

export default function PatientPicker({ value, onChange, onSelect }) {
    const [q, setQ] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const run = async () => {
            const term = (q || "").trim();
            if (term.length < 2) {
                setItems([]);
                return;
            }
            setLoading(true);
            try {
                const { data } = await lookupPatients(term);
                const list = data?.results || data?.items || data || [];
                setItems(list);
            } catch (err) {
                console.error("lookupPatients failed", err);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        const h = setTimeout(run, 300);
        return () => clearTimeout(h);
    }, [q]);

    function handlePick(p) {
        // Primary callback = onChange (for forms), fallback = onSelect
        const cb = onChange || onSelect;
        if (cb) cb(p.id, p);
    }

    return (
        <div className="space-y-1">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patient (UHID / Name / Phone)…"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                {loading && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                        Searching…
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                        Type at least 2 characters to search.
                    </div>
                )}

                {items.map((p) => {
                    const uhid =
                        p.uhid || `NH-${String(p.id ?? "").toString().padStart(6, "0")}`;
                    const name =
                        p.name ||
                        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
                        "Unnamed";

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
                                {p.phone || "No phone"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {value && (
                <div className="text-[11px] text-slate-500">
                    Selected patient ID:{" "}
                    <span className="font-semibold text-slate-800">{value}</span>
                </div>
            )}
        </div>
    );
}
