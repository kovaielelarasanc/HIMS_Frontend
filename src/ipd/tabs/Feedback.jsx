// FILE: src/ipd/tabs/FeedbackTab.jsx
import { useEffect, useMemo, useState } from "react"
import { getAdmissionFeedback, saveAdmissionFeedback } from "../../api/ipd"
import { Star, Lock, CheckCircle2, AlertTriangle, Loader2, MessageSquareText, Sparkles } from "lucide-react"

const fmtIST = (dt) => {
    if (!dt) return "—"
    try {
        const d = new Date(dt)
        if (Number.isNaN(d.getTime())) return String(dt)
        return d.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return String(dt)
    }
}

const cx = (...a) => a.filter(Boolean).join(" ")

function normalizeFeedbackPayload(apiData) {
    // Supports:
    // 1) { items: [...] } OR { history: [...] }
    // 2) array [...]
    // 3) single object { ... }
    if (!apiData) return []
    const items =
        apiData?.items ||
        apiData?.history ||
        (Array.isArray(apiData) ? apiData : [apiData])

    return (items || [])
        .filter(Boolean)
        .map((x) => ({
            ...x,
            // common audit fields (safe fallbacks)
            created_at: x.created_at || x.createdAt || x.recorded_at || x.updated_at || x.updatedAt || null,
            updated_at: x.updated_at || x.updatedAt || null,
        }))
}

function avg3(a, b, c) {
    const x = Number(a) || 0
    const y = Number(b) || 0
    const z = Number(c) || 0
    if (!x && !y && !z) return 0
    return Math.round(((x + y + z) / 3) * 10) / 10
}

function ratingLabel(n) {
    const v = Number(n) || 0
    if (v >= 5) return "Excellent"
    if (v >= 4) return "Very good"
    if (v >= 3) return "Good"
    if (v >= 2) return "Needs improvement"
    if (v >= 1) return "Poor"
    return "—"
}

function StarRating({
    label,
    value,
    onChange,
    disabled,
    hint,
}) {
    const [hover, setHover] = useState(0)
    const shown = hover || value || 0

    const set = (v) => {
        if (disabled) return
        onChange?.(v)
    }

    return (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{label}</div>
                    {hint ? <div className="text-xs text-slate-500 mt-0.5">{hint}</div> : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs font-semibold text-slate-700">{shown || 0}/5</div>
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
                <div
                    className={cx("flex items-center gap-1", disabled && "opacity-60")}
                    role="radiogroup"
                    aria-label={label}
                    onMouseLeave={() => setHover(0)}
                >
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            disabled={disabled}
                            className={cx(
                                "group inline-flex h-10 w-10 items-center justify-center rounded-xl border transition",
                                "border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]",
                                disabled && "cursor-not-allowed"
                            )}
                            aria-label={`${label}: ${n} stars`}
                            aria-checked={value === n}
                            role="radio"
                            onMouseEnter={() => !disabled && setHover(n)}
                            onFocus={() => !disabled && setHover(n)}
                            onBlur={() => setHover(0)}
                            onClick={() => set(n)}
                            onKeyDown={(e) => {
                                if (disabled) return
                                if (e.key === "ArrowLeft") {
                                    e.preventDefault()
                                    set(Math.max(1, (value || 1) - 1))
                                }
                                if (e.key === "ArrowRight") {
                                    e.preventDefault()
                                    set(Math.min(5, (value || 1) + 1))
                                }
                                if (["1", "2", "3", "4", "5"].includes(e.key)) {
                                    e.preventDefault()
                                    set(Number(e.key))
                                }
                            }}
                        >
                            <Star
                                className={cx(
                                    "h-5 w-5 transition",
                                    n <= shown ? "fill-slate-900 text-slate-900" : "text-slate-300"
                                )}
                            />
                        </button>
                    ))}
                </div>

                <div className="hidden sm:block text-xs font-medium text-slate-600">
                    {ratingLabel(shown)}
                </div>
            </div>
        </div>
    )
}

function Banner({ tone = "info", title, children }) {
    const styles =
        tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : tone === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-slate-200 bg-slate-50 text-slate-900"

    const Icon =
        tone === "success" ? CheckCircle2 : tone === "danger" ? AlertTriangle : Sparkles

    return (
        <div className={cx("rounded-2xl border px-3 py-2 text-sm shadow-sm", styles)}>
            <div className="flex items-start gap-2">
                <Icon className="h-5 w-5 mt-0.5" />
                <div className="min-w-0">
                    {title ? <div className="font-semibold">{title}</div> : null}
                    <div className="text-sm leading-relaxed">{children}</div>
                </div>
            </div>
        </div>
    )
}

export default function FeedbackTab({ admissionId, canWrite }) {
    const readOnly = !canWrite

    const [items, setItems] = useState([])
    const [current, setCurrent] = useState(null)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState("")
    const [notice, setNotice] = useState({ type: "", msg: "" })

    const [form, setForm] = useState({
        rating_nursing: 5,
        rating_doctor: 5,
        rating_cleanliness: 5,
        comments: "",
        suggestions: "",
    })

    const overall = useMemo(
        () => avg3(form.rating_nursing, form.rating_doctor, form.rating_cleanliness),
        [form.rating_nursing, form.rating_doctor, form.rating_cleanliness]
    )

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr("")
        setNotice({ type: "", msg: "" })
        try {
            const res = await getAdmissionFeedback(admissionId)
            const raw = res?.data
            const normalized = normalizeFeedbackPayload(raw)

            // sort newest first using created_at/updated_at if present
            normalized.sort((a, b) => {
                const ta = new Date(a.updated_at || a.created_at || 0).getTime()
                const tb = new Date(b.updated_at || b.created_at || 0).getTime()
                return tb - ta
            })

            setItems(normalized)
            const latest = normalized[0] || (raw && !Array.isArray(raw) ? raw : null)
            setCurrent(latest || null)

            if (latest) {
                setForm({
                    rating_nursing: latest.rating_nursing ?? 5,
                    rating_doctor: latest.rating_doctor ?? 5,
                    rating_cleanliness: latest.rating_cleanliness ?? 5,
                    comments: latest.comments || "",
                    suggestions: latest.suggestions || "",
                })
            } else {
                setForm({
                    rating_nursing: 5,
                    rating_doctor: 5,
                    rating_cleanliness: 5,
                    comments: "",
                    suggestions: "",
                })
            }
        } catch (e) {
            const s = e?.response?.status
            // backend might return 404 if none exists — treat as empty state
            if (s && s !== 404) {
                setErr(e?.response?.data?.detail || "Failed to load feedback")
            }
            setItems([])
            setCurrent(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        if (!admissionId || readOnly) return

        setSaving(true)
        setErr("")
        setNotice({ type: "", msg: "" })

        try {
            const payload = {
                rating_nursing: Math.min(5, Math.max(1, Number(form.rating_nursing) || 1)),
                rating_doctor: Math.min(5, Math.max(1, Number(form.rating_doctor) || 1)),
                rating_cleanliness: Math.min(5, Math.max(1, Number(form.rating_cleanliness) || 1)),
                comments: (form.comments || "").trim(),
                suggestions: (form.suggestions || "").trim(),
            }

            const res = await saveAdmissionFeedback(admissionId, payload)
            const saved = res?.data || payload

            // push into history (newest first)
            const nowIso = new Date().toISOString()
            const entry = {
                ...payload,
                ...saved,
                created_at: saved.created_at || saved.createdAt || saved.recorded_at || nowIso,
                updated_at: saved.updated_at || saved.updatedAt || null,
            }

            setCurrent(entry)
            setItems((prev) => {
                const next = [entry, ...(prev || [])]
                // de-dup by id if present
                const seen = new Set()
                return next.filter((x) => {
                    const k = x?.id ? `id:${x.id}` : `t:${x.created_at}:${x.rating_nursing}:${x.rating_doctor}:${x.rating_cleanliness}`
                    if (seen.has(k)) return false
                    seen.add(k)
                    return true
                })
            })

            setNotice({ type: "success", msg: "Feedback saved successfully." })
        } catch (e1) {
            const msg = e1?.response?.data?.detail || "Failed to save feedback"
            setNotice({ type: "danger", msg })
        } finally {
            setSaving(false)
        }
    }

    const resetToLatest = () => {
        if (!current) return
        setForm({
            rating_nursing: current.rating_nursing ?? 5,
            rating_doctor: current.rating_doctor ?? 5,
            rating_cleanliness: current.rating_cleanliness ?? 5,
            comments: current.comments || "",
            suggestions: current.suggestions || "",
        })
        setNotice({ type: "info", msg: "Reverted changes to latest saved feedback." })
    }

    return (
        <div className="p-2 md:p-4 space-y-4 text-slate-900">
            {/* Header / Hero */}
            <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 shadow-sm p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-base md:text-lg font-semibold tracking-tight">
                            Patient Feedback
                        </div>
                        <div className="text-xs md:text-sm text-slate-600 mt-1 leading-relaxed">
                            Capture patient/attendant satisfaction for this admission (NABH – Patient Satisfaction).
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {readOnly ? (
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                                <Lock className="h-4 w-4" />
                                Read only
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                                <Star className="h-4 w-4 fill-slate-900 text-slate-900" />
                                Overall: {overall}/5
                            </div>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="mt-4 animate-pulse space-y-2">
                        <div className="h-4 w-2/3 rounded bg-slate-200/70" />
                        <div className="h-4 w-1/2 rounded bg-slate-200/70" />
                    </div>
                ) : null}

                {err ? (
                    <div className="mt-4">
                        <Banner tone="danger" title="Couldn’t load feedback">
                            {err}
                        </Banner>
                    </div>
                ) : null}

                {notice?.msg ? (
                    <div className="mt-4">
                        <Banner tone={notice.type === "danger" ? "danger" : notice.type === "success" ? "success" : "info"}>
                            {notice.msg}
                        </Banner>
                    </div>
                ) : null}
            </div>

            {/* Form */}
            <form onSubmit={submit} className="rounded-3xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/70 bg-slate-50/60">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">Submit feedback</div>
                        <div className="text-xs text-slate-500">
                            {current?.created_at ? <>Last saved: <span className="font-semibold text-slate-700">{fmtIST(current.created_at)}</span></> : "Not submitted yet"}
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                        <StarRating
                            label="Nursing care"
                            hint="Helpfulness, response time, courtesy"
                            value={form.rating_nursing}
                            disabled={readOnly || saving}
                            onChange={(v) => setForm((s) => ({ ...s, rating_nursing: v }))}
                        />
                        <StarRating
                            label="Doctor communication"
                            hint="Clarity, time, explanation"
                            value={form.rating_doctor}
                            disabled={readOnly || saving}
                            onChange={(v) => setForm((s) => ({ ...s, rating_doctor: v }))}
                        />
                        <StarRating
                            label="Cleanliness & facilities"
                            hint="Room/ward hygiene, washrooms, comfort"
                            value={form.rating_cleanliness}
                            disabled={readOnly || saving}
                            onChange={(v) => setForm((s) => ({ ...s, rating_cleanliness: v }))}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold">Comments</label>
                                <div className="text-xs text-slate-500">{(form.comments || "").length}/500</div>
                            </div>
                            <textarea
                                className="mt-2 w-full min-h-[110px] resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                                placeholder="What went well? Any specific praise or concerns?"
                                value={form.comments}
                                disabled={readOnly || saving}
                                maxLength={500}
                                onChange={(e) => setForm((s) => ({ ...s, comments: e.target.value }))}
                            />
                        </div>

                        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold">Suggestions</label>
                                <div className="text-xs text-slate-500">{(form.suggestions || "").length}/500</div>
                            </div>
                            <textarea
                                className="mt-2 w-full min-h-[110px] resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                                placeholder="How can we improve your experience?"
                                value={form.suggestions}
                                disabled={readOnly || saving}
                                maxLength={500}
                                onChange={(e) => setForm((s) => ({ ...s, suggestions: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            <MessageSquareText className="h-4 w-4" />
                            Overall score: {overall}/5 • {ratingLabel(Math.round(overall))}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetToLatest}
                                disabled={saving || loading || !current}
                                className={cx(
                                    "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm",
                                    "hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                Revert
                            </button>

                            {canWrite ? (
                                <button
                                    type="submit"
                                    disabled={saving || loading || !admissionId}
                                    className={cx(
                                        "inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm",
                                        "hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {saving ? "Saving…" : "Save feedback"}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {!readOnly && (form.rating_nursing <= 2 || form.rating_doctor <= 2 || form.rating_cleanliness <= 2) ? (
                        <Banner tone="danger" title="Low rating detected">
                            Consider opening a service recovery ticket (patient relations / supervisor) to close the loop.
                        </Banner>
                    ) : null}
                </div>
            </form>

            {/* History */}
            <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/70 bg-slate-50/60">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">Feedback history</div>
                        <div className="text-xs text-slate-500">
                            {items?.length ? `${items.length} entr${items.length === 1 ? "y" : "ies"}` : "No submissions yet"}
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {!items?.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            No feedback submitted for this admission yet.
                        </div>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                            {items.map((x, idx) => {
                                const o = avg3(x.rating_nursing, x.rating_doctor, x.rating_cleanliness)
                                const when = x.updated_at || x.created_at
                                return (
                                    <div
                                        key={x.id || `${when || "t"}-${idx}`}
                                        className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-xs text-slate-500">Saved</div>
                                                <div className="text-sm font-semibold text-slate-900">{fmtIST(when)}</div>
                                            </div>

                                            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                                                <Star className="h-4 w-4 fill-slate-900 text-slate-900" />
                                                Overall {o}/5
                                            </div>
                                        </div>

                                        <div className="mt-3 grid gap-2 text-sm">
                                            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                                <span className="text-slate-600">Nursing</span>
                                                <span className="font-semibold">{x.rating_nursing ?? "—"}/5</span>
                                            </div>
                                            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                                <span className="text-slate-600">Doctor</span>
                                                <span className="font-semibold">{x.rating_doctor ?? "—"}/5</span>
                                            </div>
                                            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                                <span className="text-slate-600">Cleanliness</span>
                                                <span className="font-semibold">{x.rating_cleanliness ?? "—"}/5</span>
                                            </div>
                                        </div>

                                        {(x.comments || x.suggestions) ? (
                                            <div className="mt-3 space-y-2">
                                                {x.comments ? (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                                                        <div className="text-xs font-semibold text-slate-700">Comments</div>
                                                        <div className="mt-1 text-slate-800 whitespace-pre-wrap break-words">{x.comments}</div>
                                                    </div>
                                                ) : null}
                                                {x.suggestions ? (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                                                        <div className="text-xs font-semibold text-slate-700">Suggestions</div>
                                                        <div className="mt-1 text-slate-800 whitespace-pre-wrap break-words">{x.suggestions}</div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="mt-3 text-xs text-slate-500">No comments/suggestions.</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
