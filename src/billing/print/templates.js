// FILE: src/billing/print/templates.js

export const BILLING_PRINT_TEMPLATES = [
    {
        key: "common_header",
        label: "Common Header (Header Only)",
        description: "Brand header + Bill/Patient/Encounter/Payer blocks",
        path: "/billing/print/common-header",
        supports: { doc_no: true, doc_date: true },
        filename: ({ caseNumber }) => `Billing_Header_${caseNumber || "CASE"}.pdf`,
    },

    // Future (keep disabled for now)
    {
        key: "full_case",
        label: "Full Case Download (Coming Soon)",
        description: "Overview + invoices + payments + advances + insurance + final bill",
        disabled: true,
    },
]
