// FILE: frontend/src/ot/ui/otFormKit.js

// ---------- helpers ----------
export function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}

export function formatDateTime(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function toTimeInput(value) {
    if (!value) return ''
    if (/^\d{2}:\d{2}$/.test(value)) return value
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
    return ''
}

export function nowHHMM() {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
}

// ---------- UI building blocks ----------
export function Section({ title, children }) {
    return (
        <div className="rounded-2xl border border-slate-500 bg-white/90 p-3 md:p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {title}
            </div>
            {children}
        </div>
    )
}

export function ToggleRow({ label, checked, onChange, disabled }) {
    return (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-500 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
            <span className="font-medium">{label}</span>
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                checked={!!checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
        </label>
    )
}

export function TextArea({ label, value, onChange, disabled, rows = 2, placeholder = '—' }) {
    return (
        <label className="flex flex-col gap-1 rounded-xl border border-slate-500 bg-slate-50 px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <textarea
                rows={rows}
                className="w-full resize-none rounded-md border border-slate-500 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </label>
    )
}

export function SelectPills({ label, value, options, onChange, disabled }) {
    return (
        <div className="rounded-xl border border-slate-500 bg-slate-50 px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-slate-700">{label}</div>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = (value || '') === opt.value
                    return (
                        <button
                            key={opt.value || 'empty'}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(opt.value)}
                            className={
                                'rounded-full px-3 py-1 text-[11px] font-semibold transition ' +
                                (active
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-100') +
                                ' disabled:cursor-not-allowed disabled:opacity-60'
                            }
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export function PhaseCard({ title, subtitle, done, time, onDoneChange, onTimeChange, disabled }) {
    return (
        <div className="rounded-2xl border border-slate-500 bg-slate-50/80 px-3 py-2.5 text-xs">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {title}{' '}
                <span className="font-normal normal-case text-slate-500">({subtitle})</span>
            </div>

            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                    checked={!!done}
                    disabled={disabled}
                    onChange={(e) => onDoneChange(e.target.checked)}
                />
                <span className="text-[11px] text-slate-800">Checklist completed</span>
            </label>

            <div className="mt-2 space-y-1">
                <label className="text-[11px] text-slate-600">Time</label>
                <input
                    type="time"
                    className="w-full rounded-xl border border-slate-500 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                    value={time || ''}
                    disabled={disabled}
                    onChange={(e) => onTimeChange(e.target.value)}
                />
            </div>
        </div>
    )
}
