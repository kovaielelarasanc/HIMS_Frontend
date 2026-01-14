// src/layout/Layout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AppFooter from './AppFooter'
import { useBranding } from '../branding/BrandingProvider'

export default function Layout() {
    const { branding } = useBranding() || {}

    const contentBg = branding?.content_bg_color || null
    const textColor = branding?.text_color || null

    const rootStyle =
        contentBg || textColor
            ? {
                ...(contentBg ? { backgroundColor: contentBg } : {}),
                ...(textColor ? { color: textColor } : {}),
            }
            : undefined

    return (
        <div
            className={[
                'w-full min-h-screen',
                // dvh = perfect mobile height, avoids address bar jump
                'h-[100dvh]',
                contentBg ? '' : 'bg-gradient-to-b from-gray-50 to-white',
            ].join(' ')}
            style={rootStyle}
        >
            {/* App Shell */}
            <div className="flex h-[100dvh] w-full overflow-hidden">
                {/* Sidebar (fixed on mobile, sticky on desktop) */}
                <Sidebar />

                {/* Main column */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Topbar */}
                    <header
                        className={[
                            'sticky top-0 z-40 shrink-0 border-b',
                            // ✅ premium glass feel but stable on all devices
                            'bg-black supports-[backdrop-filter]:bg-white/55 backdrop-blur-xl',
                        ].join(' ')}
                    >
                        <div className="p-2 sm:px-3">
                            <Topbar />
                        </div>
                    </header>

                    {/* Content scroll area (ONLY this scrolls) */}
                    <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <div className="w-full px-3 py-3 sm:px-4 lg:px-5">
                            <Outlet />
                        </div>

                        {/* Footer + safe area bottom */}
                        <div className="w-full px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-4 lg:px-5">
                            <AppFooter />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
