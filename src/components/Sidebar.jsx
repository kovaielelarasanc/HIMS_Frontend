// src/layout/Sidebar.jsx
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'
import { useBranding } from '../branding/BrandingProvider'

import {
  Users as UsersIcon,
  Building2,
  ShieldCheck,
  KeyRound,
  Stethoscope,
  NotebookPen,
  ListChecks,
  Clock3,
  CalendarClock,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  LayoutDashboard,
  FilePlus2,
  BedDouble,
  Package,
  Pill,
  ClipboardList,
  Boxes,
  History,
  ShoppingCart,
  FlaskConical,
  Scan,
  LayoutTemplate,
  FileText,
  Receipt,
  Activity,
  BarChart2,
  Scissors,
  TestTube2,
  Settings2,
  CalendarDays,
  Microscope,
  Cpu,
  BookOpenText,
  Wallet,
  Database,
  Gauge,
  AlertTriangle
} from 'lucide-react'

const defaultPrimary = '#2563eb'
const makeActiveBg = (primary) => {
  if (!primary || !primary.startsWith('#') || primary.length !== 7) return '#eff6ff'
  return `${primary}1A`
}
const makeActiveBorder = (primary) => {
  if (!primary || !primary.startsWith('#') || primary.length !== 7) return '#bfdbfe'
  return `${primary}33`
}

// ✅ Provider code (no env)
const PROVIDER_TENANT_CODE = 'NUTRYAH'

function decodeJwtPayload(token) {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64url = parts[1]
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    return JSON.parse(atob(b64 + pad))
  } catch {
    return null
  }
}

function isProviderTenant() {
  const token = localStorage.getItem('access_token')
  const payload = decodeJwtPayload(token)

  const tokenTcode = String(payload?.tcode || '').trim().toUpperCase()
  const tenantCode = String(localStorage.getItem('tenant_code') || '').trim().toUpperCase()

  const provider = String(PROVIDER_TENANT_CODE).trim().toUpperCase()
  return (tokenTcode && tokenTcode === provider) || (tenantCode && tenantCode === provider)
}

/**
 * Item is visible if admin OR has ANY code in reqAny.
 * Group is visible if at least one of its items is visible.
 *
 * ✅ Added: providerOnly flag for provider screens.
 */
const GROUPS = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    flatLink: { to: '/dashboard', reqAny: ['patients.view'] },
  },
  {
    key: 'patients',
    label: 'Patients management',
    icon: UsersIcon,
    flatLink: {
      to: '/patients',
      reqAny: ['patients.view', 'patients.create', 'patients.update'],
    },
  },
  {
    key: 'patients masters',
    label: 'Patients masters',
    icon: ClipboardList,
    flatLink: { to: '/patients/masters', reqAny: ['patients.masters.view'] },
  },
  {
    key: 'MIS',
    label: 'MIS & Analytics',
    icon: BarChart2,
    flatLink: { to: '/mis', reqAny: ['mis.view'] },
  },
  {
    key: 'emr',
    label: 'Patients EMR',
    icon: FileText,
    flatLink: { to: '/emr', reqAny: ['emr.view'] },
  },

  // Pharmacy
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    items: [
      {
        key: 'pharmacy-inventory',
        label: 'Inventory & Stock',
        to: '/pharmacy/inventory',
        icon: Boxes,
        reqAny: [
          'pharmacy.inventory.stock.view',
          'pharmacy.inventory.items.view',
          'pharmacy.inventory.po.view',
        ],
      },
      {
        key: 'pharmacy-barcode-lookup',
        label: 'Barcode / QR Lookup',
        to: '/pharmacy/inventory/barcode-lookup',
        icon: Scan,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      {
        key: 'pharmacy-rx',
        label: 'Pharmacy RX',
        to: '/pharmacy/rx',
        icon: NotebookPen,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      {
        key: 'pharmacy-dispense',
        label: 'Pharmacy Dispense',
        to: '/pharmacy/dispense',
        icon: ShoppingCart,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      {
        key: 'pharmacy-supplier-ledger',
        label: 'Supplier Ledger',
        to: '/pharmacy/accounts/supplier-ledger',
        icon: BookOpenText,
        reqAny: [
          'pharmacy.accounts.supplier_ledger.view',
          'pharmacy.accounts.supplier_ledger.manage',
          'pharmacy.accounts.supplier_ledger.export',
        ],
      },
      {
        key: 'pharmacy-supplier-monthly-summary',
        label: 'Monthly Summary',
        to: '/pharmacy/accounts/supplier-monthly-summary',
        icon: CalendarDays,
        reqAny: [
          'pharmacy.accounts.supplier_ledger.view',
          'pharmacy.accounts.supplier_ledger.manage',
          'pharmacy.accounts.supplier_ledger.export',
        ],
      },
      {
        key: 'pharmacy-supplier-payments',
        label: 'Supplier Payments',
        to: '/pharmacy/accounts/supplier-payments',
        icon: Wallet,
        reqAny: [
          'pharmacy.accounts.supplier_ledger.view',
          'pharmacy.accounts.supplier_ledger.manage',
          'pharmacy.accounts.supplier_ledger.export',
        ],
      },
      {
        key: 'pharmacy-supplier-statement',
        label: 'Supplier Statement',
        to: '/pharmacy/accounts/supplier-statement',
        icon: FileText,
        reqAny: [
          'pharmacy.accounts.supplier_ledger.view',
          'pharmacy.accounts.supplier_ledger.manage',
          'pharmacy.accounts.supplier_ledger.export',
        ],
      },
      {
        key: "pharmacy-stock-alerts",
        label: "Stock Alerts",
        to: "/pharmacy/stock/alerts",
        icon: AlertTriangle,
        reqAny: [
          "pharmacy.stock.alerts.view",
          "pharmacy.stock.alerts.manage",
          "pharmacy.stock.alerts.export",
        ],
      },

    ],
  },

  // User Management
  {
    key: 'user-mgmt',
    label: 'User Management',
    icon: ShieldCheck,
    items: [
      {
        key: 'departments',
        label: 'Departments',
        to: '/admin/departments',
        icon: Building2,
        reqAny: ['departments.view', 'departments.create', 'departments.update', 'departments.delete'],
      },
      {
        key: 'roles',
        label: 'Roles',
        to: '/admin/roles',
        icon: ShieldCheck,
        reqAny: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'],
      },
      {
        key: 'users',
        label: 'Users',
        to: '/admin/users',
        icon: UsersIcon,
        reqAny: ['users.view', 'users.create', 'users.update', 'users.delete'],
      },
    ],
  },

  // OP
  {
    key: 'op',
    label: 'OP',
    icon: Stethoscope,
    items: [
      { key: 'op-dashboard', label: 'Dashboard', to: '/opd/dashboard', icon: LayoutDashboard, reqAny: ['appointments.view', 'mis.opd.view'] },
      { key: 'appointments', label: 'Appointments', to: '/opd/appointments', icon: CalendarClock, reqAny: ['appointments.view', 'appointments.create'] },
      { key: 'triage', label: 'Vitals (Triage)', to: '/opd/triage', icon: Activity, reqAny: ['vitals.create'] },
      { key: 'queue', label: 'Queue', to: '/opd/queue', icon: ListChecks, reqAny: ['appointments.view', 'visits.view'] },
      { key: 'followups', label: 'Follow-ups (Waiting)', to: '/opd/followups', icon: Clock3, reqAny: ['appointments.view', 'appointments.update'] },
      { key: 'no-shows', label: 'No-show Reschedule', to: '/opd/no-shows', icon: History, reqAny: ['appointments.view', 'appointments.update'] },
      { key: 'Doctor Fees', label: 'Doctor Fees', to: '/opd/doctor-fees', icon: Receipt, reqAny: ['appointments.view', 'appointments.update'] },
    ],
  },

  // IP
  {
    key: "ip",
    label: "IP",
    icon: BedDouble,
    items: [
      // ✅ NEW: IPD Dashboard
      {
        key: "ipd-dashboard",
        label: "Dashboard",
        to: "/ipd/dashboard",
        icon: Gauge, // or LayoutDashboard for same look
        reqAny: ["ipd.dashboard.view", "ipd.view", "ipd.manage"],
      },

      { key: "ipd-admissions", label: "Admissions", to: "/ipd/admissions", icon: FilePlus2, reqAny: ["ipd.view", "ipd.manage"] },
      { key: "ipd-tracking", label: "Tracking", to: "/ipd/tracking", icon: LayoutDashboard, reqAny: ["ipd.tracking.view"] },
      { key: "ipd-my", label: "My Admissions", to: "/ipd/my", icon: NotebookPen, reqAny: ["ipd.my.view", "ipd.doctor"] },
      { key: "ipd-discharged", label: "Discharged", to: "/ipd/discharged", icon: Package, reqAny: ["ipd.discharged.view"] },
      { key: "ipd-bedboard", label: "Bedboard", to: "/ipd/bedboard", icon: BedDouble, reqAny: ["ipd.bedboard.view"] },
      { key: "ipd-masters", label: "IPD Masters", to: "/ipd/masters", icon: KeyRound, reqAny: ["ipd.masters.manage", "ipd.packages.manage"] },
    ],
  },

  // Laboratory (LIS)
  {
    key: 'lab',
    label: 'Laboratory',
    icon: FlaskConical,
    items: [
      { key: 'lab-orders', label: 'Orders & Reporting', to: '/lab/orders', icon: TestTube2, reqAny: ['lab.orders.view', 'lab.orders.create', 'orders.lab.view', 'orders.lab.create'] },
      { key: 'lab-service-master', label: 'Lab Service Master', to: '/lab/service/masters', icon: Microscope, reqAny: ['lis.masters.services.view', 'lis.masters.services.create', 'lis.masters.services.update'] },
      { key: 'lab-device-mapping', label: 'Analyzer Device Mapping', to: '/lis/device-mapping', icon: Cpu, reqAny: ['lab.devices.view', 'lab.devices.manage'] },
      { key: 'lab-analyzer-staging', label: 'Analyzer Staging', to: '/lis/analyzer-staging', icon: Settings2, reqAny: ['lab.device_results.review', 'lab.devices.view'] },
      { key: 'lab-device-logs', label: 'Analyzer Logs', to: '/lis/device-logs', icon: History, reqAny: ['lab.device_logs.view', 'lab.devices.view'] },
      { key: 'lab-masters', label: 'Lab Masters (NABL)', to: '/lab/masters', icon: KeyRound, reqAny: ['lab.masters.manage'] },
    ],
  },

  // Radiology (RIS)
  {
    key: 'ris',
    label: 'Radiology',
    icon: Scan,
    items: [
      {
        key: 'ris-orders',
        label: 'Orders & Reporting',
        to: '/ris/orders',
        icon: Scan,
        reqAny: [
          'radiology.orders.view',
          'radiology.orders.create',
          'orders.ris.view',
          'orders.ris.create',
          'radiology.report.create',
          'radiology.report.approve',
          'radiology.schedule.manage',
          'radiology.scan.update',
        ],
      },
      { key: 'ris-masters', label: 'RIS Masters', to: '/ris/masters', icon: KeyRound, reqAny: ['radiology.masters.manage'] },
    ],
  },

  // Operation Theatre (OT)
  {
    key: 'ot',
    label: 'Operation Theatre',
    icon: Scissors,
    items: [
      {
        key: 'ot-masters',
        label: 'OT Masters',
        to: '/ot/masters',
        icon: Settings2,
        reqAny: [
          'ot.masters.view',
          'ot.specialities.view',
          'ot.procedures.view',
          'ot.masters.create',
          'ot.masters.update',
          'ot.masters.delete',
          'ot.specialities.create',
          'ot.specialities.update',
          'ot.specialities.delete',
          'ot.procedures.create',
          'ot.procedures.update',
          'ot.procedures.delete',
        ],
      },
      { key: 'ot-schedule', label: 'OT Schedule', to: '/ot/schedule', icon: CalendarDays, reqAny: ['ot.schedule.view'] },
    ],
  },

  // Billing
  {
    key: 'billing',
    label: 'Billing',
    icon: Receipt,
    items: [{ key: 'billing-console', label: 'Billing Console', to: '/billing', icon: LayoutDashboard, reqAny: ['billing.view', 'billing.create'] }],
  },

  // Settings
  {
    key: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    items: [
      { key: 'schedules', label: 'Schedules', to: '/opd/schedules', icon: CalendarClock, reqAny: ['schedules.manage'] },
      { key: 'ui-branding', label: 'Customization & Templates', to: '/settings/branding', icon: LayoutTemplate, reqAny: ['settings.customization.view', 'settings.customization.manage'] },
      { key: 'perm-logs', label: 'Permissions (Access Logs)', to: '/admin/permissions', icon: KeyRound, reqAny: ['permissions.view', 'permissions.create', 'permissions.update', 'permissions.delete'] },
    ],
  },

  // ✅ Provider-only
  {
    key: 'provider',
    label: 'Provider Console',
    icon: Database,
    items: [
      { key: 'master-migrations', label: 'Master Migrations', to: '/master/migrations', icon: Database, reqAny: ['master.migrations.view'], providerOnly: true },
    ],
  },
]

export default function Sidebar() {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules) || {}
  const location = useLocation()

  const { sidebarCollapsed: collapsed, toggleCollapse, sidebarMobileOpen, closeMobile } = useUI()
  const { branding } = useBranding() || {}

  // ✅ detect desktop (md and above) so collapse works ONLY on desktop
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 768px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e) => setIsDesktop(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    setIsDesktop(mq.matches)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  const effectiveCollapsed = !!collapsed && isDesktop // ✅ never collapsed on mobile

  const primary = branding?.primary_color || defaultPrimary
  const sidebarBgColor = branding?.sidebar_bg_color || '#ffffff'
  const sidebarTextColor = branding?.text_color || '#111827'
  const iconColor = branding?.icon_color || sidebarTextColor
  const iconBgColor = branding?.icon_bg_color || 'rgba(37,99,235,0.08)'
  const activeBg = makeActiveBg(primary)
  const activeBorder = makeActiveBorder(primary)

  const orgName = (branding?.org_name || '').trim() || 'NABH HIMS'
  const orgTagline = (branding?.org_tagline || '').trim() || 'Smart • Secure • NABH-Standard'
  const logoUrl =
    (branding?.org_logo_url || branding?.logo_url || branding?.logo || '').toString().trim() || null

  const initials = useMemo(() => {
    const n = branding?.org_name?.trim()
    if (!n) return 'NH'
    const parts = n.split(/\s+/).filter(Boolean)
    if (!parts.length) return 'NH'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }, [branding?.org_name])

  // ✅ Mobile: lock background scroll (keeps sidebar scroll perfect)
  useEffect(() => {
    if (!sidebarMobileOpen) return
    const prevOverflow = document.body.style.overflow
    const prevOb = document.documentElement.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevOverflow || ''
      document.documentElement.style.overscrollBehavior = prevOb || ''
    }
  }, [sidebarMobileOpen])

  // ✅ ESC to close on mobile
  useEffect(() => {
    if (!sidebarMobileOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMobile()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarMobileOpen, closeMobile])

  const admin = !!user?.is_admin
  const provider = useMemo(() => isProviderTenant(), [])

  const grantedSet = useMemo(() => {
    const fromModules = Object.values(modules)
      .flat()
      .map((p) => (typeof p === 'string' ? p : p?.code))
      .filter(Boolean)

    const fromUser = (user?.permissions || [])
      .map((p) => (typeof p === 'string' ? p : p?.code))
      .filter(Boolean)

    return new Set([...(fromModules || []), ...(fromUser || [])])
  }, [modules, user])

  const hasAny = (codes = []) => (admin ? true : (codes || []).some((c) => grantedSet.has(c)))

  const isGroupRouteActive = (g) => {
    if (g.flatLink) return location.pathname.startsWith(g.flatLink.to)
    return (g.items || []).some((it) => location.pathname.startsWith(it.to))
  }

  const groups = useMemo(() => {
    return GROUPS.map((g) => {
      if (g.flatLink) {
        const providerOk = g.flatLink?.providerOnly ? provider : true
        const visible = providerOk && hasAny(g.flatLink.reqAny)
        return { ...g, _visible: visible }
      }

      const items = (g.items || []).map((it) => {
        const providerOk = it.providerOnly ? provider : true
        return { ...it, _visible: providerOk && hasAny(it.reqAny) }
      })

      const visible = items.some((it) => it._visible)
      return { ...g, items, _visible: visible }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).filter((g) => g._visible)
  }, [admin, grantedSet, provider])

  const [open, setOpen] = useState({})
  useEffect(() => {
    const init = {}
    groups.forEach((g) => {
      init[g.key] = isGroupRouteActive(g)
    })
    setOpen((prev) => ({ ...prev, ...init }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const toggleGroup = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  // Desktop collapsed flyout
  const [flyoutKey, setFlyoutKey] = useState(null)
  useEffect(() => {
    if (!effectiveCollapsed) setFlyoutKey(null)
  }, [effectiveCollapsed])
  useEffect(() => {
    setFlyoutKey(null)
  }, [location.pathname])

  const desktopWidth = effectiveCollapsed ? 'md:w-16' : 'md:w-64'

  return (
    <>
      {/* ✅ Mobile overlay */}
      <div
        onClick={closeMobile}
        className={[
          'fixed inset-0 md:hidden transition-opacity',
          'bg-black/35 backdrop-blur-sm',
          sidebarMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          'z-[55]', // ✅ below sidebar (sidebar is z-[60])
        ].join(' ')}
      />

      {/* Desktop collapsed flyout overlay */}
      {effectiveCollapsed && flyoutKey ? (
        <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setFlyoutKey(null)} />
      ) : null}

      <aside
        className={[
          // ✅ always above overlay
          'z-[60] md:z-50',
          'border-r transition-[width,transform] duration-300 ease-out',
          // ✅ MOBILE FIX: full screen width so chevrons never go out
          'fixed left-0 top-0 h-[100dvh] w-[100vw] max-w-[100vw]',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0 md:sticky md:top-0 md:h-[100dvh] md:w-auto md:max-w-none',
          desktopWidth,
          'grid grid-rows-[auto,1fr,auto] min-h-0',
          'overflow-x-hidden overflow-y-hidden',
          'shadow-2xl md:shadow-none',
          'will-change-transform',
        ].join(' ')}
        style={{ backgroundColor: sidebarBgColor, color: sidebarTextColor }}
        aria-hidden={!isDesktop && !sidebarMobileOpen}
      >
        {/* Header */}
        <div
          className={
            effectiveCollapsed
              ? 'px-2 py-3 flex flex-col items-center gap-2'
              : 'px-3 py-3 flex items-center justify-between gap-2'
          }
        >
          <div
            className={
              effectiveCollapsed
                ? 'flex flex-col items-center gap-2'
                : 'flex items-center gap-2 min-w-0 flex-1'
            }
          >
            {/* Logo / Initials */}
            <div
              className={[
                'grid place-items-center rounded-2xl border shadow-sm overflow-hidden shrink-0',
                'h-10 w-10',
              ].join(' ')}
              style={{ backgroundColor: iconBgColor, borderColor: makeActiveBorder(primary) }}
              title={orgName}
            >
              <span className="text-sm font-extrabold tracking-tight" style={{ color: primary }}>
                {initials}
              </span>
            </div>

            {!effectiveCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold tracking-tight leading-snug truncate">{orgName}</div>
                {orgTagline ? (
                  <div className="text-[10px] leading-tight text-slate-500 truncate">{orgTagline}</div>
                ) : null}

                {provider ? (
                  <div
                    className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: activeBorder, color: primary, backgroundColor: activeBg }}
                  >
                    Provider
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Mobile close */}
          <button
            onClick={closeMobile}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-gray-50 active:scale-95 transition shrink-0"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" style={{ color: iconColor }} />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => {
              setFlyoutKey(null)
              toggleCollapse()
            }}
            className={[
              'hidden md:inline-flex items-center justify-center',
              effectiveCollapsed ? 'h-9 w-9 rounded-2xl' : 'h-8 w-8 rounded-xl',
              'hover:bg-gray-50 active:scale-95 transition',
            ].join(' ')}
            aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={effectiveCollapsed ? 'Expand' : 'Collapse'}
          >
            {effectiveCollapsed ? (
              <ChevronRight className="h-5 w-5" style={{ color: iconColor }} />
            ) : (
              <ChevronLeft className="h-5 w-5" style={{ color: iconColor }} />
            )}
          </button>
        </div>

        {/* Menu */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto no-scrollbar y-fade px-2 pb-4 pt-1 space-y-1 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {groups.map((group) => {
            if (group.flatLink) {
              const GIcon = group.icon || KeyRound
              const active = isGroupRouteActive(group)

              return (
                <NavLink
                  key={group.key}
                  to={group.flatLink.to}
                  onClick={closeMobile}
                  className={[
                    'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm leading-none',
                    'transition-colors duration-200 ease-out active:scale-[0.99]',
                    'min-w-0',
                    effectiveCollapsed ? 'justify-center' : '',
                  ].join(' ')}
                  style={({ isActive }) =>
                    isActive
                      ? { color: '#ffffff', backgroundColor: primary, boxShadow: `0 0 0 1px ${activeBorder}` }
                      : { color: sidebarTextColor }
                  }
                  title={effectiveCollapsed ? group.label : undefined}
                >
                  <GIcon className="h-5 w-5 shrink-0" style={{ color: active ? '#ffffff' : iconColor }} />
                  {!effectiveCollapsed && <span className="truncate min-w-0">{group.label}</span>}
                </NavLink>
              )
            }

            const GIcon = group.icon || KeyRound
            const active = isGroupRouteActive(group)
            const isOpen = !!open[group.key] && !effectiveCollapsed
            const isFlyoutOpen = effectiveCollapsed && flyoutKey === group.key

            return (
              <div key={group.key} className="relative rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    if (effectiveCollapsed) {
                      setFlyoutKey((k) => (k === group.key ? null : group.key))
                      return
                    }
                    toggleGroup(group.key)
                  }}
                  className={[
                    'w-full flex items-center rounded-xl px-3 h-10 text-sm',
                    'transition-colors duration-200 ease-out active:scale-[0.99]',
                    'min-w-0',
                    effectiveCollapsed ? 'justify-center' : 'justify-between gap-3',
                  ].join(' ')}
                  title={effectiveCollapsed ? group.label : undefined}
                  aria-expanded={effectiveCollapsed ? isFlyoutOpen : isOpen}
                  style={{
                    color: active ? primary : sidebarTextColor,
                    backgroundColor: active ? activeBg : 'transparent',
                    boxShadow: active ? `0 0 0 1px ${activeBorder}` : undefined,
                  }}
                >
                  <span className="flex items-center gap-3 min-w-0 flex-1">
                    <GIcon className="h-5 w-5 shrink-0" style={{ color: iconColor }} />
                    {!effectiveCollapsed && (
                      <span className="font-medium truncate min-w-0">{group.label}</span>
                    )}
                  </span>

                  {/* ✅ Chevron always visible (doesn't get pushed out) */}
                  {!effectiveCollapsed && (
                    <ChevronDown
                      className={[
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        isOpen ? 'rotate-180' : 'rotate-0',
                      ].join(' ')}
                      style={{ color: iconColor }}
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-1 pl-9 pr-1">
                    {group.items
                      .filter((it) => it._visible)
                      .map((it) => {
                        const Ico = it.icon || KeyRound
                        return (
                          <NavLink
                            key={it.key}
                            to={it.to}
                            onClick={closeMobile}
                            className="group relative flex h-9 items-center gap-2 rounded-lg px-2 text-sm leading-none transition-colors duration-200 ease-out active:scale-[0.99] min-w-0"
                            style={({ isActive }) =>
                              isActive
                                ? { color: primary, backgroundColor: activeBg, boxShadow: `0 0 0 1px ${activeBorder}` }
                                : { color: sidebarTextColor }
                            }
                          >
                            <Ico className="h-[18px] w-[18px] shrink-0" style={{ color: iconColor }} />
                            <span className="truncate min-w-0">{it.label}</span>
                          </NavLink>
                        )
                      })}
                  </div>
                )}

                {/* Desktop flyout */}
                {isFlyoutOpen ? (
                  <div className="absolute left-full top-0 ml-2 z-[70] hidden md:block w-72 rounded-2xl border border-slate-500 bg-white shadow-2xl overflow-hidden">
                    <div className="px-3 py-2 border-b bg-slate-50">
                      <div className="text-xs font-black text-slate-900">{group.label}</div>
                      <div className="text-[10px] text-slate-500">Select a page</div>
                    </div>

                    <div className="p-2 space-y-1 max-h-[70vh] overflow-y-auto no-scrollbar">
                      {group.items
                        .filter((it) => it._visible)
                        .map((it) => {
                          const Ico = it.icon || KeyRound
                          return (
                            <NavLink
                              key={it.key}
                              to={it.to}
                              onClick={() => {
                                setFlyoutKey(null)
                                closeMobile()
                              }}
                              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-slate-50 transition min-w-0"
                              style={({ isActive }) =>
                                isActive
                                  ? { color: primary, backgroundColor: activeBg, boxShadow: `0 0 0 1px ${activeBorder}` }
                                  : { color: '#0f172a' }
                              }
                            >
                              <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-500 bg-white shrink-0">
                                <Ico className="h-[18px] w-[18px]" style={{ color: iconColor }} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold truncate">{it.label}</div>
                                <div className="text-[10px] text-slate-500 truncate">{it.to}</div>
                              </div>
                            </NavLink>
                          )
                        })}
                    </div>

                    <div className="px-3 py-2 border-t bg-white flex justify-end">
                      <button
                        onClick={() => setFlyoutKey(null)}
                        className="rounded-xl border border-slate-500 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          {groups.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No modules granted. Contact administrator.</div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-3">
          {!effectiveCollapsed ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-500">
              Tip: Click the chevron to collapse the sidebar.
            </div>
          ) : (
            <div className="grid place-items-center text-[10px] text-gray-400">v1.0</div>
          )}
        </div>
      </aside>
    </>
  )
}
