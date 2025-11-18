// frontend/src/components/FieldPicker.jsx
/**
 * Simple field-picker for inserting Jinja placeholders.
 * Keep in sync with backend context: patient, clinical, billing.
 */
const FIELDS = [
    {
        group: 'Patient',
        items: [
            ['UHID', '{{ patient.uhid }}'],
            ['Name', '{{ patient.name }}'],
            ['Gender', '{{ patient.gender }}'],
            ['DOB', '{{ patient.dob | datefmt("%d-%b-%Y") }}'],
            ['Phone', '{{ patient.phone }}'],
            ['Email', '{{ patient.email }}'],
            ['Address', '{{ patient.address }}'],
        ],
    },
    {
        group: 'Clinical (Last Visit)',
        items: [
            ['Visit Date', '{{ clinical.last_visit.date | datefmt("%d-%b-%Y") }}'],
            ['Doctor', '{{ clinical.last_visit.doctor }}'],
            ['Department', '{{ clinical.last_visit.department }}'],
            ['Chief Complaints', '{{ clinical.last_visit.chief_complaints }}'],
            ['Diagnosis', '{{ clinical.last_visit.diagnosis }}'],
        ],
    },
    {
        group: 'Lab Results (loop)',
        items: [
            `<table border="1" cellspacing="0" cellpadding="6">
  <tr><th>Test</th><th>Code</th><th>Status</th><th>Result</th><th>Units</th></tr>
  {% for r in clinical.lab_results %}
    <tr>
      <td>{{ r.test }}</td><td>{{ r.code }}</td>
      <td>{{ r.status }}</td><td>{{ r.result }}</td><td>{{ r.units }}</td>
    </tr>
  {% endfor %}
</table>`,
        ],
    },
    {
        group: 'Billing Summary',
        items: [
            ['Invoices Count', '{{ billing.summary.invoices_count }}'],
            ['Total', '{{ billing.summary.total_net }}'],
            ['Paid', '{{ billing.summary.total_paid }}'],
            ['Balance', '{{ billing.summary.balance }}'],
        ],
    },
]

export default function FieldPicker({ onInsert }) {
    return (
        <div className="border rounded-lg p-3 bg-white">
            <div className="text-sm font-semibold mb-2">Fields</div>
            <div className="space-y-4">
                {FIELDS.map((g, idx) => (
                    <div key={idx}>
                        <div className="text-xs font-semibold text-gray-600 mb-1">{g.group}</div>
                        {/* group types: either pairs or a single snippet (Lab loop) */}
                        {'items' in g && Array.isArray(g.items[0]) && (
                            <div className="flex flex-wrap gap-2">
                                {g.items.map(([label, token], i) => (
                                    <button
                                        key={`${idx}-${i}`}
                                        onClick={() => onInsert(token)}
                                        className="text-[11px] px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 border"
                                        title={token}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* Snippet case */}
                        {'items' in g && !Array.isArray(g.items[0]) && (
                            <button
                                onClick={() => onInsert(g.items[0])}
                                className="text-[11px] px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 border"
                                title="Insert lab table loop snippet"
                            >
                                Insert Lab Table Snippet
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
