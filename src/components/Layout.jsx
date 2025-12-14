// src/layout/Layout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AppFooter from './AppFooter'
import { useBranding } from '../branding/BrandingProvider'

export default function Layout() {
    const { branding } = useBranding() || {}
    const hasCustomBg = !!branding?.content_bg_color

    const rootStyle = hasCustomBg
        ? { backgroundColor: branding.content_bg_color, color: branding.text_color || undefined }
        : undefined

    return (
        <div
            className={hasCustomBg ? 'h-dvh' : 'h-dvh bg-gradient-to-b from-gray-50 to-white'}
            style={rootStyle}
        >
            {/* App Shell */}
            <div className="flex h-dvh overflow-hidden ">
                {/* Sticky Sidebar */}
                <Sidebar />

                {/* Main Column */}
                <div className="flex min-w-0 flex-1 flex-col ">
                    {/* Sticky Topbar */}
                    <header className="sticky top-0 z-40 shrink-0 border-b  backdrop-blur p-1 ">
                        <Topbar />
                    </header>

                    {/* Scroll Area (ONLY this scrolls) */}
                    <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
                        {/* ✅ NO mx-auto / NO huge max-width gap */}
                        <div className="w-full px-3 py-3 sm:px-4 lg:px-5">
                            <Outlet />
                        </div>

                        <div className="px-3 pb-3 sm:px-4 lg:px-5">
                            <AppFooter />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
