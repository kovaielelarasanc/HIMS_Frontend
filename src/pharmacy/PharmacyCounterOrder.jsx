// FILE: src/pages/PharmacyCounterOrder.jsx
import PharmacyOrderForm from '../pharmacy/PharmacyOrderForm'

export default function PharmacyCounterOrder() {
    return (
        <PharmacyOrderForm
            orderType="COUNTER"
            title="Pharmacy Counter / OTC Orders"
            subtitle="Create counter / OTC orders from Inventory medicines. Ideal for walk-in and quick sales via Rx → dispense → bill."
        />
    )
}
