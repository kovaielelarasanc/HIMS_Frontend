import QRCode from 'react-qr-code'

export default function QRCodeBadge({ value }) {
    if (!value) return null
    return (
        <div className="inline-flex items-center gap-2 rounded-xl border p-2 bg-white">
            <div className="h-16 w-16 bg-white p-1 rounded">
                <QRCode value={String(value)} size={56} />
            </div>
            <div className="text-sm">
                <div className="font-semibold">{value}</div>
                <div className="text-gray-500 text-xs">UHID</div>
            </div>
        </div>
    )
}
