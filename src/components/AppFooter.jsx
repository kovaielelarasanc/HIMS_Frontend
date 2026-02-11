import { useBranding } from '../branding/BrandingProvider'

const defaultPrimary = '#2563eb' // fallback if no branding set

export default function AppFooter() {
    const { branding } = useBranding() || {}

    const primary = branding?.primary_color || defaultPrimary
    const bgColor = branding?.sidebar_bg_color || '#f9fafb'
    const textColor = branding?.text_color || '#4b5563'

    return (
        <footer
            className="w-full border-t text-xs sm:text-[13px]"
            style={{
                borderTopColor: primary,
                background: bgColor,
                color: textColor,
            }}
        >
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                {/* Left: Powered by */}
                <div className="font-medium">
                    Powered by{' '}
                    <span
                        className="font-semibold"
                        style={{ color: primary }}
                    >
                        NUTRYAH DIGITAL HEALTH
                    </span>
                </div>

                {/* Middle: Support */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">Support:</span>

                    <a
                        href="tel:+918870787448"
                        className="hover:underline"
                        style={{ color: primary }}
                    >
                        Mobile: +91 88707 87448
                    </a>

                    <span className="hidden text-slate-300 md:inline">•</span>

                    <a
                        href="mailto:info@nutryah.com"
                        className="hover:underline"
                        style={{ color: primary }}
                    >
                        Email: info@nutryah.com
                    </a>

                    <span className="hidden text-slate-300 md:inline">•</span>

                    <a
                        href="https://www.nutryah.com"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                        style={{ color: primary }}
                    >
                        Website: www.nutryah.com
                    </a>
                </div>

                {/* Right: Policies */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a
                        href="/privacy-policy"
                        className="hover:underline"
                        style={{ color: primary }}
                    >
                        Privacy Policy
                    </a>
                    <span className="text-slate-300">|</span>
                    <a
                        href="/terms-and-conditions"
                        className="hover:underline"
                        style={{ color: primary }}
                    >
                        Terms &amp; Conditions
                    </a>
                </div>
            </div>
        </footer>
    )
}
