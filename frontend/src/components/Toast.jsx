import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children, duration = 3500 }) {
    const [toasts, setToasts] = useState([]); // {id, type, message}

    const remove = useCallback((id) => {
        setToasts((t) => t.filter((x) => x.id !== id));
    }, []);

    const push = useCallback((type, message, opts = {}) => {
        const id = crypto.randomUUID();
        const d = opts.duration ?? duration;
        setToasts((t) => [...t, { id, type, message, duration: d }]);
        return id;
    }, [duration]);

    const api = useMemo(() => ({
        success: (m, o) => push("success", m, o),
        error: (m, o) => push("error", m, o),
        warn: (m, o) => push("warn", m, o),
        info: (m, o) => push("info", m, o),
    }), [push]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            {/* Toast viewport */}
            <div className="fixed right-4 top-4 z-[9999] flex w-[min(92vw,380px)] flex-col gap-2">
                {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />)}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
    return ctx;
}

function ToastItem({ toast, onClose }) {
    useEffect(() => {
        const id = setTimeout(onClose, toast.duration);
        return () => clearTimeout(id);
    }, [toast.duration, onClose]);

    const styles = {
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        error: "border-rose-200 bg-rose-50 text-rose-800",
        warn: "border-amber-200 bg-amber-50 text-amber-800",
        info: "border-blue-200 bg-blue-50 text-blue-800",
    }[toast.type] ?? "border-gray-200 bg-white text-gray-800";

    const Icon = {
        success: CheckCircle2,
        error: XCircle,
        warn: AlertTriangle,
        info: Info,
    }[toast.type] ?? Info;

    return (
        <div className={`flex items-start gap-3 rounded-xl border p-3 shadow-sm ${styles}`} role="status" aria-live="polite">
            <Icon className="mt-0.5 h-5 w-5" />
            <div className="flex-1 text-sm">{toast.message}</div>
            <button onClick={onClose} className="opacity-70 hover:opacity-100" aria-label="Close">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
