// src/opd/components/PdfPreviewModal.jsx
import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, ExternalLink, Download, Printer, RefreshCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

function cx(...xs) {
    return xs.filter(Boolean).join(" ")
}

export default function PdfPreviewModal({
    open,
    onClose,
    pdfUrl,
    title = "OPD Summary Preview",
    loading = false,
    error = "",
    onRegenerate,
    onOpenNewTab,
    onDownload,
    onPrint,
}) {
    // ESC close
    useEffect(() => {
        if (!open) return
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className="fixed inset-0 z-[80] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
                        onClick={onClose}
                    />

                    {/* panel */}
                    <motion.div
                        initial={{ y: 16, scale: 0.985, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: 10, scale: 0.99, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className={cx(
                            "relative w-[96vw] max-w-6xl",
                            "rounded-[28px] border border-white/30",
                            "bg-white shadow-[0_25px_80px_rgba(0,0,0,0.30)]"
                        )}
                    >
                        {/* header */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-black/10">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Preview
                                </div>
                                <div className="truncate text-[15px] md:text-[16px] font-semibold text-slate-900">
                                    {title}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/15 bg-white"
                                    onClick={onRegenerate}
                                    disabled={loading}
                                    title="Regenerate PDF"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCcw className="h-4 w-4" />
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/15 bg-white"
                                    onClick={onOpenNewTab}
                                    disabled={!pdfUrl || loading}
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/15 bg-white"
                                    onClick={onDownload}
                                    disabled={!pdfUrl || loading}
                                    title="Download"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>

                                <Button
                                    type="button"
                                    className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white"
                                    onClick={onPrint}
                                    disabled={!pdfUrl || loading}
                                    title="Print"
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print
                                </Button>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white hover:bg-black/[0.03]"
                                    title="Close"
                                >
                                    <X className="h-4 w-4 text-slate-700" />
                                </button>
                            </div>
                        </div>

                        {/* body */}
                        <div className="p-3 md:p-4">
                            <div className="rounded-[22px] border border-black/10 bg-slate-50 overflow-hidden">
                                {error ? (
                                    <div className="p-4 text-sm text-rose-700">{error}</div>
                                ) : loading && !pdfUrl ? (
                                    <div className="p-8 flex items-center justify-center gap-2 text-slate-600">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Generating PDF…
                                    </div>
                                ) : pdfUrl ? (
                                    <iframe
                                        title="OPD Summary PDF"
                                        src={pdfUrl}
                                        className="w-full h-[78vh] bg-white"
                                    />
                                ) : (
                                    <div className="p-6 text-sm text-slate-600">
                                        Click regenerate to build the PDF.
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
