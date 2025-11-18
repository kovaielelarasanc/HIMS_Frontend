// src/components/ui/sonner.jsx
"use client"
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"

// Drop-in wrapper so you can `import { Toaster, toast } from "@/components/ui/sonner"`
export const Toaster = (props) => (
    <SonnerToaster
        position="top-right"
        richColors
        expand
        {...props}
    />
)

export const toast = sonnerToast
