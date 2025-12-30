// FILE: src/ipd/tabs/ReportsTab.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Settings2,
  ListChecks,
  Loader2,
  ShieldCheck,
  RefreshCcw,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  listPdfTemplates,
  getPdfTemplate,
  fetchIpdCaseSheetPdf,
  fetchIpdDrugChartPdf,
} from "@/api/pdfReports";

const cx = (...a) => a.filter(Boolean).join(" ");

function toIsoQuery(v) {
  if (!v) return undefined;
  return v.length === 16 ? `${v}:00` : v;
}

function safeFilename(name) {
  return String(name || "report.pdf").replace(/[\\/:*?"<>|]+/g, "_");
}

function blobOpenInNewTab(blob, filename = "report.pdf") {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename(filename);
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function blobDownload(blob, filename = "report.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function pickDefaultTemplate(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    items.find((t) => t?.code === "case_sheet" && t?.is_active) ||
    items.find((t) => t?.is_active) ||
    items[0] ||
    null
  );
}

export default function ReportsTab({ admissionId }) {
  const mountedRef = useRef(true);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesErr, setTemplatesErr] = useState("");

  const [templateId, setTemplateId] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  const [busyKey, setBusyKey] = useState(""); // "case.preview" | "case.download" | "drug.preview" | "drug.download"

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enabledSections = useMemo(() => {
    const secs = template?.sections || [];
    return secs
      .slice()
      .sort((a, b) => Number(a?.order ?? 9999) - Number(b?.order ?? 9999))
      .filter((s) => s?.enabled || s?.required);
  }, [template]);

  const periodError = useMemo(() => {
    if (!showAdvanced) return "";
    if (!periodFrom || !periodTo) return "";
    try {
      const a = new Date(toIsoQuery(periodFrom));
      const b = new Date(toIsoQuery(periodTo));
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
      if (a > b) return "From must be before To";
      return "";
    } catch {
      return "";
    }
  }, [showAdvanced, periodFrom, periodTo]);

  // Load templates for IPD
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplatesErr("");
    try {
      const data = await listPdfTemplates("ipd");
      const items = Array.isArray(data) ? data : data?.items || data || [];
      if (!mountedRef.current) return;

      setTemplates(items);

      const stillExists = items.some((t) => Number(t?.id) === Number(templateId));
      if (!stillExists) {
        const pick = pickDefaultTemplate(items);
        setTemplateId(pick?.id ? Number(pick.id) : null);
      }
    } catch (e) {
      console.error(e);
      if (!mountedRef.current) return;
      const msg = e?.message || "Failed to load PDF templates";
      setTemplates([]);
      setTemplatesErr(msg);
      toast.error(msg);
    } finally {
      if (mountedRef.current) setLoadingTemplates(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected template details
  useEffect(() => {
    const run = async () => {
      if (!templateId) {
        setTemplate(null);
        return;
      }
      setLoadingTemplate(true);
      try {
        const t = await getPdfTemplate(templateId);
        if (!mountedRef.current) return;
        setTemplate(t || null);
      } catch (e) {
        console.error(e);
        if (!mountedRef.current) return;
        setTemplate(null);
        toast.error(e?.message || "Failed to load template");
      } finally {
        if (mountedRef.current) setLoadingTemplate(false);
      }
    };
    run();
  }, [templateId]);

  const commonParams = useMemo(() => {
    const p = {};
    if (templateId) p.template_id = templateId;
    if (showAdvanced) {
      const pf = toIsoQuery(periodFrom);
      const pt = toIsoQuery(periodTo);
      if (pf) p.period_from = pf;
      if (pt) p.period_to = pt;
    }
    return p;
  }, [templateId, periodFrom, periodTo, showAdvanced]);

  const canRun = Boolean(admissionId);
  const anyBusy = busyKey !== "";

  const resetFilters = () => {
    setPeriodFrom("");
    setPeriodTo("");
    toast.success("Period cleared");
  };

  const doCaseSheetPreview = async () => {
    if (!canRun) return toast.error("Admission not selected");
    if (periodError) return toast.error(periodError);
    setBusyKey("case.preview");
    try {
      const res = await fetchIpdCaseSheetPdf(admissionId, commonParams);
      const blob = new Blob([res.data], { type: "application/pdf" });
      blobOpenInNewTab(blob, `IPD_CaseSheet_${admissionId}.pdf`);
      toast.success("Opened Case Sheet PDF");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || e?.message || "Failed to generate Case Sheet PDF");
    } finally {
      if (mountedRef.current) setBusyKey("");
    }
  };

  const doCaseSheetDownload = async () => {
    if (!canRun) return toast.error("Admission not selected");
    if (periodError) return toast.error(periodError);
    setBusyKey("case.download");
    try {
      const res = await fetchIpdCaseSheetPdf(admissionId, commonParams);
      const blob = new Blob([res.data], { type: "application/pdf" });
      blobDownload(blob, `IPD_CaseSheet_${admissionId}.pdf`);
      toast.success("Downloaded Case Sheet PDF");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || e?.message || "Failed to download Case Sheet PDF");
    } finally {
      if (mountedRef.current) setBusyKey("");
    }
  };

  // ✅ Drug Chart handlers
  const doDrugChartPreview = async () => {
    if (!canRun) return toast.error("Admission not selected");
    setBusyKey("drug.preview");
    try {
      const res = await fetchIpdDrugChartPdf(admissionId, commonParams);
      const blob = new Blob([res.data], { type: "application/pdf" });
      blobOpenInNewTab(blob, `IPD_DrugChart_${admissionId}.pdf`);
      toast.success("Opened Drug Chart PDF");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || e?.message || "Failed to generate Drug Chart PDF");
    } finally {
      if (mountedRef.current) setBusyKey("");
    }
  };

  const doDrugChartDownload = async () => {
    if (!canRun) return toast.error("Admission not selected");
    setBusyKey("drug.download");
    try {
      const res = await fetchIpdDrugChartPdf(admissionId, commonParams);
      const blob = new Blob([res.data], { type: "application/pdf" });
      blobDownload(blob, `IPD_DrugChart_${admissionId}.pdf`);
      toast.success("Downloaded Drug Chart PDF");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || e?.message || "Failed to download Drug Chart PDF");
    } finally {
      if (mountedRef.current) setBusyKey("");
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Reports & PDFs</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              NABH-ready printable records with template-based feature checklist.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-xl" variant="secondary">IPD</Badge>
              <Badge className="rounded-xl" variant="outline">Template-driven</Badge>
              {admissionId ? (
                <Badge className="rounded-xl" variant="secondary">Admission #{admissionId}</Badge>
              ) : (
                <Badge className="rounded-xl" variant="destructive">No admission selected</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={loadTemplates}
            disabled={loadingTemplates || loadingTemplate || anyBusy}
          >
            {loadingTemplates ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>

          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium">Advanced</span>
            </div>
            <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
          </div>
        </div>
      </div>

      {/* Template picker */}
      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Main Feature Checklist</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* Template */}
            <div className="rounded-2xl border bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Template</div>
                {loadingTemplates ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                ) : (
                  <Badge variant="secondary" className="rounded-xl">IPD</Badge>
                )}
              </div>

              <select
                className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
                value={templateId || ""}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingTemplates}
              >
                <option value="">Select template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}){t.is_active ? "" : " [inactive]"}
                  </option>
                ))}
              </select>

              {templatesErr ? (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                  <p className="text-xs text-amber-800">{templatesErr}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Only sections enabled in this template will appear in the PDF.
                </p>
              )}
            </div>

            {/* Advanced period filter */}
            <div className={cx("rounded-2xl border bg-white p-3 transition", !showAdvanced && "opacity-60")}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                <div className="text-sm font-medium">Report Period</div>
                <Badge variant="outline" className="ml-auto rounded-xl">optional</Badge>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="datetime-local"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    disabled={!showAdvanced}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="datetime-local"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    disabled={!showAdvanced}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Print only records within selected time window.
                </p>
                <Button
                  variant="ghost"
                  className="h-8 rounded-xl px-2 text-xs"
                  onClick={resetFilters}
                  disabled={!showAdvanced || (!periodFrom && !periodTo)}
                >
                  Clear
                </Button>
              </div>

              {periodError ? (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {periodError}
                </div>
              ) : null}
            </div>

            {/* Enabled sections preview */}
            <div className="rounded-2xl border bg-white p-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-slate-600" />
                <div className="text-sm font-medium">Enabled Sections</div>
                <Badge className="ml-auto rounded-xl" variant="secondary">{enabledSections.length}</Badge>
              </div>

              <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                {loadingTemplate ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading template…
                  </div>
                ) : !template ? (
                  <p className="text-xs text-muted-foreground">
                    Select a template to preview enabled sections.
                  </p>
                ) : enabledSections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sections enabled. (Check template config)
                  </p>
                ) : (
                  enabledSections.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.label || s.code}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.code}</div>
                      </div>
                      <div className="shrink-0">
                        {s.required ? (
                          <Badge className="rounded-xl" variant="default">required</Badge>
                        ) : (
                          <Badge className="rounded-xl" variant="secondary">enabled</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            PDFs include audit-friendly timestamps, professional structure, and page numbering (if enabled in branding).
          </div>
        </CardContent>
      </Card>

      {/* Reports */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Case Sheet */}
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-700" />
                IPD Case Sheet / Counseling Summary
              </span>
              <div className="flex items-center gap-2">
                <Badge className="rounded-xl" variant="secondary">NABH</Badge>
                <Badge className="rounded-xl" variant="outline">PDF</Badge>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prints selected IPD records (vitals, nursing, I/O, assessments, referrals,
              procedures, discharge counseling) based on the chosen template checklist.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="rounded-2xl sm:w-auto"
                onClick={doCaseSheetPreview}
                disabled={!canRun || anyBusy || loadingTemplates || loadingTemplate}
              >
                {busyKey === "case.preview" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>

              <Button
                variant="secondary"
                className="rounded-2xl sm:w-auto"
                onClick={doCaseSheetDownload}
                disabled={!canRun || anyBusy || loadingTemplates || loadingTemplate}
              >
                {busyKey === "case.download" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download
              </Button>

              <div className="sm:ml-auto">
                {!templateId ? (
                  <Badge className="rounded-xl" variant="destructive">Select template</Badge>
                ) : (
                  <Badge className="rounded-xl" variant="secondary">Template #{templateId}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ✅ Drug Chart */}
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-700" />
                IPD Drug Chart (NABH Format)
              </span>
              <div className="flex items-center gap-2">
                <Badge className="rounded-xl" variant="secondary">NABH</Badge>
                <Badge className="rounded-xl" variant="outline">PDF</Badge>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prints the Drug Chart sheet in hospital format (like your uploaded paper format).
              Includes medication grid + nurse/doctor signature blocks.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="rounded-2xl sm:w-auto"
                onClick={doDrugChartPreview}
                disabled={!canRun || anyBusy}
              >
                {busyKey === "drug.preview" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>

              <Button
                variant="secondary"
                className="rounded-2xl sm:w-auto"
                onClick={doDrugChartDownload}
                disabled={!canRun || anyBusy}
              >
                {busyKey === "drug.download" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download
              </Button>

              <div className="sm:ml-auto">
                <Badge className="rounded-xl" variant="outline">
                  /ipd/admissions/:id/drug-chart/pdf
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coming soon */}
        <Card className="rounded-3xl border-slate-200 shadow-sm xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-700" />
                Discharge Summary (PDF)
              </span>
              <Badge className="rounded-xl" variant="outline">coming soon</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add backend endpoint later:
              <span className="ml-2 break-all font-mono">/pdf/ipd/admissions/:id/discharge-summary</span>
            </p>
            <div className="text-xs text-muted-foreground">
              Tip: Use the same <span className="font-mono">template.sections</span> checklist to include/exclude
              discharge fields (diagnosis, procedures, instructions, follow-up, signatures).
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
