import { create } from 'zustand'

const initialCollapsed = (() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false') } catch { return false }
})()

export const useUI = create((set) => ({
    sidebarCollapsed: initialCollapsed,
    sidebarMobileOpen: false,

    toggleCollapse: () => set((s) => {
        const v = !s.sidebarCollapsed
        localStorage.setItem('sidebarCollapsed', JSON.stringify(v))
        return { sidebarCollapsed: v }
    }),

    openMobile: () => set({ sidebarMobileOpen: true }),
    closeMobile: () => set({ sidebarMobileOpen: false }),
    toggleMobile: () => set((s) => ({ sidebarMobileOpen: !s.sidebarMobileOpen })),
}))
