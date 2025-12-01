// FILE: src/pages/OtConsumableOrder.jsx
import PharmacyOrderForm from '../pharmacy/PharmacyOrderForm'

export default function OtConsumableOrder() {
    return (
        <PharmacyOrderForm
            orderType="OT_CONSUMABLE"
            title="OT Consumables Orders"
            subtitle="Order OT consumables (sutures, implants, disposables) against IPD admission / OT case. Orders go to Pharmacy / OT store via Rx queue."
        />
    )
}
