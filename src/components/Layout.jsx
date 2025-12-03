import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useBranding } from '../branding/BrandingProvider'
import AppFooter from './AppFooter'

export default function Layout() {
    const { branding } = useBranding() || {}
    const hasCustomBg = !!branding?.content_bg_color

    const rootClass = hasCustomBg
        ? 'min-h-dvh'
        : 'min-h-dvh bg-gradient-to-b from-gray-50 to-white'

    const rootStyle = hasCustomBg
        ? {
            backgroundColor: branding.content_bg_color,
            color: branding.text_color || undefined,
        }
        : undefined

    return (
        <div className={rootClass} style={rootStyle}>
            <div className="flex min-h-dvh">
                {/* Sidebar: handles mobile drawer + collapse internally */}
                <Sidebar />

                {/* Main column */}
                <div className="flex min-h-dvh flex-1 flex-col">
                    {/* Sticky topbar */}
                    <Topbar />

                    {/* Scrollable content area */}
                    <main className="flex-1">
                        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                            <Outlet />
                        </div>
                        <div>
                            <AppFooter />
                        </div>
                    </main>
                </div>
               
            </div>
             
        </div>
    )
}
