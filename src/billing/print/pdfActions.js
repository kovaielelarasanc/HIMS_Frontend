// FILE: src/billing/print/pdfActions.js
import API from "@/api/client"

export async function fetchPdfBlob(path, { params } = {}) {
    const res = await API.get(path, {
        params,
        responseType: "blob",
    })
    return new Blob([res.data], { type: "application/pdf" })
}

export function openPdfPreview(blob, { title } = {}) {
    const url = URL.createObjectURL(blob)
    const win = window.open(url, "_blank", "noopener,noreferrer")
    // cleanup later (safe)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)

    if (!win) {
        // popup blocked -> fallback to same tab
        window.location.href = url
    } else if (title) {
        try {
            win.document.title = title
        } catch { }
    }
}

export function printPdfBlob(blob) {
    const url = URL.createObjectURL(blob)

    const w = window.open("", "_blank", "noopener,noreferrer")
    if (!w) {
        // popup blocked -> open preview (user can print manually)
        window.open(url, "_blank", "noopener,noreferrer")
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
    }

    // A small HTML shell with iframe so print works reliably
    w.document.open()
    w.document.write(`
<!doctype html>
<html>
<head>
  <title>Print</title>
  <meta charset="utf-8" />
  <style>
    html, body { margin:0; padding:0; height:100%; }
    iframe { border:0; width:100%; height:100%; }
  </style>
</head>
<body>
  <iframe id="pdfFrame" src="${url}"></iframe>
  <script>
    const f = document.getElementById('pdfFrame');
    f.onload = () => {
      try {
        setTimeout(() => { window.focus(); window.print(); }, 250);
      } catch (e) {}
    };
  </script>
</body>
</html>
  `)
    w.document.close()

    // cleanup later
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function downloadPdfBlob(blob, filename = "document.pdf") {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function toISODateParam(v) {
    // v can be "" / null / Date / string("YYYY-MM-DD")
    if (!v) return undefined
    if (typeof v === "string") return v
    if (v instanceof Date) {
        const yyyy = String(v.getFullYear())
        const mm = String(v.getMonth() + 1).padStart(2, "0")
        const dd = String(v.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
    }
    return undefined
}
