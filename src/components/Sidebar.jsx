import { NavLink, useLocation } from 'react-router-dom'
import { useMemo, useEffect, useState } from 'react'
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
  Truck,
  Boxes,
  History,
  AlertTriangle,
  ShoppingCart,
  RotateCcw,
  Factory,
  MapPin,
  // NEW icons for LIS/RIS/OT/Billing
  FlaskConical,
  PackageOpen,
  Scan,
  LayoutTemplate,
  FileText,
  ScrollText,
  Stamp,
  Receipt,
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

/**
 * Item is visible if admin OR has ANY code in reqAny.
 * Group is visible if at least one of its items is visible.
 */
const GROUPS = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    icon: UsersIcon,
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
    label: 'patients masters',
    icon: UsersIcon,
    flatLink: { to: '/patients/masters', reqAny: ['patients.masters.view'] },
  },
  {
    key: 'MIS',
    label: 'MIS',
    icon: UsersIcon,
    flatLink: { to: '/mis', reqAny: ['mis.view'] },
  },
  {
    key: 'emr',
    label: 'Patients EMR',
    icon: UsersIcon,
    flatLink: { to: '/emr', reqAny: ['emr.view'] },
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    items: [
     
      // {
      //   key: 'pharmacy-sales',
      //   label: 'Counter Sale / OTC',
      //   to: '/pharmacy/sales',       // direct sale (no Rx)
      //   icon: ShoppingCart,
      //   reqAny: ['pharmacy.sales.create', 'pharmacy.sales.view'],
      // },
      // {
      //   key: 'pharmacy-billing',
      //   label: 'Pharmacy Billing',
      //   to: '/pharmacy/billing',     // billing console specific to pharmacy
      //   icon: Receipt,
      //   reqAny: ['pharmacy.billing.view', 'pharmacy.billing.create'],
      // },
      // {
      //   key: 'pharmacy-returns',
      //   label: 'Returns',
      //   to: '/pharmacy/returns',     // sale-level returns / credit notes
      //   icon: RotateCcw,
      //   reqAny: ['pharmacy.returns.view', 'pharmacy.returns.manage'],
      // },
      {
        key: 'pharmacy-inventory',
        label: 'Inventory & Stock',
        to: '/pharmacy/inventory',   // your existing inventory module
        icon: Boxes,
        reqAny: [
          'pharmacy.inventory.stock.view',
          'pharmacy.inventory.items.view',
          'pharmacy.inventory.po.view',
        ],
      },
      {
        key: 'pharmacy-barcode',
        label: 'Barcode / QR Lookup',
        to: '/inventory/barcode-lookup',
        icon: PackageOpen,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      // {
      //   key: 'pharmacy-barcode',
      //   label: 'pharmacy rx-exp',
      //   to: '/pharmacy/rx-explorer',
      //   icon: PackageOpen,
      //   reqAny: ['pharmacy.inventory.stock.view'],
      // },
      {
        key: 'pharmacy RX',
        label: 'pharmacy RX',
        to: '/pharmacy/rx',
        icon: PackageOpen,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      {
        key: 'pharmacy dispense',
        label: 'pharmacy dispense',
        to: '/pharmacy/dispense',
        icon: PackageOpen,
        reqAny: ['pharmacy.inventory.stock.view'],
      },
      // {
      //   key: 'IPD Pharma',
      //   label: 'IPD PHARMA',
      //   to: '/ipd/phramacy',
      //   icon: PackageOpen,
      //   reqAny: ['pharmacy.inventory.stock.view'],
      // },
      // {
      //   key: 'Counter Pharma',
      //   label: 'Counter',
      //   to: '/counter/phramacy',
      //   icon: PackageOpen,
      //   reqAny: ['pharmacy.inventory.stock.view'],
      // },
      // {
      //   key: 'OT pharma',
      //   label: 'OT PHARMA',
      //   to: '/ot/phramacy',
      //   icon: PackageOpen,
      //   reqAny: ['pharmacy.inventory.stock.view'],
      // },
    ],
  },

  // User Management
  {
    key: 'user-mgmt',
    label: 'User Management',
    icon: UsersIcon,
    items: [
      {
        key: 'departments',
        label: 'Departments',
        to: '/admin/departments',
        icon: Building2,
        reqAny: [
          'departments.view',
          'departments.create',
          'departments.update',
          'departments.delete',
        ],
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

  // // Templates
  // {
  //   key: 'templates',
  //   label: 'Templates',
  //   icon: LayoutTemplate,
  //   items: [
  //     {
  //       key: 'tpl-list',
  //       label: 'Templates',
  //       to: '/templates',
  //       icon: FileText,
  //       reqAny: ['templates.view', 'templates.manage'],
  //     },
  //     {
  //       key: 'tpl-generate',
  //       label: 'Generate Reports',
  //       to: '/templates/generate',
  //       icon: ScrollText,
  //       reqAny: ['templates.view', 'patients.view', 'emr.view'],
  //     },
  //     {
  //       key: 'consents',
  //       label: 'Patient Consents',
  //       to: '/templates/consents',
  //       icon: Stamp,
  //       reqAny: ['consents.view', 'patients.view'],
  //     },
  //   ],
  // },

  // OP
  // OP
  {
    key: 'op',
    label: 'OP',
    icon: Stethoscope,
    items: [
      {
        key: 'op-dashboard',
        label: 'Dashboard',
        to: '/opd/dashboard',
        icon: LayoutDashboard,
        reqAny: ['appointments.view', 'mis.opd.view'],
      },
      {
        key: 'appointments',
        label: 'Appointments',
        to: '/opd/appointments',
        icon: NotebookPen,
        reqAny: ['appointments.view', 'appointments.create'],
      },
      {
        key: 'triage',
        label: 'Vitals (Triage)',
        to: '/opd/triage',
        icon: Clock3,
        reqAny: ['vitals.create'],
      },
      {
        key: 'queue',
        label: 'Queue',
        to: '/opd/queue',
        icon: ListChecks,
        reqAny: ['appointments.view', 'visits.view'],
      },
      {
        key: 'followups',
        label: 'Follow-ups (Waiting)',
        to: '/opd/followups',
        icon: CalendarClock,
        // front desk / OP staff who can manage waiting follow-ups
        reqAny: ['appointments.view', 'appointments.update'],
      },
      {
        key: 'no-shows',
        label: 'No-show Reschedule',
        to: '/opd/no-shows',
        icon: History,
        // same permission as appointment reschedule
        reqAny: ['appointments.view', 'appointments.update'],
      },
      {
        key: 'OPD_Pharmacy',
        label: 'OPD_pharmacy',
        to: '/opd/phramacy',
        icon: History,
        // same permission as appointment reschedule
        reqAny: ['appointments.view', 'appointments.update'],
      },
    ],
  },


  // IP
  {
    key: 'ip',
    label: 'IP',
    icon: BedDouble,
    items: [
      {
        key: 'ipd-admissions',
        label: 'Admissions',
        to: '/ipd/admissions',
        icon: FilePlus2,
        reqAny: ['ipd.view', 'ipd.manage'],
      },
      {
        key: 'ipd-tracking',
        label: 'Tracking',
        to: '/ipd/tracking',
        icon: LayoutDashboard,
        reqAny: ['ipd.tracking.view'],
      },
      {
        key: 'ipd-my',
        label: 'My Admissions',
        to: '/ipd/my',
        icon: NotebookPen,
        reqAny: ['ipd.my.view', 'ipd.doctor'],
      },
      {
        key: 'ipd-discharged',
        label: 'Discharged',
        to: '/ipd/discharged',
        icon: Package,
        reqAny: ['ipd.discharged.view'],
      },
      {
        key: 'ipd-bedboard',
        label: 'Bedboard',
        to: '/ipd/bedboard',
        icon: BedDouble,
        reqAny: ['ipd.bedboard.view'],
      },
      {
        key: 'ipd-masters',
        label: 'IPD Masters',
        to: '/ipd/masters',
        icon: KeyRound,
        reqAny: ['ipd.masters.manage', 'ipd.packages.manage'],
      },
    ],
  },

  // Laboratory (LIS)
  {
    key: 'lab',
    label: 'Laboratory',
    icon: FlaskConical,
    items: [
      {
        key: 'lab-orders',
        label: 'Orders & Reporting',
        to: '/lab/orders',
        icon: FlaskConical,
        reqAny: [
          'lab.orders.view',
          'lab.orders.create',
          'orders.lab.view',
          'orders.lab.create',
        ],
      },
      {
        key: 'lab-masters',
        label: 'Lab Masters (NABL)',
        to: '/lab/masters',
        icon: KeyRound,
        reqAny: ['lab.masters.manage'],
      },
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
      {
        key: 'ris-masters',
        label: 'RIS Masters',
        to: '/ris/masters',
        icon: KeyRound,
        reqAny: ['radiology.masters.manage'],
      },
    ],
  },

  // Operation Theatre (OT)
  {
    key: 'ot',
    label: 'Operation Theatre',
    icon: Scan,
    items: [
      {
        key: 'ot-orders',
        label: 'OT Orders',
        to: '/ot/orders',
        icon: Scan,
        reqAny: ['ot.cases.view', 'ot.cases.create', 'ipd.view'],
      },
      {
        key: 'ot-masters',
        label: 'OT Masters',
        to: '/ot/masters',
        icon: KeyRound,
        reqAny: ['ot.masters.view', 'ot.masters.manage'],
      },
    ],
  },

  // Billing
  {
    key: 'billing',
    label: 'Billing',
    icon: Receipt,
    items: [
      {
        key: 'billing-console',
        label: 'Billing Console',
        to: '/billing',
        icon: LayoutDashboard,
        reqAny: ['billing.invoices.view', 'billing.invoices.create'],
      },
    ],
  },

  // Settings
  {
    key: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    items: [
      {
        key: 'schedules',
        label: 'Schedules',
        to: '/opd/schedules',
        icon: CalendarClock,
        reqAny: ['schedules.manage'],
      },
      // {
      //   key: 'opd-masters',
      //   label: 'OPD Masters',
      //   to: '/opd/masters',
      //   icon: KeyRound,
      //   reqAny: [
      //     'pharmacy.masters.manage',
      //     'lab.masters.manage',
      //     'radiology.masters.manage',
      //     'ipd.masters.manage',
      //   ],
      // },
      {
        key: 'ui-branding',
        label: 'Customization & Templates',
        to: '/settings/branding',
        icon: LayoutTemplate,
        reqAny: ['settings.customization.view', 'settings.customization.manage'],
      },
      {
        key: 'perm-logs',
        label: 'Permissions (Access Logs)',
        to: '/admin/permissions',
        icon: KeyRound,
        reqAny: [
          'permissions.view',
          'permissions.create',
          'permissions.update',
          'permissions.delete',
        ],
      },
    ],
  },
]

export default function Sidebar() {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules) || {}
  const location = useLocation()

  const {
    sidebarCollapsed: collapsed,
    toggleCollapse,
    sidebarMobileOpen,
    closeMobile,
  } = useUI()

  const { branding } = useBranding() || {}

  const primary = branding?.primary_color || defaultPrimary
  const sidebarBgColor = branding?.sidebar_bg_color || '#ffffff'
  const sidebarTextColor = branding?.text_color || '#111827'
  const iconColor = branding?.icon_color || primary
  const iconBgColor = branding?.icon_bg_color || 'rgba(37,99,235,0.08)'
  const activeBg = makeActiveBg(primary)
  const activeBorder = makeActiveBorder(primary)

  const orgName = (branding?.org_name || '').trim() || 'NABH HIMS'
  const orgTagline =
    (branding?.org_tagline || '').trim() || 'Smart • Secure • NABH-Standard'

  const initials = useMemo(() => {
    const n = branding?.org_name?.trim()
    if (!n) return 'NH'
    const parts = n.split(/\s+/).filter(Boolean)
    if (!parts.length) return 'NH'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }, [branding?.org_name])

  // Lock scroll when mobile drawer is open
  useEffect(() => {
    if (!sidebarMobileOpen) return
    const scrollY = window.scrollY
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      ob: document.documentElement.style.overscrollBehavior,
    }
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.position = prev.position || ''
      document.body.style.top = prev.top || ''
      document.body.style.width = prev.width || ''
      document.body.style.overflow = prev.overflow || ''
      document.documentElement.style.overscrollBehavior = prev.ob || ''
      window.scrollTo(0, scrollY)
    }
  }, [sidebarMobileOpen])

  const admin = !!user?.is_admin

  // Flatten permission codes into a Set
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

  const hasAny = (codes = []) => (admin ? true : codes.some((c) => grantedSet.has(c)))

  // Compute visible groups/items
  const groups = useMemo(() => {
    return GROUPS.map((g) => {
      if (g.flatLink) {
        const visible = hasAny(g.flatLink.reqAny)
        return { ...g, _visible: visible }
      }
      const items = (g.items || []).map((it) => ({
        ...it,
        _visible: hasAny(it.reqAny),
      }))
      const visible = items.some((it) => it._visible)
      return { ...g, items, _visible: visible }
    }).filter((g) => g._visible)
  }, [grantedSet, admin])

  const isGroupRouteActive = (g) => {
    if (g.flatLink) return location.pathname.startsWith(g.flatLink.to)
    return (g.items || []).some((it) => location.pathname.startsWith(it.to))
  }

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

  const desktopWidth = collapsed ? 'md:w-16' : 'md:w-64'

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={closeMobile}
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-sm transition-opacity md:hidden ${sidebarMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
      />

      {/* Sidebar */}
      <aside
        className={[
          'z-50 border-r transition-all duration-300 ease-out',
          'fixed left-0 top-0 h-[100dvh] w-[86vw] max-w-sm md:w-auto',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0 md:sticky md:top-0 md:h-[100dvh]',
          desktopWidth,
          'grid grid-rows-[auto,1fr,auto] min-h-0',
          'overflow-x-hidden overflow-y-hidden',
        ].join(' ')}
        style={{
          backgroundColor: sidebarBgColor,
          color: sidebarTextColor,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Logo"
                className="h-8 w-auto rounded-md border border-slate-200 bg-white"
              />
            ) : (
              <div
                className="grid h-8 w-8 place-items-center rounded-xl ring-1"
                style={{
                  backgroundColor: iconBgColor,
                  borderColor: activeBorder,
                }}
              >
                <span className="text-xs font-bold" style={{ color: iconColor }}>
                  {initials}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="truncate">
                <div className="text-xs font-semibold tracking-tight leading-snug">
                  {orgName}
                </div>
                {orgTagline && (
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {orgTagline}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile close */}
          <button
            onClick={closeMobile}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-50 active:scale-95 transition"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={toggleCollapse}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-50 active:scale-95 transition"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        {/* Menu */}
        <nav className="min-h-0 flex-1 overflow-y-auto no-scrollbar y-fade px-2 pb-4 pt-1 space-y-1 overscroll-contain touch-pan-y">
          {groups.map((group) => {
            // Flat single link
            if (group.flatLink) {
              const GIcon = group.icon || KeyRound
              return (
                <NavLink
                  key={group.key}
                  to={group.flatLink.to}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    [
                      'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm leading-none transition-colors duration-200 ease-out active:scale-[0.99]',
                      collapsed ? 'justify-center' : '',
                    ].join(' ')
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                        color: '#ffffff',
                        backgroundColor: primary,
                        boxShadow: `0 0 0 1px ${activeBorder}`,
                      }
                      : {
                        color: sidebarTextColor,
                      }
                  }
                  title={collapsed ? group.label : undefined}
                >
                  <GIcon
                    className="h-5 w-5 shrink-0"
                    style={{ color: isGroupRouteActive(group) ? '#ffffff' : iconColor }}
                  />
                  {!collapsed && (
                    <span className="transition-all duration-300">{group.label}</span>
                  )}
                </NavLink>
              )
            }

            // Dropdown group
            const GIcon = group.icon || KeyRound
            const isOpen = !!open[group.key] && !collapsed
            const active = isGroupRouteActive(group)

            return (
              <div key={group.key} className="rounded-xl">
                <button
                  type="button"
                  onClick={() => (collapsed ? null : toggleGroup(group.key))}
                  className={[
                    'w-full flex items-center gap-3 rounded-xl px-3 h-10 text-sm transition-colors duration-200 ease-out',
                    collapsed ? 'justify-center' : 'justify-between',
                  ].join(' ')}
                  title={collapsed ? group.label : undefined}
                  style={{
                    color: active ? primary : sidebarTextColor,
                    backgroundColor: active ? activeBg : 'transparent',
                    boxShadow: active ? `0 0 0 1px ${activeBorder}` : undefined,
                  }}
                >
                  <span className="flex items-center gap-3">
                    <GIcon className="h-5 w-5 shrink-0" style={{ color: iconColor }} />
                    {!collapsed && <span className="font-medium">{group.label}</span>}
                  </span>
                  {!collapsed && (
                    <ChevronDown
                      className={[
                        'h-4 w-4 transition-transform',
                        isOpen ? 'rotate-180' : '',
                      ].join(' ')}
                    />
                  )}
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="mt-1 space-y-1 pl-9">
                    {group.items
                      .filter((it) => it._visible)
                      .map((it) => {
                        const Ico = it.icon || KeyRound
                        return (
                          <NavLink
                            key={it.key}
                            to={it.to}
                            onClick={closeMobile}
                            className={() =>
                              'group relative flex h-9 items-center gap-2 rounded-lg px-2 text-sm leading-none transition-colors duration-200 ease-out active:scale-[0.99]'
                            }
                            style={({ isActive }) =>
                              isActive
                                ? {
                                  color: primary,
                                  backgroundColor: activeBg,
                                  boxShadow: `0 0 0 1px ${activeBorder}`,
                                }
                                : { color: sidebarTextColor }
                            }
                          >
                            <Ico
                              className="h-[18px] w-[18px] shrink-0"
                              style={{ color: iconColor }}
                            />
                            <span>{it.label}</span>
                          </NavLink>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}

          {groups.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              No modules granted. Contact administrator.
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-3">
          {!collapsed ? (
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
