import { useEffect } from 'react'

export default function Modal({ open, onClose, children }) {
    useEffect(() => {
        if (!open) return
        const onEsc = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('keydown', onEsc)
        return () => window.removeEventListener('keydown', onEsc)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-40">
            {/* overlay */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={onClose}
            />
            {/* panel */}
            <div
                role="dialog"
                aria-modal="true"
                className="absolute inset-0 z-50 grid place-items-center p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
                    {children}
                </div>
            </div>
        </div>
    )
}
