function parseApiDateUTC(s) {
    if (!s) return null
    const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(s)
    return new Date(hasTZ ? s : `${s}Z`) // ✅ treat timezone-missing as UTC
}

export function formatIST(s) {
    const d = parseApiDateUTC(s)
    if (!d) return ''
    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    })
}