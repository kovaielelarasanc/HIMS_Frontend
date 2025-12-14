// FILE: frontend/src/layout/Topbar.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'
import { useBranding } from '../branding/BrandingProvider'

const defaultPrimary = '#0f172a'
const safeHex = (v) => typeof v === 'string' && v.startsWith('#') && v.length === 7
const alpha = (hex, a = '1A') => (safeHex(hex) ? `${hex}${a}` : undefined)

const getInitials = (name) => {
    const n = (name || '').trim()
    if (!n) return 'U'
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Topbar() {
    const user = useAuth((s) => s.user)
    const logout = useAuth((s) => s.logout)
    const fetchProfile = useAuth((s) => s.fetchProfile)

    const { toggleMobile } = useUI()
    const { branding } = useBranding() || {}

    const location = useLocation()

    const [now, setNow] = useState(new Date())
    const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const [menuOpen, setMenuOpen] = useState(false)
    const [spinning, setSpinning] = useState(false)
    const [syncing, setSyncing] = useState(false)

    const menuRef = useRef(null)
    const btnRef = useRef(null)

    // ---------- BRANDING ----------
    const primary = branding?.primary_color || defaultPrimary
    const topbarBg = branding?.topbar_bg_color || branding?.primary_color_dark || primary || defaultPrimary
    const topbarText = branding?.topbar_text_color || branding?.text_muted_color || '#e5e7eb'
    const iconColor = branding?.topbar_icon_color || branding?.icon_color || topbarText

    const orgName = (branding?.org_name || '').trim() || 'NUTRYAH'
    const orgTagline = (branding?.org_tagline || '').trim() || 'Smart • Secure • NABH-Standard'

    const userInitials = useMemo(
        () => getInitials(user?.name || user?.email),
        [user?.name, user?.email],
    )

    // ---------- CLOCK ----------
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])

    const timeLabel = useMemo(() => {
        try {
            return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        } catch {
            return now.toTimeString().slice(0, 8)
        }
    }, [now])

    const dateLabel = useMemo(() => {
        try {
            return now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })
        } catch {
            return now.toDateString()
        }
    }, [now])

    // ---------- ONLINE / OFFLINE ----------
    useEffect(() => {
        const update = () => setOnline(navigator.onLine)
        window.addEventListener('online', update)
        window.addEventListener('offline', update)
        return () => {
            window.removeEventListener('online', update)
            window.removeEventListener('offline', update)
        }
    }, [])

    // ---------- ROLE LABEL ----------
    const roleLabel = useMemo(() => {
        if (!user) return ''
        if (user.is_admin) return 'Admin'
        const roles = user.roles || []
        if (Array.isArray(roles) && roles.length) {
            const r0 = roles[0]
            if (typeof r0 === 'string') return r0
            return r0?.name || r0?.code || 'User'
        }
        return 'User'
    }, [user])

    // ---------- CLOSE MENU ON ROUTE CHANGE ----------
    useEffect(() => {
        setMenuOpen(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname])

    // ---------- OUTSIDE CLICK + ESC ----------
    useEffect(() => {
        if (!menuOpen) return

        const onDown = (e) => {
            const t = e.target
            if (menuRef.current?.contains(t)) return
            if (btnRef.current?.contains(t)) return
            setMenuOpen(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') setMenuOpen(false)
        }

        window.addEventListener('mousedown', onDown)
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('mousedown', onDown)
            window.removeEventListener('keydown', onKey)
        }
    }, [menuOpen])

    const hardRefresh = () => {
        setSpinning(true)
        setTimeout(() => window.location.reload(), 120)
    }

    const softSync = async () => {
        if (typeof fetchProfile !== 'function') return
        setSyncing(true)
        try {
            await fetchProfile()
        } finally {
            setTimeout(() => setSyncing(false), 500)
        }
    }

    const StatusDot = ({ ok }) => (
        <span
            title={ok ? 'Online' : 'Offline'}
            className={[
                'inline-block h-2.5 w-2.5 rounded-full ring-2',
                ok ? 'bg-emerald-500 ring-white/70' : 'bg-rose-500 ring-white/70',
            ].join(' ')}
        />
    )

    return (
        <header
            className="sticky top-0 z-[80] w-full border-b"
            style={{
                backgroundColor: topbarBg,
                color: topbarText,
                borderColor: alpha(primary, '33') || 'rgba(255,255,255,0.12)',
            }}
        >
            <div className="px-3 sm:px-4">
                <div className="h-14 flex items-center gap-3">
                    {/* LEFT */}
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-white/20 hover:bg-white/10 active:scale-95 transition"
                            onClick={toggleMobile}
                            aria-label="Open menu"
                            title="Menu"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                fill="none"
                                style={{ color: iconColor }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                            </svg>
                        </button>

                        {/* Brand (logo/initials + text) */}
                        <div className="flex items-center gap-2 min-w-0">
                            

                            <div className="min-w-0">
                                <div className="truncate text-[15px] sm:text-[16px] font-semibold tracking-tight">
                                    {orgName}
                                </div>
                                {orgTagline ? (
                                    <div className="hidden sm:block truncate text-[11px] opacity-90">
                                        {orgTagline}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* CENTER (desktop): status + date + time */}
                    <div className="hidden md:flex flex-1 items-center justify-center">
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[12px]">
                            <StatusDot ok={online} />
                            <span className="opacity-90">{dateLabel}</span>
                            <span className="opacity-60">•</span>
                            <span className="tabular-nums">{timeLabel}</span>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="ml-auto flex items-center gap-2">
                        {/* Mobile time pill */}
                        <div className="md:hidden inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs">
                            <StatusDot ok={online} />
                            <span className="tabular-nums">{timeLabel}</span>
                        </div>

                        {/* Sync (desktop) */}
                        <button
                            onClick={softSync}
                            className={[
                                'hidden sm:inline-flex h-10 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 text-sm',
                                syncing ? 'animate-pulse' : 'hover:bg-white/15',
                            ].join(' ')}
                            title="Sync profile"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className={['h-5 w-5', syncing ? 'animate-spin' : ''].join(' ')}
                                stroke="currentColor"
                                strokeWidth="1.7"
                                fill="none"
                                style={{ color: iconColor }}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12a7.5 7.5 0 0 1 13.5-4.5M19.5 12A7.5 7.5 0 0 1 6 16.5M3 12h3m12 0h3"
                                />
                            </svg>
                            <span>Sync</span>
                        </button>

                        {/* Refresh (desktop) */}
                        <button
                            onClick={hardRefresh}
                            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 text-sm hover:bg-white/15 active:scale-95 transition"
                            title="Refresh"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className={['h-5 w-5', spinning ? 'animate-spin' : ''].join(' ')}
                                stroke="currentColor"
                                strokeWidth="1.7"
                                fill="none"
                                style={{ color: iconColor }}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.023 9.348h4.992V4.356M21 12a9 9 0 1 1-3-6.708"
                                />
                            </svg>
                            <span>Refresh</span>
                        </button>

                        {/* Profile */}
                        <button
                            ref={btnRef}
                            onClick={() => setMenuOpen((v) => !v)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 pl-2 pr-3 hover:bg-white/15 transition"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            title="Account"
                        >
                            <div className="relative">
                                <div className="grid h-8 w-8 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/15">
                                    <span className="text-[12px] font-extrabold">{userInitials}</span>
                                </div>
                                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-black/20" />
                            </div>

                            <div className="hidden sm:block text-left leading-tight min-w-[9.5rem]">
                                <div className="truncate text-[13px] font-semibold">{user?.name || '—'}</div>
                                <div className="truncate text-[11px] opacity-90">{roleLabel}</div>
                            </div>

                            <svg
                                viewBox="0 0 24 24"
                                className={['hidden sm:block h-4 w-4 transition', menuOpen ? 'rotate-180' : ''].join(' ')}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                style={{ color: iconColor }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                            </svg>
                        </button>

                        {/* Dropdown */}
                        <div
                            ref={menuRef}
                            className={[
                                'absolute right-3 sm:right-4 top-[3.7rem] w-[18rem] origin-top-right',
                                'rounded-3xl border shadow-2xl overflow-hidden',
                                menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
                                'transition z-[85]',
                            ].join(' ')}
                            style={{
                                backgroundColor: '#ffffff',
                                borderColor: alpha(primary, '33') || '#e5e7eb',
                            }}
                        >
                            <div className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-11 w-11 place-items-center rounded-3xl border bg-slate-50">
                                        <span className="text-sm font-extrabold text-slate-900">{userInitials}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-black text-slate-900">{user?.name || '—'}</div>
                                        <div className="truncate text-xs text-slate-600">{roleLabel}</div>
                                        <div className="truncate text-[11px] text-slate-500">{user?.email || ''}</div>
                                    </div>
                                </div>

                                <div className="mt-3 grid gap-2">
                                    <button
                                        onClick={softSync}
                                        className="flex w-full items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                                        style={{ borderColor: '#e5e7eb' }}
                                    >
                                        <span className={syncing ? 'animate-spin' : ''}>
                                            <svg
                                                viewBox="0 0 24 24"
                                                className="h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.7"
                                                style={{ color: primary }}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M4.5 12a7.5 7.5 0 0 1 13.5-4.5M19.5 12A7.5 7.5 0 0 1 6 16.5M3 12h3m12 0h3"
                                                />
                                            </svg>
                                        </span>
                                        <span className="font-semibold text-slate-900">Sync</span>
                                    </button>

                                    <button
                                        onClick={hardRefresh}
                                        className="flex w-full items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                                        style={{ borderColor: '#e5e7eb' }}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            className={['h-5 w-5', spinning ? 'animate-spin' : ''].join(' ')}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            style={{ color: primary }}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M16.023 9.348h4.992V4.356M21 12a9 9 0 1 1-3-6.708"
                                            />
                                        </svg>
                                        <span className="font-semibold text-slate-900">Refresh</span>
                                    </button>

                                    <div className="my-1 h-px bg-slate-100" />

                                    <button
                                        onClick={logout}
                                        className="flex w-full items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-100"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 8l-4 4m0 0 4 4m-4-4h12"
                                            />
                                        </svg>
                                        <span className="font-extrabold">Logout</span>
                                    </button>
                                </div>
                            </div>

                            <div className="px-4 py-3 bg-slate-50 border-t text-[11px] text-slate-500">
                                {dateLabel} • <span className="tabular-nums">{timeLabel}</span> •{' '}
                                <span className={online ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                    {online ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
