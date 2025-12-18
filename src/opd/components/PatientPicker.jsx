import { useEffect, useMemo, useRef, useState } from "react";
import { Search, User2, Phone, CalendarDays, Hash, Loader2, Check } from "lucide-react";
import { searchPatients } from "../../api/opd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

function cx(...xs) {
    return xs.filter(Boolean).join(" ");
}

const UI = {
    shell:
        "rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-[0_10px_28px_rgba(2,6,23,0.07)]",
    row:
        "rounded-2xl border border-black/10 bg-white/85 hover:bg-black/[0.02] transition px-3 py-2",
    chip:
        "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700",
};

function safeName(p) {
    const fn = p?.first_name || p?.firstname || "";
    const ln = p?.last_name || p?.lastname || "";
    const full = p?.full_name || p?.name || "";
    const prefix = p?.prefix ? `${p.prefix} ` : "";
    const out = full || `${prefix}${fn} ${ln}`.trim() || "—";
    return out.replace(/\s+/g, " ").trim();
}

function safeSex(p) {
    return (p?.sex || p?.gender || p?.gender_name || "").toString().toUpperCase() || "—";
}

function calcAge(dob) {
    if (!dob) return "";
    try {
        const d = new Date(dob);
        if (Number.isNaN(d.getTime())) return "";
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
        return age >= 0 && age < 130 ? String(age) : "";
    } catch {
        return "";
    }
}

export default function PatientPicker({ value, onChange }) {
    const [q, setQ] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const tRef = useRef(null);

    const selectedId = value ? Number(value) : null;

    const load = async (term) => {
        try {
            setLoading(true);
            const { data } = await searchPatients(term || "");
            setRows(Array.isArray(data) ? data : []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // initial list
        load("");
    }, []);

    useEffect(() => {
        // debounce search
        if (tRef.current) clearTimeout(tRef.current);
        tRef.current = setTimeout(() => load(q), 250);
        return () => tRef.current && clearTimeout(tRef.current);
    }, [q]);

    const selectedMeta = useMemo(() => {
        if (!selectedId) return null;
        return (rows || []).find((r) => Number(r?.id) === selectedId) || null;
    }, [rows, selectedId]);

    return (
        <div className={cx(UI.shell, "p-3")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[12px] font-semibold text-slate-900">Select Patient</div>
                {selectedId ? (
                    <span className={UI.chip}>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Selected #{selectedId}
                    </span>
                ) : (
                    <span className={UI.chip}>
                        <User2 className="h-3.5 w-3.5" />
                        Not selected
                    </span>
                )}
            </div>

            <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name / UHID / phone…"
                    className="h-11 rounded-2xl border-black/10 bg-white/90 pl-10 text-[12px] font-semibold"
                />
            </div>

            {selectedMeta ? (
                <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-[12px] font-semibold text-emerald-900">{safeName(selectedMeta)}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-emerald-900/80">
                        <span className={cx(UI.chip, "border-emerald-200 bg-white/70")}>
                            <Hash className="h-3.5 w-3.5" />
                            UHID {selectedMeta?.uhid || "—"}
                        </span>
                        <span className={cx(UI.chip, "border-emerald-200 bg-white/70")}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            {selectedMeta?.dob || selectedMeta?.date_of_birth ? "DOB" : "Age"}{" "}
                            {selectedMeta?.dob || selectedMeta?.date_of_birth || calcAge(selectedMeta?.dob || selectedMeta?.date_of_birth) || "—"}{" "}
                            · {safeSex(selectedMeta)}
                        </span>
                        <span className={cx(UI.chip, "border-emerald-200 bg-white/70")}>
                            <Phone className="h-3.5 w-3.5" />
                            {selectedMeta?.phone || selectedMeta?.mobile || "—"}
                        </span>
                    </div>
                </div>
            ) : null}

            <div className="mt-3 rounded-2xl border border-black/10 bg-white/75">
                <ScrollArea className="h-[260px] p-2">
                    {loading ? (
                        <div className="flex items-center gap-2 p-3 text-[12px] text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-3 text-[12px] text-slate-500">No patients found.</div>
                    ) : (
                        <div className="space-y-2">
                            {rows.map((p) => {
                                const id = Number(p?.id);
                                const active = selectedId === id;
                                const name = safeName(p);
                                const uhid = p?.uhid || "—";
                                const phone = p?.phone || p?.mobile || "—";
                                const age = calcAge(p?.dob || p?.date_of_birth);
                                const sex = safeSex(p);

                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => onChange?.(id, p)}
                                        className={cx(
                                            UI.row,
                                            "w-full text-left",
                                            active && "border-emerald-300 bg-emerald-50"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-[13px] font-semibold text-slate-900">{name}</div>
                                                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                                    <span className={UI.chip}>
                                                        <Hash className="h-3.5 w-3.5" />
                                                        UHID {uhid}
                                                    </span>
                                                    <span className={UI.chip}>
                                                        <Phone className="h-3.5 w-3.5" />
                                                        {phone}
                                                    </span>
                                                    <span className={UI.chip}>
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        {age ? `${age}y` : "—"} · {sex}
                                                    </span>
                                                </div>
                                            </div>

                                            {active ? (
                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-emerald-200 bg-white/70">
                                                    <Check className="h-4 w-4 text-emerald-700" />
                                                </span>
                                            ) : (
                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-black/10 bg-white/70">
                                                    <User2 className="h-4 w-4 text-slate-600" />
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
