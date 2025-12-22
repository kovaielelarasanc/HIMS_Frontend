// frontend/src/components/TemplateGallery.jsx

import { useMemo } from 'react'

/** Running header/footer that WeasyPrint understands */
export const RUNNING_CSS = `@page {
  size: A4;
  margin: 18mm 16mm 18mm 16mm;
}
header.tpl-header { position: running(doc-header); }
footer.tpl-footer { position: running(doc-footer); }
@page {
  @top-center { content: element(doc-header); }
  @bottom-center { content: element(doc-footer); }
}
body { font-family: system-ui, -NUTRYAH-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 12px; }
h1,h2,h3 { margin: 0 0 8px 0; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px; }`

const BLOCKS = {
    HeaderMinimal: `
<header class="tpl-header" style="font-size:12px;border-bottom:1px solid #ccc;padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
  <div>
    <div style="font-weight:700">Hospital Name</div>
    <div style="font-size:11px;">Address line 1, City</div>
  </div>
  <img src="/media/uploads/sample/hospital_logo.png" alt="Logo" style="height:28px"/>
</header>`.trim(),

    FooterMinimal: `
<footer class="tpl-footer" style="font-size:11px;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between;">
  <div>UHID: {{ patient.uhid }} | {{ patient.name }}</div>
  <div>Page: counter(page) / counter(pages)</div>
</footer>`.trim(),

    SignatureBlock: `
<div style="margin-top:60px;display:flex;gap:40px;">
  <div>Patient/Guardian Signature: __________________</div>
  <div>Doctor: __________________</div>
  <div>Witness: __________________</div>
</div>`.trim(),

    CoverPage: `
<section style="display:flex;flex-direction:column;min-height:240mm;justify-content:center;align-items:center;text-align:center;gap:8px;">
  <img src="/media/uploads/sample/hospital_logo.png" alt="Logo" style="height:64px;opacity:0.8"/>
  <h1 style="font-size:28px;">Patient Clinical Summary</h1>
  <div style="font-size:14px">UHID: {{ patient.uhid }} &nbsp; | &nbsp; {{ patient.name }}</div>
  <div style="margin-top:40px;font-size:12px;color:#666">Generated on {{ now }}</div>
</section>`.trim(),
}

const LAYOUTS = [
    {
        key: 'clinical_summary_v2',
        title: 'Clinical Summary — Header/Footer + Tables',
        category: 'report',
        html: `
<h1>Clinical Summary</h1>
<p><b>UHID:</b> {{ patient.uhid }}<br/>
<b>Name:</b> {{ patient.name }}<br/>
<b>Gender:</b> {{ patient.gender }}<br/>
<b>DOB:</b> {{ patient.dob | datefmt("%d-%b-%Y") }}</p>

{% if clinical.last_visit.date %}
<h3>Last Visit</h3>
<p><b>Date:</b> {{ clinical.last_visit.date | datefmt("%d-%b-%Y") }}<br/>
<b>Doctor:</b> {{ clinical.last_visit.doctor }}<br/>
<b>Department:</b> {{ clinical.last_visit.department }}<br/>
<b>Chief Complaints:</b> {{ clinical.last_visit.chief_complaints }}<br/>
<b>Diagnosis:</b> {{ clinical.last_visit.diagnosis }}</p>
{% endif %}

{% if clinical.lab_results %}
<h3>Recent Lab Results</h3>
<table border="1" cellspacing="0" cellpadding="6">
  <tr><th>Test</th><th>Code</th><th>Status</th><th>Result</th><th>Units</th></tr>
  {% for r in clinical.lab_results %}
    <tr>
      <td>{{ r.test }}</td><td>{{ r.code }}</td><td>{{ r.status }}</td><td>{{ r.result }}</td><td>{{ r.units }}</td>
    </tr>
  {% endfor %}
</table>
{% endif %}

{% if billing.summary %}
<h3>Billing Summary</h3>
<p>
<b>Invoices:</b> {{ billing.summary.invoices_count }} |
<b>Total:</b> {{ billing.summary.total_net }} |
<b>Paid:</b> {{ billing.summary.total_paid }} |
<b>Balance:</b> {{ billing.summary.balance }}
</p>
{% endif %}
`.trim(),
        css: RUNNING_CSS,
        header: BLOCKS.HeaderMinimal,
        footer: BLOCKS.FooterMinimal,
    },
    {
        key: 'general_consent_v2',
        title: 'General Consent — with Signature',
        category: 'consent',
        html: `
<h2 style="text-align:center;">General Consent for Treatment</h2>
<p><b>UHID:</b> {{ patient.uhid }}<br/>
<b>Patient Name:</b> {{ patient.name }}<br/>
<b>Date:</b> {{ now }}</p>

<p>
I, {{ patient.name }}, hereby give consent for the proposed {{ data.procedure_name }}
under the care of {{ data.doctor_name }}.
</p>

<p><b>Risks explained:</b> {{ data.risks_text }}</p>

${BLOCKS.SignatureBlock}
`.trim(),
        css: RUNNING_CSS,
        header: BLOCKS.HeaderMinimal,
        footer: BLOCKS.FooterMinimal,
    },
    {
        key: 'cover_plus_clinical',
        title: 'Cover Page + Clinical',
        category: 'report',
        html: `${BLOCKS.CoverPage}
<div style="page-break-before:always;"></div>
<h1>Clinical Details</h1>
<p><b>UHID:</b> {{ patient.uhid }} &nbsp; <b>Name:</b> {{ patient.name }}</p>
{% if clinical.last_visit.date %}
<p><b>Last Visit:</b> {{ clinical.last_visit.date | datefmt("%d-%b-%Y") }} — {{ clinical.last_visit.doctor }}</p>
{% endif %}
`.trim(),
        css: RUNNING_CSS,
        header: BLOCKS.HeaderMinimal,
        footer: BLOCKS.FooterMinimal,
    },
]

export default function TemplateGallery({ onUseLayout, onInsertBlock }) {
    const blocks = useMemo(() => [
        { key: 'HeaderMinimal', title: 'Header — Minimal', html: BLOCKS.HeaderMinimal },
        { key: 'FooterMinimal', title: 'Footer — Minimal', html: BLOCKS.FooterMinimal },
        { key: 'SignatureBlock', title: 'Signature Block', html: BLOCKS.SignatureBlock },
        { key: 'CoverPage', title: 'Cover Page', html: BLOCKS.CoverPage },
    ], [])

    return (
        <div className="border rounded-lg p-3 bg-white space-y-3">
            <div className="text-sm font-semibold">Template Gallery</div>

            {/* Full layouts */}
            <div className="space-y-2">
                {LAYOUTS.map(l => (
                    <div key={l.key} className="border rounded p-2">
                        <div className="text-sm font-medium">{l.title}</div>
                        <div className="text-[11px] text-gray-500 mb-2">Category: {l.category}</div>
                        <div className="flex gap-2">
                            <button
                                className="px-2 py-1 rounded text-sm border"
                                onClick={() => onUseLayout && onUseLayout(l)}
                            >Use Layout</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Blocks */}
            <div className="pt-2 border-t">
                <div className="text-sm font-semibold mb-2">Blocks</div>
                <div className="grid grid-cols-2 gap-2">
                    {blocks.map(b => (
                        <button
                            key={b.key}
                            className="border rounded p-2 text-left hover:bg-gray-50"
                            onClick={() => onInsertBlock && onInsertBlock(b.html)}
                            title="Insert into current editor"
                        >
                            <div className="text-xs font-medium">{b.title}</div>
                            <div className="text-[10px] text-gray-500">Click to insert</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
