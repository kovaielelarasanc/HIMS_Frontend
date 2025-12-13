export default function Money({ value }) {
    const v = Number(value || 0)
    return (
        <span className="font-medium">
            ₹{v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
    )
}
