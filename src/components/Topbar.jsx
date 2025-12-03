// FILE: frontend/src/layout/Topbar.jsx (or wherever your Topbar is)
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'
import { useBranding } from '../branding/BrandingProvider'

export default function Topbar() {
    const { user, logout, fetchProfile } = useAuth()
    const { toggleMobile } = useUI()
    const { branding } = useBranding() || {}

    const [now, setNow] = useState(new Date())
    const [online, setOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    )
    const [menuOpen, setMenuOpen] = useState(false)
    const [spinning, setSpinning] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // ---- BRANDING COLORS ----
    const primary = branding?.primary_color || '#0f172a'
    const primaryDark = branding?.primary_color_dark || null

    // Topbar background: prefer dark, fallback to primary, then default
    const topbarBg = primaryDark || primary || '#0f172a'

    // Topbar text = muted color
    const topbarText = branding?.text_muted_color || '#e5e7eb'
    // Icons = icon_color
    const iconColor = branding?.icon_color || topbarText

    const orgName = (branding?.org_name || '').trim() || 'NUTRYAH'
    const orgTagline =
        (branding?.org_tagline || '').trim() || 'Smart • Secure • NABH-Standard'

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        const update = () => setOnline(navigator.onLine)
        window.addEventListener('online', update)
        window.addEventListener('offline', update)
        return () => {
            window.removeEventListener('online', update)
            window.removeEventListener('offline', update)
        }
    }, [])

    const roleLabel = useMemo(() => {
        if (!user) return ''
        if (user.is_admin) return 'Admin'
        if (Array.isArray(user.roles) && user.roles.length) return user.roles[0]
        return 'User'
    }, [user])

    const timeLabel = useMemo(() => {
        try {
            return now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
        } catch {
            return now.toTimeString().slice(0, 8)
        }
    }, [now])

    const hardRefresh = () => {
        setSpinning(true)
        setTimeout(() => window.location.reload(), 120)
    }

    const softSync = async () => {
        setSyncing(true)
        try {
            await fetchProfile()
        } finally {
            setTimeout(() => setSyncing(false), 500)
        }
    }

    const Avatar = (
        <svg
            viewBox="0 0 24 24"
            className="h-9 w-9"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: iconColor }}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a8.25 8.25 0 1 1 15 0v.75H4.5v-.75Z"
            />
        </svg>
    )

    const StatusDot = ({ ok }) => (
        <span
            title={ok ? 'Online' : 'Offline'}
            className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'
                } ring-2 ring-white`}
        />
    )

    return (
        <header
            className="sticky top-0 z-30"
            style={{ backgroundColor: topbarBg, color: topbarText }}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
                {/* Left: brand + mobile hamburger */}
                <div className="flex items-center gap-2">
                    <button
                        className="md:hidden inline-flex items-center justify-center rounded-xl p-2 ring-1 ring-white/20 hover:bg-white/10 active:scale-95 transition"
                        onClick={toggleMobile}
                        aria-label="Open menu"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            style={{ color: iconColor }}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 7h16M4 12h16M4 17h16"
                            />
                        </svg>
                    </button>
                    <div className="flex flex-col">
                        <span
                            className="text-lg font-semibold tracking-tight sm:text-xl"
                            style={{ color: topbarText }}
                        >
                            {orgName}
                        </span>
                        {orgTagline && (
                            <span
                                className="hidden text-[11px] sm:inline-block"
                                style={{ color: topbarText }}
                            >
                                {orgTagline}
                            </span>
                        )}
                    </div>
                </div>

                {/* Center widgets */}
                <div className="hidden items-center gap-3 sm:flex">
                    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm">
                        <StatusDot ok={online} />
                        <span className="tabular-nums" style={{ color: topbarText }}>
                            {timeLabel}
                        </span>
                    </div>

                    <button
                        onClick={softSync}
                        className={`group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm transition ${syncing ? 'animate-pulse' : 'hover:bg-white/15'
                            }`}
                        title="Sync data"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-5 w-5 ${syncing ? 'animate-spin' : 'group-hover:rotate-90'
                                } transition`}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            style={{ color: iconColor }}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16 8V4m0 0h4m-4 0l2 2M8 16v4m0 0H4m4 0-2-2M6 8a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z"
                            />
                        </svg>
                        <span style={{ color: topbarText }}>Sync</span>
                    </button>

                    <button
                        onClick={hardRefresh}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/15 active:scale-95"
                        title="Refresh page"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-5 w-5 ${spinning ? 'animate-spin' : ''} transition`}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            style={{ color: iconColor }}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.023 9.348h4.992V4.356M21 12a9 9 0 1 1-3-6.708"
                            />
                        </svg>
                        <span style={{ color: topbarText }}>Refresh</span>
                    </button>
                </div>

                {/* Right: profile */}
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="group inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-2.5 py-1.5 transition hover:bg-white/15"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        title="Account"
                    >
                        <div className="relative">
                            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-emerald-500 p-1 ring-2 ring-[rgba(0,0,0,0.2)]" />
                            {Avatar}
                        </div>
                        <div className="hidden min-w-[9rem] text-left sm:block">
                            <div className="leading-tight">
                                <div className="truncate text-sm font-medium" style={{ color: topbarText }}>
                                    {user?.name || '—'}
                                </div>
                                <div className="truncate text-[11px]" style={{ color: topbarText }}>
                                    {roleLabel}
                                </div>
                            </div>
                        </div>
                        <svg
                            viewBox="0 0 24 24"
                            className={`hidden h-4 w-4 sm:block transition ${menuOpen ? 'rotate-180' : ''
                                }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            style={{ color: iconColor }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                    </button>

                    <div
                        className={`absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-gray-200 bg-gray-900 p-3 shadow-lg transition ${menuOpen
                                ? 'scale-100 opacity-100'
                                : 'pointer-events-none scale-95 opacity-0'
                            }`}
                    >
                        <div className="mb-3 flex items-center gap-3">
                            <div className="shrink-0">{Avatar}</div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-gray-100">
                                    {user?.name || '—'}
                                </div>
                                <div className="truncate text-xs text-gray-300">{roleLabel}</div>
                                <div className="truncate text-[11px] text-gray-300">
                                    {user?.email}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <button
                                onClick={softSync}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50 hover:text-black/90"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    style={{ color: iconColor }}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4.5 12a7.5 7.5 0 0 1 13.5-4.5M19.5 12A7.5 7.5 0 0 1 6 16.5M3 12h3m12 0h3"
                                    />
                                </svg>
                                <span>Sync data</span>
                            </button>

                            <button
                                onClick={hardRefresh}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50 hover:text-black/90"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className={`h-5 w-5 ${spinning ? 'animate-spin' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    style={{ color: iconColor }}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.023 9.348h4.992V4.356M21 12a9 9 0 1 1-3-6.708"
                                    />
                                </svg>
                                <span>Refresh page</span>
                            </button>

                            <div className="my-1 h-px bg-gray-100" />

                            <button
                                onClick={logout}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    style={{ color: iconColor }}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 8l-4 4m0 0 4 4m-4-4h12"
                                    />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
