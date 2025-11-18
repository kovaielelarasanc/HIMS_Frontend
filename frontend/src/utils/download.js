// export function downloadBlob(blob, filename = 'download.pdf') {
//     const url = URL.createObjectURL(blob)
//     const a = document.createElement('a')
//     a.href = url
//     a.download = filename
//     document.body.appendChild(a)
//     a.click()
//     a.remove()
//     URL.revokeObjectURL(url)
// }
export function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}
