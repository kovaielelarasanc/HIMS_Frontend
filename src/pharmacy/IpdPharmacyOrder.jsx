// FILE: src/pages/IpdPharmacyOrder.jsx
import PharmacyOrderForm from '../pharmacy/PharmacyOrderForm'

export default function IpdPharmacyOrder() {
    return (
        <PharmacyOrderForm
            orderType="IPD"
            title="IPD Ward Medication Orders"
            subtitle="Raise IPD ward medication orders linked to IPD admission. Orders flow to Pharmacy Rx Explorer with ward context."
        />
    )
}
