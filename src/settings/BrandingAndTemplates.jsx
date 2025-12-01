// frontend/src/settings/BrandingAndTemplates.jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import { updateBranding, uploadBrandingAssets } from '../api/settings'
import { useBranding } from '../branding/BrandingProvider'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { UploadCloud } from 'lucide-react'

function ColorField({ label, name, value, onChange }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    type="color"
                    value={value || '#ffffff'}
                    onChange={(e) => onChange(name, e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(name, e.target.value)}
                    placeholder="#0f172a"
                    className="flex-1"
                />
            </div>
        </div>
    )
}

export default function BrandingAndTemplates() {
    const { branding, setBranding, loading } = useBranding() || {}

    const [form, setForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [uploadingFiles, setUploadingFiles] = useState(false)

    const [logoFile, setLogoFile] = useState(null)
    const [loginLogoFile, setLoginLogoFile] = useState(null)
    const [faviconFile, setFaviconFile] = useState(null)
    const [headerFile, setHeaderFile] = useState(null)
    const [footerFile, setFooterFile] = useState(null)

    // ---------- INIT FROM BACKEND ----------
    useEffect(() => {
        if (!branding) return
        setForm({
            // --- Organisation ---
            org_name: branding.org_name || '',
            org_tagline: branding.org_tagline || '',
            org_address: branding.org_address || '',
            org_phone: branding.org_phone || '',
            org_email: branding.org_email || '',
            org_website: branding.org_website || '',
            org_gstin: branding.org_gstin || '',

            // --- Colors ---
            primary_color: branding.primary_color || '',
            primary_color_dark: branding.primary_color_dark || '',
            sidebar_bg_color: branding.sidebar_bg_color || '',
            content_bg_color: branding.content_bg_color || '',
            card_bg_color: branding.card_bg_color || '',
            border_color: branding.border_color || '',
            text_color: branding.text_color || '',
            text_muted_color: branding.text_muted_color || '',
            icon_color: branding.icon_color || '',
            icon_bg_color: branding.icon_bg_color || '',

            // --- PDF numeric + boolean ---
            pdf_header_height_mm:
                typeof branding.pdf_header_height_mm === 'number'
                    ? branding.pdf_header_height_mm
                    : '',
            pdf_footer_height_mm:
                typeof branding.pdf_footer_height_mm === 'number'
                    ? branding.pdf_footer_height_mm
                    : '',
            pdf_show_page_number:
                typeof branding.pdf_show_page_number === 'boolean'
                    ? branding.pdf_show_page_number
                    : true,
        })
    }, [branding])

    // ---------- GENERIC FIELD HANDLERS ----------
    const setField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }))
    }

    const handleTextChange = (name) => (e) => {
        setField(name, e.target.value)
    }

    const handleNumberChange = (name) => (e) => {
        const v = e.target.value
        setField(name, v === '' ? '' : Number(v))
    }

    const handleCheckboxChange = (name) => (e) => {
        setField(name, !!e.target.checked)
    }

    const handleColorChange = (name, value) => {
        setField(name, value)
    }

    // ---------- SAVE BRANDING (ORG + COLORS + PDF SETTINGS) ----------
    const saveBranding = async () => {
        setSaving(true)
        try {
            const payload = {
                ...form,
                pdf_header_height_mm:
                    form.pdf_header_height_mm === '' ? null : Number(form.pdf_header_height_mm),
                pdf_footer_height_mm:
                    form.pdf_footer_height_mm === '' ? null : Number(form.pdf_footer_height_mm),
            }

            const { data } = await updateBranding(payload)
            setBranding?.(data)
            toast.success('Branding settings updated')
        } catch (err) {
            console.error('Failed to update branding settings', err)
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Could not save branding settings'
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveBranding = async (e) => {
        e.preventDefault()
        await saveBranding()
    }

    const handleSavePdfSettings = async (e) => {
        e.preventDefault()
        await saveBranding()
    }

    // ---------- FILE UPLOADS (LOGOS + HEADER/FOOTER) ----------
    const handleUploadAssets = async (e) => {
        e.preventDefault()
        if (!logoFile && !loginLogoFile && !faviconFile && !headerFile && !footerFile) {
            toast.warning('Select at least one file to upload')
            return
        }

        const formData = new FormData()
        if (logoFile) formData.append('logo', logoFile)
        if (loginLogoFile) formData.append('login_logo', loginLogoFile)
        if (faviconFile) formData.append('favicon', faviconFile)
        if (headerFile) formData.append('pdf_header', headerFile)
        if (footerFile) formData.append('pdf_footer', footerFile)

        setUploadingFiles(true)
        try {
            const { data } = await uploadBrandingAssets(formData)
            setBranding?.(data)
            toast.success('Branding files uploaded')

            // reset local file states
            setLogoFile(null)
            setLoginLogoFile(null)
            setFaviconFile(null)
            setHeaderFile(null)
            setFooterFile(null)
        } catch (err) {
            console.error('Failed to upload branding files', err)
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Could not upload branding files'
            toast.error(msg)
        } finally {
            setUploadingFiles(false)
        }
    }

    // ---------- LOADING SKELETON ----------
    if (loading || !branding) {
        return (
            <div className="p-6">
                <Skeleton className="h-7 w-64 mb-3" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    // ---------- UI ----------
    return (
        <motion.div
            className="p-6 space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                        Customization &amp; Templates
                    </h1>
                    <p className="text-sm text-slate-500">
                        Configure organisation identity, logo, UI colors, and global PDF header/footer
                        for all NABH HIMS documents.
                    </p>
                </div>
            </div>

            <Card className="border border-slate-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                        Global Branding &amp; PDF Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="branding">
                        <TabsList className="mb-4">
                            <TabsTrigger value="branding">Branding &amp; Organisation</TabsTrigger>
                            <TabsTrigger value="pdf">PDF Header / Footer &amp; Behaviour</TabsTrigger>
                        </TabsList>

                        {/* ---------- TAB 1: BRANDING & ORG INFO ---------- */}
                        <TabsContent value="branding" className="space-y-6">
                            <form onSubmit={handleSaveBranding} className="space-y-6">
                                {/* Organisation details */}
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-slate-800">
                                        Organisation details
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        These values appear on letterheads, EMR PDFs, discharge summaries and
                                        other NABH documents.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">Organisation name</Label>
                                            <Input
                                                value={form.org_name || ''}
                                                onChange={handleTextChange('org_name')}
                                                placeholder="Hospital / Clinic name"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">Tagline</Label>
                                            <Input
                                                value={form.org_tagline || ''}
                                                onChange={handleTextChange('org_tagline')}
                                                placeholder="Smart • Secure • NABH-Standard"
                                            />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label className="text-xs text-slate-600">Address</Label>
                                            <Input
                                                value={form.org_address || ''}
                                                onChange={handleTextChange('org_address')}
                                                placeholder="Address line for letterhead &amp; PDFs"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">Phone</Label>
                                            <Input
                                                value={form.org_phone || ''}
                                                onChange={handleTextChange('org_phone')}
                                                placeholder="+91-XXXXXXXXXX"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">Email</Label>
                                            <Input
                                                type="email"
                                                value={form.org_email || ''}
                                                onChange={handleTextChange('org_email')}
                                                placeholder="info@example.com"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">Website</Label>
                                            <Input
                                                value={form.org_website || ''}
                                                onChange={handleTextChange('org_website')}
                                                placeholder="https://your-hospital.com"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">GSTIN</Label>
                                            <Input
                                                value={form.org_gstin || ''}
                                                onChange={handleTextChange('org_gstin')}
                                                placeholder="GSTIN (optional, for bills)"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100" />

                                {/* Colors */}
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-slate-800">Color palette</h2>
                                    <p className="text-xs text-slate-500">
                                        Tune application colors. These drive sidebar, primary buttons and card
                                        backgrounds.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ColorField
                                            label="Primary color (buttons, highlights)"
                                            name="primary_color"
                                            value={form.primary_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Primary dark (topbar / hover)"
                                            name="primary_color_dark"
                                            value={form.primary_color_dark}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Sidebar background color"
                                            name="sidebar_bg_color"
                                            value={form.sidebar_bg_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Content background color"
                                            name="content_bg_color"
                                            value={form.content_bg_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Card background color"
                                            name="card_bg_color"
                                            value={form.card_bg_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Border color"
                                            name="border_color"
                                            value={form.border_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Text color"
                                            name="text_color"
                                            value={form.text_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Muted text color"
                                            name="text_muted_color"
                                            value={form.text_muted_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Icon color"
                                            name="icon_color"
                                            value={form.icon_color}
                                            onChange={handleColorChange}
                                        />
                                        <ColorField
                                            label="Icon background color"
                                            name="icon_bg_color"
                                            value={form.icon_bg_color}
                                            onChange={handleColorChange}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-3">
                                        {branding?.logo_url && (
                                            <img
                                                src={branding.logo_url}
                                                alt="Logo preview"
                                                className="h-8 w-auto rounded-sm border border-slate-200 bg-white"
                                            />
                                        )}
                                        <span className="text-xs text-slate-500">
                                            Logos &amp; PDF artwork are managed in the{' '}
                                            <span className="font-medium">PDF Header / Footer</span> tab.
                                        </span>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={saving}
                                        className="min-w-[140px]"
                                    >
                                        {saving ? 'Saving…' : 'Save branding'}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>

                        {/* ---------- TAB 2: PDF HEADER / FOOTER & BEHAVIOUR ---------- */}
                        <TabsContent value="pdf" className="space-y-6">
                            {/* File uploads */}
                            <form onSubmit={handleUploadAssets} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Application logo */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">
                                            Application logo (sidebar / topbar)
                                        </Label>
                                        <div className="border border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center gap-2">
                                            {branding?.logo_url && (
                                                <img
                                                    src={branding.logo_url}
                                                    alt="Logo"
                                                    className="h-8 w-auto rounded-sm border border-slate-200 bg-white mb-1"
                                                />
                                            )}
                                            <label className="w-full">
                                                <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
                                                    <UploadCloud className="h-4 w-4" />
                                                    <span>Choose logo (PNG / JPG)</span>
                                                </div>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) =>
                                                        setLogoFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            {logoFile && (
                                                <p className="text-[11px] text-slate-500 truncate w-full text-center">
                                                    {logoFile.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Login page logo */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">
                                            Login-page logo (optional)
                                        </Label>
                                        <div className="border border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center gap-2">
                                            {branding?.login_logo_url && (
                                                <img
                                                    src={branding.login_logo_url}
                                                    alt="Login logo"
                                                    className="h-8 w-auto rounded-sm border border-slate-200 bg-white mb-1"
                                                />
                                            )}
                                            <label className="w-full">
                                                <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
                                                    <UploadCloud className="h-4 w-4" />
                                                    <span>Choose login logo</span>
                                                </div>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) =>
                                                        setLoginLogoFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            {loginLogoFile && (
                                                <p className="text-[11px] text-slate-500 truncate w-full text-center">
                                                    {loginLogoFile.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Favicon */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">
                                            Favicon (browser tab icon)
                                        </Label>
                                        <div className="border border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center gap-2">
                                            {branding?.favicon_url && (
                                                <img
                                                    src={branding.favicon_url}
                                                    alt="Favicon"
                                                    className="h-6 w-6 rounded-sm border border-slate-200 bg-white mb-1"
                                                />
                                            )}
                                            <label className="w-full">
                                                <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
                                                    <UploadCloud className="h-4 w-4" />
                                                    <span>Choose favicon (PNG / ICO)</span>
                                                </div>
                                                <Input
                                                    type="file"
                                                    accept="image/*,.ico"
                                                    className="hidden"
                                                    onChange={(e) =>
                                                        setFaviconFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            {faviconFile && (
                                                <p className="text-[11px] text-slate-500 truncate w-full text-center">
                                                    {faviconFile.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* PDF HEADER */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">
                                            PDF header template (all documents)
                                        </Label>
                                        <div className="border border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center gap-2">
                                            {branding?.pdf_header_url && (
                                                <img
                                                    src={branding.pdf_header_url}
                                                    alt="PDF header"
                                                    className="h-12 w-auto rounded-sm border border-slate-200 bg-white mb-1"
                                                />
                                            )}
                                            <label className="w-full">
                                                <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
                                                    <UploadCloud className="h-4 w-4" />
                                                    <span>Choose header image</span>
                                                </div>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) =>
                                                        setHeaderFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            {headerFile && (
                                                <p className="text-[11px] text-slate-500 truncate w-full text-center">
                                                    {headerFile.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* PDF FOOTER */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">
                                            PDF footer template (all documents)
                                        </Label>
                                        <div className="border border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center gap-2">
                                            {branding?.pdf_footer_url && (
                                                <img
                                                    src={branding.pdf_footer_url}
                                                    alt="PDF footer"
                                                    className="h-12 w-auto rounded-sm border border-slate-200 bg-white mb-1"
                                                />
                                            )}
                                            <label className="w-full">
                                                <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
                                                    <UploadCloud className="h-4 w-4" />
                                                    <span>Choose footer image</span>
                                                </div>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) =>
                                                        setFooterFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            {footerFile && (
                                                <p className="text-[11px] text-slate-500 truncate w-full text-center">
                                                    {footerFile.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-[11px] text-slate-500 max-w-xl">
                                        These logo/header/footer templates will be applied to all PDF downloads
                                        (EMR, discharge summary, lab reports, invoices, etc.) to keep
                                        NABH-compliant formatting.
                                    </p>
                                    <Button
                                        type="submit"
                                        disabled={uploadingFiles}
                                        className="min-w-[160px]"
                                    >
                                        {uploadingFiles ? 'Uploading…' : 'Upload artwork'}
                                    </Button>
                                </div>
                            </form>

                            {/* PDF behaviour (heights, page number) */}
                            <form onSubmit={handleSavePdfSettings} className="space-y-4">
                                <div className="border-t border-slate-100 pt-4" />
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-slate-800">
                                        PDF layout behaviour
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Control reserved space for header/footer and whether to show
                                        &quot;Page X of Y&quot; in the footer.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">
                                                Header height (mm)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={form.pdf_header_height_mm === '' ? '' : form.pdf_header_height_mm}
                                                onChange={handleNumberChange('pdf_header_height_mm')}
                                                placeholder="Auto"
                                            />
                                            <p className="text-[11px] text-slate-400">
                                                Leave blank to auto-calc based on header image.
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">
                                                Footer height (mm)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={form.pdf_footer_height_mm === '' ? '' : form.pdf_footer_height_mm}
                                                onChange={handleNumberChange('pdf_footer_height_mm')}
                                                placeholder="Auto"
                                            />
                                            <p className="text-[11px] text-slate-400">
                                                Leave blank to auto-calc based on footer image.
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-slate-600">
                                                Page number in footer
                                            </Label>
                                            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    checked={!!form.pdf_show_page_number}
                                                    onChange={handleCheckboxChange('pdf_show_page_number')}
                                                />
                                                <span>Show &quot;Page X of Y&quot; on all PDFs</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-1">
                                    <Button
                                        type="submit"
                                        disabled={saving}
                                        className="min-w-[160px]"
                                    >
                                        {saving ? 'Saving…' : 'Save PDF settings'}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </motion.div>
    )
}
