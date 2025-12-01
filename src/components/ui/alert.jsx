// FILE: src/components/ui/alert.jsx
import React from "react";
import { cn } from "@/lib/utils";

export function Alert({ variant = "default", className, children, ...props }) {
    const base =
        "relative w-full rounded-lg border px-4 py-3 text-sm flex gap-3 items-start";
    const variants = {
        default: "bg-slate-50 border-slate-200 text-slate-800",
        destructive: "bg-rose-50 border-rose-200 text-rose-800",
    };

    return (
        <div
            role="alert"
            className={cn(base, variants[variant] || variants.default, className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function AlertTitle({ className, children, ...props }) {
    return (
        <div
            className={cn("font-semibold leading-tight text-sm", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function AlertDescription({ className, children, ...props }) {
    return (
        <div
            className={cn("text-xs mt-1 text-slate-700", className)}
            {...props}
        >
            {children}
        </div>
    );
}
