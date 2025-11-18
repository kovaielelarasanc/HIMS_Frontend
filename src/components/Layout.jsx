// frontend/src/components/Layout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
    return (
        <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
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
                    </main>
                </div>
            </div>
        </div>
    )
}
