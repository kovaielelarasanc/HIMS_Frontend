// FILE: src/pages/OpdPharmacyOrder.jsx
import PharmacyOrderForm from '../pharmacy/PharmacyOrderForm'

export default function OpdPharmacyOrder() {
    return (
        <PharmacyOrderForm
            orderType="OPD"
            title="OPD Medication Orders"
            subtitle="Prescribe medicines for OPD visits from Inventory items. Orders appear in the Pharmacy Rx queue for dispensing and billing."
        />
    )
}
