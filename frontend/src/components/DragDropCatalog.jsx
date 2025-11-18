// frontend/src/components/DragDropCatalog.jsx
import { useMemo, useState } from 'react'

/**
 * Module-wise field catalog. You can extend these easily.
 * Tokens must be valid Jinja placeholders supported by your backend context.
 */
const CATALOG = {
    Patient: [
        { label: 'UHID', token: '{{ patient.uhid }}' },
        { label: 'Name', token: '{{ patient.name }}' },
        { label: 'Gender', token: '{{ patient.gender }}' },
        { label: 'DOB', token: '{{ patient.dob | datefmt("%d-%b-%Y") }}' },
        { label: 'Phone', token: '{{ patient.phone }}' },
        { label: 'Email', token: '{{ patient.email }}' },
        { label: 'Address', token: '{{ patient.address }}' },
    ],
    'Clinical — Last Visit': [
        { label: 'Visit Date', token: '{{ clinical.last_visit.date | datefmt("%d-%b-%Y") }}' },
        { label: 'Doctor', token: '{{ clinical.last_visit.doctor }}' },
        { label: 'Department', token: '{{ clinical.last_visit.department }}' },
        { label: 'Chief Complaints', token: '{{ clinical.last_visit.chief_complaints }}' },
        { label: 'Diagnosis', token: '{{ clinical.last_visit.diagnosis }}' },
    ],
    'Clinical — Lab Results (loop)': [
        {
            label: 'Lab Results Table',
            token: `<table border="1" cellspacing="0" cellpadding="6">
  <tr><th>Test</th><th>Code</th><th>Status</th><th>Result</th><th>Units</th></tr>
  {% for r in clinical.lab_results %}
    <tr>
      <td>{{ r.test }}</td><td>{{ r.code }}</td>
      <td>{{ r.status }}</td><td>{{ r.result }}</td><td>{{ r.units }}</td>
    </tr>
  {% endfor %}
</table>`,
        },
    ],
    Billing: [
        { label: 'Invoices Count', token: '{{ billing.summary.invoices_count }}' },
        { label: 'Total', token: '{{ billing.summary.total_net }}' },
        { label: 'Paid', token: '{{ billing.summary.total_paid }}' },
        { label: 'Balance', token: '{{ billing.summary.balance }}' },
    ],
}

export default function DragDropCatalog({ onInsert }) {
    const [active, setActive] = useState(() => new Set(Object.keys(CATALOG))) // all selected
    const [filter, setFilter] = useState('')

    const groups = useMemo(() => {
        const f = filter.trim().toLowerCase()
        const list = Object.entries(CATALOG)
            .filter(([g]) => active.has(g))
            .map(([group, items]) => {
                const filtered = f
                    ? items.filter(it => it.label.toLowerCase().includes(f) || it.token.toLowerCase().includes(f))
                    : items
                return { group, items: filtered }
            })
            .filter(g => g.items.length > 0)
        return list
    }, [active, filter])

    const toggle = (group) => {
        const next = new Set(active)
        next.has(group) ? next.delete(group) : next.add(group)
        setActive(next)
    }

    const onDragStart = (e, token) => {
        e.dataTransfer.setData('text/x-token', token)
        e.dataTransfer.setData('text/plain', token)
    }

    return (
        <div className="border rounded-lg p-3 bg-white space-y-3">
            <div className="text-sm font-semibold">Field Catalog</div>

            {/* Module checklist */}
            <div className="flex flex-wrap gap-2">
                {Object.keys(CATALOG).map((g) => (
                    <label key={g} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 bg-gray-50">
                        <input
                            type="checkbox"
                            checked={active.has(g)}
                            onChange={() => toggle(g)}
                        />
                        {g}
                    </label>
                ))}
            </div>

            {/* Filter */}
            <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search fields…"
                className="w-full border rounded px-2 py-1 text-sm"
            />

            {/* Draggable tokens */}
            <div className="space-y-4">
                {groups.map(({ group, items }) => (
                    <div key={group}>
                        <div className="text-[11px] font-semibold text-gray-600 mb-1">{group}</div>
                        <div className="flex flex-wrap gap-2">
                            {items.map((it, i) => (
                                <div
                                    key={i}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, it.token)}
                                    onDoubleClick={() => onInsert && onInsert(it.token)}
                                    className="cursor-grab active:cursor-grabbing text-[11px] px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 border"
                                    title="Drag into editor or double-click to insert"
                                >
                                    {it.label}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Manual token add */}
            <div className="pt-2 border-t">
                <div className="text-[11px] text-gray-600 mb-1">Custom token</div>
                <form onSubmit={(e) => {
                    e.preventDefault()
                    const val = e.target.elements.token.value.trim()
                    if (!val) return
                    onInsert && onInsert(val)
                    e.target.reset()
                }}>
                    <input name="token" placeholder='e.g. {{ my.custom }}' className="border rounded px-2 py-1 text-sm w-full" />
                    <button className="mt-2 w-full px-2 py-1 border rounded text-sm">Insert</button>
                </form>
            </div>
        </div>
    )
}
