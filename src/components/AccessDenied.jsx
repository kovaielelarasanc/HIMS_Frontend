export default function AccessDenied({ message = 'Access denied.' }) {
    return (
        <div className="p-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                {message}
            </div>
        </div>
    )
}
