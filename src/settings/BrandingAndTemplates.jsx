import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { UploadCloud, FileText, RefreshCcw } from 'lucide-react'

import {
  getBranding,
  updateBranding,
  uploadBrandingAssets,
  getBrandingContext,
  updateBrandingContext,
  uploadBrandingContextAssets,
  getPublicBranding,
} from '../api/settings'

import { useBranding } from '../branding/BrandingProvider'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import API from '@/api/client'
import { formatIST } from '@/ipd/components/timeZONE'

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

function useObjectUrl(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url
}

function isImageUrl(url = '') {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(url.split('?')[0])
}
function isPdfUrl(url = '') {
  return /\.pdf$/i.test(url.split('?')[0])
}

function AssetPicker({
  title,
  accept,
  currentUrl,
  pickedFile,
  setPickedFile,
  hint,
  boxHeight = 'h-28',
}) {
  const localUrl = useObjectUrl(pickedFile)

  const showUrl = localUrl || currentUrl
  const showImage = showUrl && (localUrl ? true : isImageUrl(showUrl))
  const showPdf = showUrl && !showImage && (localUrl ? pickedFile?.type === 'application/pdf' : isPdfUrl(showUrl))

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-600">{title}</Label>

      <div className={`border border-dashed border-slate-300 rounded-2xl p-3 ${boxHeight} flex flex-col items-center justify-center gap-2 bg-white`}>
        {showUrl ? (
          showImage ? (
            <img
              src={showUrl}
              alt="preview"
              className="max-h-14 w-auto rounded border border-slate-200 bg-white"
              onError={() => {
                // if broken url, just silently hide
              }}
            />
          ) : showPdf ? (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <FileText className="h-4 w-4" />
              <a className="underline" href={showUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center">Preview not available</p>
          )
        ) : (
          <p className="text-xs text-slate-400 text-center">No file uploaded</p>
        )}

        <label className="w-full">
          <div className="flex items-center justify-center gap-2 text-xs cursor-pointer">
            <UploadCloud className="h-4 w-4" />
            <span>Choose file</span>
          </div>
          <Input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
          />
        </label>

        {pickedFile && (
          <div className="flex items-center justify-between w-full">
            <p className="text-[11px] text-slate-500 truncate">{pickedFile.name}</p>
            <button
              type="button"
              className="text-[11px] text-rose-600 hover:underline"
              onClick={() => setPickedFile(null)}
            >
              remove
            </button>
          </div>
        )}

        {hint && <p className="text-[11px] text-slate-400 text-center">{hint}</p>}
      </div>
    </div>
  )
}

function buildGlobalFormFromApi(b) {
  return {
    org_name: b?.org_name || '',
    org_tagline: b?.org_tagline || '',
    org_address: b?.org_address || '',
    org_phone: b?.org_phone || '',
    org_email: b?.org_email || '',
    org_website: b?.org_website || '',
    org_gstin: b?.org_gstin || '',

    primary_color: b?.primary_color || '',
    primary_color_dark: b?.primary_color_dark || '',
    sidebar_bg_color: b?.sidebar_bg_color || '',
    content_bg_color: b?.content_bg_color || '',
    card_bg_color: b?.card_bg_color || '',
    border_color: b?.border_color || '',
    text_color: b?.text_color || '',
    text_muted_color: b?.text_muted_color || '',
    icon_color: b?.icon_color || '',
    icon_bg_color: b?.icon_bg_color || '',

    pdf_header_height_mm: typeof b?.pdf_header_height_mm === 'number' ? b.pdf_header_height_mm : '',
    pdf_footer_height_mm: typeof b?.pdf_footer_height_mm === 'number' ? b.pdf_footer_height_mm : '',
    pdf_show_page_number: typeof b?.pdf_show_page_number === 'boolean' ? b.pdf_show_page_number : true,

    letterhead_position: b?.letterhead_position || 'background',
  }
}

function buildPharmacyFormFromApi(ctx) {
  console.log(ctx, "phar");

  return {
    org_name: ctx?.org_name || '',
    org_tagline: ctx?.org_tagline || '',
    org_address: ctx?.org_address || '',
    org_phone: ctx?.org_phone || '',
    org_email: ctx?.org_email || '',
    org_website: ctx?.org_website || '',
    org_gstin: ctx?.org_gstin || '',

    license_no: ctx?.license_no || '',
    license_no2: ctx?.license_no2 || '',
    pharmacist_name: ctx?.pharmacist_name || '',
    pharmacist_reg_no: ctx?.pharmacist_reg_no || '',

    letterhead_position: ctx?.letterhead_position || 'background',
  }
}

export default function BrandingAndTemplates() {
  // provider cache update after save/upload
  const globalBrandingCtx = useBranding('default')
  const pharmacyBrandingCtx = useBranding('pharmacy')

  const [loading, setLoading] = useState(true)

  // ✅ admin-loaded data (so “already saved values” always show)
  const [globalAdmin, setGlobalAdmin] = useState(null)
  const [pharmacyAdmin, setPharmacyAdmin] = useState(null)
  const [pharmacyEffective, setPharmacyEffective] = useState(null)
  console.log(pharmacyEffective?.asset_version, "chhhhh");

  // forms
  const [globalForm, setGlobalForm] = useState({})
  const [pharmacyForm, setPharmacyForm] = useState({})

  // saving
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [savingPharmacy, setSavingPharmacy] = useState(false)

  // file picks (global)
  const [gLogo, setGLogo] = useState(null)
  const [gLoginLogo, setGLoginLogo] = useState(null)
  const [gFavicon, setGFavicon] = useState(null)
  const [gHeader, setGHeader] = useState(null)
  const [gFooter, setGFooter] = useState(null)
  const [gLetterhead, setGLetterhead] = useState(null)

  // file picks (pharmacy)
  const [pLogo, setPLogo] = useState(null)
  const [pHeader, setPHeader] = useState(null)
  const [pFooter, setPFooter] = useState(null)
  const [pLetterhead, setPLetterhead] = useState(null)

  const reloadAll = async () => {
    setLoading(true)
    try {
      const [gRes, pRes, effRes] = await Promise.all([
        getBranding(),
        getBrandingContext('pharmacy'),
        getPublicBranding('pharmacy'),
      ])
      setGlobalAdmin(gRes.data)
      setGlobalForm(buildGlobalFormFromApi(gRes.data))

      setPharmacyAdmin(pRes.data)
      setPharmacyForm(buildPharmacyFormFromApi(pRes.data))

      setPharmacyEffective(effRes.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load branding settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setGlobalField = (name, value) => setGlobalForm((p) => ({ ...p, [name]: value }))
  const setPharmacyField = (name, value) => setPharmacyForm((p) => ({ ...p, [name]: value }))

  const handleNumberChange = (setter) => (name) => (e) => {
    const v = e.target.value
    setter(name, v === '' ? '' : Number(v))
  }

  const saveGlobal = async (e) => {
    e?.preventDefault?.()
    setSavingGlobal(true)
    try {
      const payload = {
        ...globalForm,
        pdf_header_height_mm: globalForm.pdf_header_height_mm === '' ? null : Number(globalForm.pdf_header_height_mm),
        pdf_footer_height_mm: globalForm.pdf_footer_height_mm === '' ? null : Number(globalForm.pdf_footer_height_mm),
      }
      const { data } = await updateBranding(payload)
      setGlobalAdmin(data)
      setGlobalForm(buildGlobalFormFromApi(data))

      // ✅ update app cache
      globalBrandingCtx.setBranding?.(data)
      await globalBrandingCtx.refreshBranding?.()

      toast.success('Global branding saved')
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.detail || 'Failed to save global branding')
    } finally {
      setSavingGlobal(false)
    }
  }

  const savePharmacy = async (e) => {
    e?.preventDefault?.()
    setSavingPharmacy(true)
    try {
      const payload = { ...pharmacyForm }
      const { data } = await updateBrandingContext('pharmacy', payload)
      setPharmacyAdmin(data)
      setPharmacyForm(buildPharmacyFormFromApi(data))

      // ✅ refresh effective preview + provider cache
      const eff = await getPublicBranding('pharmacy')
      setPharmacyEffective(eff.data)
      await pharmacyBrandingCtx.refreshBranding?.()

      toast.success('Pharmacy branding saved')
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.detail || 'Failed to save pharmacy branding')
    } finally {
      setSavingPharmacy(false)
    }
  }

  const uploadGlobalAssets = async (e) => {
    e?.preventDefault?.()
    if (!gLogo && !gLoginLogo && !gFavicon && !gHeader && !gFooter && !gLetterhead) {
      toast.warning('Select at least one file to upload')
      return
    }
    try {
      const fd = new FormData()
      if (gLogo) fd.append('logo', gLogo)
      if (gLoginLogo) fd.append('login_logo', gLoginLogo)
      if (gFavicon) fd.append('favicon', gFavicon)
      if (gHeader) fd.append('pdf_header', gHeader)
      if (gFooter) fd.append('pdf_footer', gFooter)
      if (gLetterhead) fd.append('letterhead', gLetterhead)

      // ✅ also send position
      fd.append('letterhead_position', globalForm.letterhead_position || 'background')

      const { data } = await uploadBrandingAssets(fd)
      setGlobalAdmin(data)
      setGlobalForm(buildGlobalFormFromApi(data))

      globalBrandingCtx.setBranding?.(data)
      await globalBrandingCtx.refreshBranding?.()

      setGLogo(null)
      setGLoginLogo(null)
      setGFavicon(null)
      setGHeader(null)
      setGFooter(null)
      setGLetterhead(null)

      toast.success('Global assets uploaded')
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.detail || 'Failed to upload global assets')
    }
  }

  const uploadPharmacyAssets = async (e) => {
    e?.preventDefault?.()
    if (!pLogo && !pHeader && !pFooter && !pLetterhead) {
      toast.warning('Select at least one file to upload')
      return
    }
    try {
      const fd = new FormData()
      if (pLogo) fd.append('logo', pLogo)
      if (pHeader) fd.append('pdf_header', pHeader)
      if (pFooter) fd.append('pdf_footer', pFooter)
      if (pLetterhead) fd.append('letterhead', pLetterhead)
      fd.append('letterhead_position', pharmacyForm.letterhead_position || 'background')

      const { data } = await uploadBrandingContextAssets('pharmacy', fd)
      setPharmacyAdmin(data)
      setPharmacyForm(buildPharmacyFormFromApi(data))

      const eff = await getPublicBranding('pharmacy')
      setPharmacyEffective(eff.data)
      await pharmacyBrandingCtx.refreshBranding?.()

      setPLogo(null)
      setPHeader(null)
      setPFooter(null)
      setPLetterhead(null)

      toast.success('Pharmacy assets uploaded')
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.detail || 'Failed to upload pharmacy assets')
    }
  }

  const globalVer = globalAdmin?.asset_version || globalAdmin?.updated_at
  const pharmacyVer = pharmacyAdmin?.asset_version || pharmacyAdmin?.updated_at
  console.log(formatIST(pharmacyVer), "pharmacyVer");

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-7 w-64 mb-3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  function resolveMediaUrl(path) {
    if (!path) return ""
    if (/^https?:\/\//i.test(path)) return path
    const base = (API?.defaults?.baseURL || "").toString()
    const origin = base.replace(/\/api\/?$/, "").replace(/\/$/, "")
    return origin + path
  }

  function withVersion(url, v) {
    if (!url) return ""
    if (!v) return url
    return url.includes("?") ? `${url}&v=${encodeURIComponent(v)}` : `${url}?v=${encodeURIComponent(v)}`
  }

  console.log(withVersion(resolveMediaUrl(pharmacyEffective?.logo_url), pharmacyEffective?.asset_version), "check url");

  return (
    <motion.div
      className="p-6 space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customization &amp; Templates</h1>
          <p className="text-sm text-slate-500">
            Global hospital branding + Pharmacy licensed branding (context) with previews.
          </p>
        </div>

        <Button variant="outline" onClick={reloadAll} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Reload
        </Button>
      </div>

      <Card className="border border-slate-200 rounded-2xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">Branding Manager</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="global">
            <TabsList className="mb-4">
              <TabsTrigger value="global">Hospital (Global)</TabsTrigger>
              <TabsTrigger value="pharmacy">Pharmacy (Context)</TabsTrigger>
            </TabsList>

            {/* ======================= GLOBAL ======================= */}
            <TabsContent value="global" className="space-y-6">
              <form onSubmit={saveGlobal} className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-800">Organisation details</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Organisation name</Label>
                      <Input value={globalForm.org_name || ''} onChange={(e) => setGlobalField('org_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Tagline</Label>
                      <Input value={globalForm.org_tagline || ''} onChange={(e) => setGlobalField('org_tagline', e.target.value)} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-slate-600">Address</Label>
                      <Input value={globalForm.org_address || ''} onChange={(e) => setGlobalField('org_address', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Phone</Label>
                      <Input value={globalForm.org_phone || ''} onChange={(e) => setGlobalField('org_phone', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Email</Label>
                      <Input type="email" value={globalForm.org_email || ''} onChange={(e) => setGlobalField('org_email', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Website</Label>
                      <Input value={globalForm.org_website || ''} onChange={(e) => setGlobalField('org_website', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">GSTIN</Label>
                      <Input value={globalForm.org_gstin || ''} onChange={(e) => setGlobalField('org_gstin', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-800">Color palette</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField label="Primary color" name="primary_color" value={globalForm.primary_color} onChange={setGlobalField} />
                    <ColorField label="Primary dark" name="primary_color_dark" value={globalForm.primary_color_dark} onChange={setGlobalField} />
                    <ColorField label="Sidebar background" name="sidebar_bg_color" value={globalForm.sidebar_bg_color} onChange={setGlobalField} />
                    <ColorField label="Content background" name="content_bg_color" value={globalForm.content_bg_color} onChange={setGlobalField} />
                    <ColorField label="Card background" name="card_bg_color" value={globalForm.card_bg_color} onChange={setGlobalField} />
                    <ColorField label="Border color" name="border_color" value={globalForm.border_color} onChange={setGlobalField} />
                    <ColorField label="Text color" name="text_color" value={globalForm.text_color} onChange={setGlobalField} />
                    <ColorField label="Muted text color" name="text_muted_color" value={globalForm.text_muted_color} onChange={setGlobalField} />
                    <ColorField label="Icon color" name="icon_color" value={globalForm.icon_color} onChange={setGlobalField} />
                    <ColorField label="Icon background" name="icon_bg_color" value={globalForm.icon_bg_color} onChange={setGlobalField} />
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-800">PDF layout behaviour</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Header height (mm)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={globalForm.pdf_header_height_mm === '' ? '' : globalForm.pdf_header_height_mm}
                        onChange={handleNumberChange(setGlobalField)('pdf_header_height_mm')}
                        placeholder="Auto"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Footer height (mm)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={globalForm.pdf_footer_height_mm === '' ? '' : globalForm.pdf_footer_height_mm}
                        onChange={handleNumberChange(setGlobalField)('pdf_footer_height_mm')}
                        placeholder="Auto"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Page number</Label>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={!!globalForm.pdf_show_page_number}
                          onChange={(e) => setGlobalField('pdf_show_page_number', !!e.target.checked)}
                        />
                        <span>Show Page X of Y</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Letterhead position</Label>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          className="h-3 w-3"
                          value="background"
                          checked={(globalForm.letterhead_position || 'background') === 'background'}
                          onChange={(e) => setGlobalField('letterhead_position', e.target.value)}
                        />
                        Full-page background
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          className="h-3 w-3"
                          value="none"
                          checked={(globalForm.letterhead_position || 'background') === 'none'}
                          onChange={(e) => setGlobalField('letterhead_position', e.target.value)}
                        />
                        Disable letterhead
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={savingGlobal} className="min-w-[160px]">
                    {savingGlobal ? 'Saving…' : 'Save Global Branding'}
                  </Button>
                </div>
              </form>

              <div className="border-t border-slate-100" />

              <form onSubmit={uploadGlobalAssets} className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-800">Global Assets (with preview)</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AssetPicker
                    title="App Logo"
                    accept="image/*"
                    currentUrl={resolveMediaUrl(globalAdmin?.logo_url)}
                    pickedFile={gLogo}
                    setPickedFile={setGLogo}
                    hint="PNG / JPG"
                  />
                  <AssetPicker
                    title="Login Logo"
                    accept="image/*"
                    currentUrl={resolveMediaUrl(globalAdmin?.login_logo_url)}
                    pickedFile={gLoginLogo}
                    setPickedFile={setGLoginLogo}
                    hint="Optional"
                  />
                  <AssetPicker
                    title="Favicon"
                    accept="image/*,.ico"
                    currentUrl={resolveMediaUrl(globalAdmin?.favicon_url)}
                    pickedFile={gFavicon}
                    setPickedFile={setGFavicon}
                    hint="PNG / ICO"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AssetPicker
                    title="PDF Header Image"
                    accept="image/*"
                    currentUrl={resolveMediaUrl(globalAdmin?.pdf_header_url)}
                    pickedFile={gHeader}
                    setPickedFile={setGHeader}
                    hint="Used in all PDFs"
                  />
                  <AssetPicker
                    title="PDF Footer Image"
                    accept="image/*"
                    currentUrl={resolveMediaUrl(globalAdmin?.pdf_footer_url)}
                    pickedFile={gFooter}
                    setPickedFile={setGFooter}
                    hint="Used in all PDFs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AssetPicker
                    title="Letterhead (PDF/Image)"
                    accept="application/pdf,image/*"
                    currentUrl={resolveMediaUrl(globalAdmin?.letterhead_url)}
                    pickedFile={gLetterhead}
                    setPickedFile={setGLetterhead}
                    hint="PDF preferred for full-page letterhead"
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-600 font-medium">Asset refresh fix</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      We now use <span className="font-mono">asset_version</span> so previews update instantly after upload.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Current version: <span className="font-mono">{String(globalVer || '-')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="min-w-[160px]">
                    Upload Global Assets
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ======================= PHARMACY CONTEXT ======================= */}
            <TabsContent value="pharmacy" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
                <div className="space-y-6">
                  <form onSubmit={savePharmacy} className="space-y-6">
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-slate-800">Pharmacy identity (licensed)</h2>
                      <p className="text-xs text-slate-500">
                        This will be used ONLY for pharmacy PDFs/invoices when context=pharmacy.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Pharmacy name</Label>
                          <Input value={pharmacyForm.org_name || ''} onChange={(e) => setPharmacyField('org_name', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Tagline</Label>
                          <Input value={pharmacyForm.org_tagline || ''} onChange={(e) => setPharmacyField('org_tagline', e.target.value)} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs text-slate-600">Address</Label>
                          <Input value={pharmacyForm.org_address || ''} onChange={(e) => setPharmacyField('org_address', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Phone</Label>
                          <Input value={pharmacyForm.org_phone || ''} onChange={(e) => setPharmacyField('org_phone', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Email</Label>
                          <Input type="email" value={pharmacyForm.org_email || ''} onChange={(e) => setPharmacyField('org_email', e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">License No 1</Label>
                          <Input value={pharmacyForm.license_no || ''} onChange={(e) => setPharmacyField('license_no', e.target.value)} placeholder="Drug License No" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">License No 2 (optional)</Label>
                          <Input value={pharmacyForm.license_no2 || ''} onChange={(e) => setPharmacyField('license_no2', e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Pharmacist Name</Label>
                          <Input value={pharmacyForm.pharmacist_name || ''} onChange={(e) => setPharmacyField('pharmacist_name', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Pharmacist Reg No</Label>
                          <Input value={pharmacyForm.pharmacist_reg_no || ''} onChange={(e) => setPharmacyField('pharmacist_reg_no', e.target.value)} />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs text-slate-600">Letterhead position</Label>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                className="h-3 w-3"
                                value="background"
                                checked={(pharmacyForm.letterhead_position || 'background') === 'background'}
                                onChange={(e) => setPharmacyField('letterhead_position', e.target.value)}
                              />
                              Full-page background
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                className="h-3 w-3"
                                value="none"
                                checked={(pharmacyForm.letterhead_position || 'background') === 'none'}
                                onChange={(e) => setPharmacyField('letterhead_position', e.target.value)}
                              />
                              Disable letterhead
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={savingPharmacy} className="min-w-[160px]">
                        {savingPharmacy ? 'Saving…' : 'Save Pharmacy Branding'}
                      </Button>
                    </div>
                  </form>

                  <div className="border-t border-slate-100" />

                  <form onSubmit={uploadPharmacyAssets} className="space-y-4">
                    <h2 className="text-sm font-semibold text-slate-800">Pharmacy Assets (override)</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AssetPicker
                        title="Pharmacy Logo"
                        accept="image/*"
                        currentUrl={resolveMediaUrl(pharmacyAdmin?.logo_url)}
                        pickedFile={pLogo}
                        setPickedFile={setPLogo}
                        hint="Used in pharmacy screens/PDFs"
                      />
                      <AssetPicker
                        title="Pharmacy Letterhead (PDF/Image)"
                        accept="application/pdf,image/*"
                        currentUrl={resolveMediaUrl(pharmacyAdmin?.letterhead_url)}
                        pickedFile={pLetterhead}
                        setPickedFile={setPLetterhead}
                        hint="Overrides global letterhead for pharmacy PDFs"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AssetPicker
                        title="Pharmacy PDF Header"
                        accept="image/*"
                        currentUrl={resolveMediaUrl(pharmacyAdmin?.pdf_header_url)}
                        pickedFile={pHeader}
                        setPickedFile={setPHeader}
                      />
                      <AssetPicker
                        title="Pharmacy PDF Footer"
                        accept="image/*"
                        currentUrl={resolveMediaUrl(pharmacyAdmin?.pdf_footer_url)}
                        pickedFile={pFooter}
                        setPickedFile={setPFooter}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" className="min-w-[160px]">
                        Upload Pharmacy Assets
                      </Button>
                    </div>
                  </form>
                </div>

                {/* ✅ EFFECTIVE PREVIEW */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">Effective Pharmacy Preview</p>
                    <p className="text-[11px] text-slate-500 font-mono">{String(formatIST(pharmacyEffective?.asset_version) || formatIST(pharmacyVer) || '-')}</p>
                  </div>

                  <div className="rounded-xl border bg-white p-3">
                    <div className="flex items-center gap-3">
                      {pharmacyEffective?.logo_url ? (
                        <img src={resolveMediaUrl(pharmacyEffective?.logo_url)} alt="pharmacy logo" className="h-10 w-auto rounded border"
                          onError={(e) => {
                            // show fallback box if request fails
                            e.currentTarget.style.display = "none"
                            console.log(e, "check logo error");

                          }} />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-slate-100" />
                      )}

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{pharmacyEffective?.org_name || 'Pharmacy Name'}</p>
                        <p className="text-xs text-slate-500 truncate">{pharmacyEffective?.org_tagline || 'Tagline'}</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-700 space-y-1">
                      <p><span className="text-slate-500">License:</span> {pharmacyEffective?.license_no || '-'} {pharmacyEffective?.license_no2 ? ` / ${pharmacyEffective.license_no2}` : ''}</p>
                      <p><span className="text-slate-500">Pharmacist:</span> {pharmacyEffective?.pharmacist_name || '-'} {pharmacyEffective?.pharmacist_reg_no ? `(${pharmacyEffective.pharmacist_reg_no})` : ''}</p>
                      <p className="text-slate-500">{pharmacyEffective?.org_address || '-'}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Pharmacy invoices/PDFs must use <span className="font-mono">GET /settings/ui-branding/public?context=pharmacy</span>.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  )
}
