// FILE: src/ipd/nursing/NewbornResuscitation.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    Baby,
    HeartPulse,
    FileText,
    Save,
    BadgeCheck,
    Lock,
    ShieldAlert,
    Printer,
    RefreshCcw,
    Trash2,
    MoreVertical,
    ChevronDown,
    Wand2,
    Copy,
    RotateCcw,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
    getNewbornResuscitation,
    createNewbornResuscitation,
    updateNewbornResuscitation,
    verifyNewbornResuscitation,
    finalizeNewbornResuscitation,
    voidNewbornResuscitation,
    fetchNewbornResuscitationPdf,
} from "@/api/ipdNewborn";

const cx = (...a) => a.filter(Boolean).join(" ");
const isEmptyObj = (x) => !x || (typeof x === "object" && Object.keys(x).length === 0);

const toDTLocal = (v) => {
    if (!v) return "";
    try {
        if (typeof v === "string") {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16);
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, "0");
                const yyyy = d.getFullYear();
                const mm = pad(d.getMonth() + 1);
                const dd = pad(d.getDate());
                const hh = pad(d.getHours());
                const mi = pad(d.getMinutes());
                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
            }
            return "";
        }
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return "";
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
};

const emptyForm = () => ({
    birth_register_id: null,
    baby_patient_id: null,
    mother_patient_id: null,

    mother_name: "",
    mother_age_years: "",
    mother_blood_group: "",
    gravida: "",
    para: "",
    living: "",
    abortion: "",
    lmp_date: "",
    edd_date: "",
    hiv_status: "",
    vdrl_status: "",
    hbsag_status: "",
    thyroid: "",
    pih: null,
    gdm: null,
    fever: null,
    other_illness: "",
    drug_intake: "",
    antenatal_steroid: "",
    gestational_age_weeks: "",
    consanguinity: "",
    mode_of_conception: "",
    prev_sibling_neonatal_period: "",
    referred_from: "",
    amniotic_fluid: "",

    date_of_birth: "",
    time_of_birth: "",
    sex: "Unknown",
    birth_weight_kg: "",
    length_cm: "",
    head_circum_cm: "",
    mode_of_delivery: "",
    baby_cried_at_birth: null,
    apgar_1_min: "",
    apgar_5_min: "",
    apgar_10_min: "",
    resuscitation: {
        suction: false,
        stimulation: false,
        bag_mask: false,
        oxygen: false,
        intubation: false,
        chest_compressions: false,
        drugs: false,
        notes: "",
    },
    resuscitation_notes: "",

    hr: "",
    rr: "",
    cft_seconds: "",
    sao2: "",
    sugar_mgdl: "",

    cvs: "",
    rs: "",
    icr: false,
    scr: false,
    grunting: false,
    apnea: false,
    downes_score: "",
    pa: "",

    cns_cry: "",
    cns_activity: "",
    cns_af: "",
    cns_reflexes: "",
    cns_tone: "",

    musculoskeletal: "",
    spine_cranium: "",
    genitalia: "",

    diagnosis: "",
    treatment: "",

    oxygen: "",
    warmth: "",
    feed_initiation: "",

    vitamin_k_given: null,
    vitamin_k_at: "",
    vitamin_k_remarks: "",

    others: "",
    vitals_monitor: "",

    vaccination: {
        BCG: { given: false, at: "", batch: "", remarks: "" },
        OPV: { given: false, at: "", batch: "", remarks: "" },
        HepB: { given: false, at: "", batch: "", remarks: "" },
    },
});

const statusTone = (s) => {
    const x = (s || "").toUpperCase();
    if (x === "FINALIZED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (x === "VERIFIED") return "bg-blue-50 text-blue-700 border-blue-200";
    if (x === "VOIDED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-800 border-amber-200";
};

const num = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const cleanPayload = (form) => {
    const p = { ...form };

    const intFields = [
        "mother_age_years",
        "gravida",
        "para",
        "living",
        "abortion",
        "gestational_age_weeks",
        "apgar_1_min",
        "apgar_5_min",
        "apgar_10_min",
        "hr",
        "rr",
        "sao2",
        "sugar_mgdl",
        "downes_score",
    ];
    const floatFields = ["birth_weight_kg", "length_cm", "head_circum_cm", "cft_seconds"];

    for (const f of intFields) p[f] = num(p[f]);
    for (const f of floatFields) p[f] = num(p[f]);

    p.birth_register_id = num(p.birth_register_id);
    p.baby_patient_id = num(p.baby_patient_id);
    p.mother_patient_id = num(p.mother_patient_id);

    if (!p.vitamin_k_at) p.vitamin_k_at = null;

    // nested
    p.resuscitation = {
        ...(p.resuscitation || {}),
        notes: (p.resuscitation?.notes || "").trim() || null,
    };

    // vaccination
    const vacc = p.vaccination || {};
    const normV = {};
    for (const k of ["BCG", "OPV", "HepB"]) {
        const item = vacc[k] || {};
        normV[k] = {
            given: !!item.given,
            at: item.at || null,
            batch: (item.batch || "").trim() || null,
            remarks: (item.remarks || "").trim() || null,
        };
    }
    p.vaccination = normV;

    // trim + nullify
    for (const k of Object.keys(p)) {
        if (typeof p[k] === "string") p[k] = p[k].trim();
        if (p[k] === "") p[k] = null;
    }

    return p;
};

const validateFinalize = (form) => {
    if (!form.date_of_birth) return "DOB is required";
    if (!form.sex || form.sex === "Unknown") return "Sex is required";
    if (form.apgar_1_min === "" || form.apgar_1_min === null) return "APGAR 1 min is required";
    if (form.apgar_5_min === "" || form.apgar_5_min === null) return "APGAR 5 min is required";

    const a1 = num(form.apgar_1_min);
    const a5 = num(form.apgar_5_min);
    if (a1 != null && (a1 < 0 || a1 > 10)) return "APGAR 1 min must be 0–10";
    if (a5 != null && (a5 < 0 || a5 > 10)) return "APGAR 5 min must be 0–10";

    const d = num(form.downes_score);
    if (d != null && (d < 0 || d > 10)) return "Downes score must be 0–10";

    return "";
};

const stableHash = (obj) => {
    try {
        return JSON.stringify(obj);
    } catch {
        return String(Date.now());
    }
};

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied");
    } catch {
        toast.error("Copy failed");
    }
}

export default function NewbornResuscitation({ beds, admission, patient, admissionId, canWrite = true }) {
    const canManage = canWrite;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const [note, setNote] = useState("");
    const [voidReason, setVoidReason] = useState("");

    const [tab, setTab] = useState("baby");

    // automation
    const [autoSave, setAutoSave] = useState(true);
    const [confirm, setConfirm] = useState({ open: false, kind: "", title: "", body: "", onYes: null });

    const status = data?.status || "DRAFT";
    const locked = status === "FINALIZED" || status === "VOIDED";

    const headerTitle = useMemo(() => {
        const baby = form?.baby_patient_id ? `Baby #${form.baby_patient_id}` : "Newborn";
        return `${baby} • Resuscitation & Immediate Exam`;
    }, [form?.baby_patient_id]);

    const payloadHash = useMemo(() => stableHash(cleanPayload(form)), [form]);
    const [lastSavedHash, setLastSavedHash] = useState("");
    const dirty = !!data && !locked && lastSavedHash && payloadHash !== lastSavedHash;

    const load = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const rec = await getNewbornResuscitation(admissionId);
            if (!rec) {
                setData(null);
                setForm(emptyForm());
                setLastSavedHash("");
            } else {
                setData(rec);
                setForm(() => {
                    const f = emptyForm();
                    const merged = { ...f, ...rec };
                    merged.resuscitation = { ...f.resuscitation, ...(rec.resuscitation || {}) };
                    merged.vaccination = {
                        ...f.vaccination,
                        ...(rec.vaccination || {}),
                        BCG: { ...f.vaccination.BCG, ...((rec.vaccination || {}).BCG || {}) },
                        OPV: { ...f.vaccination.OPV, ...((rec.vaccination || {}).OPV || {}) },
                        HepB: { ...f.vaccination.HepB, ...((rec.vaccination || {}).HepB || {}) },
                    };

                    merged.vitamin_k_at = toDTLocal(rec.vitamin_k_at);
                    merged.vaccination.BCG.at = toDTLocal(merged.vaccination.BCG.at);
                    merged.vaccination.OPV.at = toDTLocal(merged.vaccination.OPV.at);
                    merged.vaccination.HepB.at = toDTLocal(merged.vaccination.HepB.at);
                    return merged;
                });

                // after load, mark as saved baseline
                setTimeout(() => setLastSavedHash(stableHash(cleanPayload({ ...emptyForm(), ...rec }))), 0);
            }
        } catch (e) {
            toast.error(e?.message || "Failed to load newborn record");
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => {
        load();
    }, [load]);

    // CTRL+S
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (!locked) doSave({ toastOnSuccess: true });
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [locked]);

    // Auto-save (debounced)
    useEffect(() => {
        if (!autoSave) return;
        if (!canManage) return;
        if (!data) return; // only autosave after record exists
        if (locked) return;
        if (!lastSavedHash) return;

        if (payloadHash === lastSavedHash) return;

        const t = setTimeout(() => {
            doSave({ toastOnSuccess: false, silent: true });
        }, 1200);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payloadHash, autoSave, canManage, data, locked, lastSavedHash]);

    const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));
    const setResus = (k, v) => setForm((s) => ({ ...s, resuscitation: { ...(s.resuscitation || {}), [k]: v } }));
    const setVacc = (name, k, v) =>
        setForm((s) => ({
            ...s,
            vaccination: {
                ...(s.vaccination || {}),
                [name]: { ...((s.vaccination || {})[name] || {}), [k]: v },
            },
        }));

    const autofillFromAdmission = () => {
        // best-effort; handles unknown shapes safely
        console.log(patient, "dmbvb");
        const p = patient || admission?.patient || {};
        const getName = () => `${patient.prefix} ${p.first_name}` || p.full_name || p.patient_name || p.display_name || "";
        const getAge = () => p.age_years || p.age || p.years || "";
        const getId = () => p.id || admission?.patient_id || admission?.patientId || null;


        setForm((s) => ({
            ...s,
            mother_patient_id: s.mother_patient_id ?? getId(),
            mother_name: getName(),
            mother_age_years: s.mother_age_years || getAge(),
        }));

        toast.success("Autofilled mother details (best-effort)");
    };

    const doCreateDraft = async () => {
        if (!admissionId) return;
        if (!canManage) return toast.error("No permission");
        setSaving(true);
        try {
            const rec = await createNewbornResuscitation(admissionId, {});
            setData(rec);
            toast.success("Draft newborn record created");
            await load();
        } catch (e) {
            toast.error(e?.message || "Failed to create draft");
        } finally {
            setSaving(false);
        }
    };

    const doSave = async ({ toastOnSuccess = true, silent = false } = {}) => {
        if (!admissionId) return;
        if (!canManage) return toast.error("No permission to save");
        if (locked) return toast.error("Record is locked");
        if (saving) return;

        setSaving(true);
        try {
            const payload = cleanPayload(form);
            let rec;
            if (!data) {
                rec = await createNewbornResuscitation(admissionId, payload);
            } else {
                rec = await updateNewbornResuscitation(admissionId, payload);
            }
            setData(rec);
            setLastSavedHash(stableHash(payload));
            if (!silent && toastOnSuccess) toast.success("Saved");
        } catch (e) {
            toast.error(e?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const doVerify = async () => {
        if (!admissionId) return;
        if (!data) return toast.error("Create/save record first");
        if (!canManage) return toast.error("No permission");
        if (locked) return toast.error("Record is locked");
        if (saving) return;

        setSaving(true);
        try {
            // best UX: always save latest changes before verify
            await doSave({ toastOnSuccess: false, silent: true });
            const rec = await verifyNewbornResuscitation(admissionId, note);
            setData(rec);
            toast.success("Verified");
            await load();
        } catch (e) {
            toast.error(e?.message || "Verify failed");
        } finally {
            setSaving(false);
        }
    };

    const doFinalize = async () => {
        if (!admissionId) return;
        if (!data) return toast.error("Create/save record first");
        if (!canManage) return toast.error("No permission");

        const err = validateFinalize(form);
        if (err) return toast.error(err);

        setConfirm({
            open: true,
            kind: "finalize",
            title: "Finalize & Lock?",
            body: "After finalize, this record becomes medico-legal and LOCKED (no edits). Continue?",
            onYes: async () => {
                setConfirm((s) => ({ ...s, open: false }));
                if (saving) return;
                setSaving(true);
                try {
                    await doSave({ toastOnSuccess: false, silent: true });
                    const rec = await finalizeNewbornResuscitation(admissionId, note);
                    setData(rec);
                    toast.success("Finalized & locked");
                    await load();
                } catch (e) {
                    toast.error(e?.message || "Finalize failed");
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const doVoid = async () => {
        if (!admissionId) return;
        if (!data) return toast.error("No record to void");
        if (!canManage) return toast.error("No permission");
        const r = (voidReason || "").trim();
        if (r.length < 5) return toast.error("Enter valid void reason (min 5 chars)");

        setConfirm({
            open: true,
            kind: "void",
            title: "Void this record?",
            body: "Voiding is permanent for medico-legal audit. Continue?",
            onYes: async () => {
                setConfirm((s) => ({ ...s, open: false }));
                if (saving) return;
                setSaving(true);
                try {
                    const rec = await voidNewbornResuscitation(admissionId, r);
                    setData(rec);
                    toast.success("Record voided");
                    await load();
                } catch (e) {
                    toast.error(e?.message || "Void failed");
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const doPrint = async () => {
        if (!admissionId) return;
        if (!data) return toast.error("Create/save record first");
        try {
            const blob = await fetchNewbornResuscitationPdf(admissionId);
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        } catch (e) {
            toast.error(e?.message || "Failed to open PDF");
        }
    };

    const doResetToLoaded = async () => {
        await load();
        toast.success("Reset to last saved server data");
    };

    const actionItems = useMemo(() => {
        const hasRecord = !!data;
        const disabledCommon = loading || saving;

        return [
            {
                label: "Autofill (Mother from Admission)",
                icon: <Wand2 className="h-4 w-4" />,
                onClick: autofillFromAdmission,
                disabled: disabledCommon || locked,
            },
            { type: "sep" },

            {
                label: hasRecord ? "Save" : "Create & Save",
                icon: <Save className="h-4 w-4" />,
                onClick: () => doSave({ toastOnSuccess: true }),
                disabled: disabledCommon || locked || !canManage,
            },
            {
                label: "Save + Verify",
                icon: <BadgeCheck className="h-4 w-4" />,
                onClick: doVerify,
                disabled: disabledCommon || locked || !canManage || !hasRecord,
            },
            {
                label: "Save + Finalize",
                icon: <Lock className="h-4 w-4" />,
                onClick: doFinalize,
                disabled: disabledCommon || !canManage || !hasRecord || status === "VOIDED" || status === "FINALIZED",
            },
            {
                label: "Save + Print",
                icon: <Printer className="h-4 w-4" />,
                onClick: async () => {
                    await doSave({ toastOnSuccess: false });
                    await doPrint();
                },
                disabled: disabledCommon || !canManage || locked || !hasRecord,
            },

            { type: "sep" },

            {
                label: "Print PDF",
                icon: <Printer className="h-4 w-4" />,
                onClick: doPrint,
                disabled: disabledCommon || !hasRecord,
            },
            {
                label: "Copy JSON (payload)",
                icon: <Copy className="h-4 w-4" />,
                onClick: () => copyText(JSON.stringify(cleanPayload(form), null, 2)),
                disabled: disabledCommon,
            },
            {
                label: "Reset to server",
                icon: <RotateCcw className="h-4 w-4" />,
                onClick: doResetToLoaded,
                disabled: disabledCommon,
            },

            { type: "sep" },

            {
                label: autoSave ? "Auto-save: ON" : "Auto-save: OFF",
                icon: <ChevronDown className="h-4 w-4" />,
                onClick: () => setAutoSave((v) => !v),
                disabled: disabledCommon || locked || !canManage || !hasRecord,
                tone: autoSave ? "success" : "muted",
            },

            { type: "sep" },

            {
                label: "Void Record",
                icon: <Trash2 className="h-4 w-4" />,
                onClick: doVoid,
                disabled: disabledCommon || !canManage || !hasRecord || status === "VOIDED",
                destructive: true,
            },
        ];
    }, [data, loading, saving, locked, canManage, status, form, autoSave]);

    return (
        <div className="w-full">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {/* Header */}
                <Card className="rounded-2xl border bg-white/80 backdrop-blur">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                                        <Baby className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base sm:text-lg truncate">{headerTitle}</CardTitle>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <Badge className={cx("border", statusTone(status))}>{status}</Badge>

                                            {locked ? (
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Lock className="h-3.5 w-3.5" /> Locked
                                                </span>
                                            ) : dirty ? (
                                                <span className="text-xs text-amber-700 flex items-center gap-1">
                                                    <ShieldAlert className="h-3.5 w-3.5" /> Unsaved changes
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500">Up to date</span>
                                            )}

                                            <span className="text-xs text-slate-400">Admission #{admissionId}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading || saving}>
                                    <RefreshCcw className="h-4 w-4 mr-2" />
                                    Refresh
                                </Button>

                                {!data && (
                                    <Button className="rounded-xl" onClick={doCreateDraft} disabled={saving || loading || !canManage}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Create Draft
                                    </Button>
                                )}

                                <Button className="rounded-xl" onClick={() => doSave({ toastOnSuccess: true })} disabled={saving || loading || !canManage || locked}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>

                                {/* Quick Jump */}
                                <MiniMenu
                                    label="Jump"
                                    icon={<ChevronDown className="h-4 w-4" />}
                                    items={[
                                        { label: "Mother", onClick: () => setTab("mother") },
                                        { label: "Baby", onClick: () => setTab("baby") },
                                        { label: "Resuscitation", onClick: () => setTab("resus") },
                                        { label: "Exam", onClick: () => setTab("exam") },
                                        { label: "Care & Vaccines", onClick: () => setTab("care") },
                                    ]}
                                    disabled={loading || saving}
                                />

                                {/* Actions dropdown */}
                                <MiniMenu
                                    label="Actions"
                                    icon={<MoreVertical className="h-4 w-4" />}
                                    items={actionItems}
                                    disabled={loading || saving}
                                />
                            </div>
                        </div>

                        {/* Note row */}
                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <Label className="text-xs text-slate-600">Action Note (verify/finalize)</Label>
                                <Input
                                    className="rounded-xl"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Optional note for audit trail…"
                                    disabled={saving || loading}
                                />
                            </div>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-600">Void Reason</Label>
                                    <Input
                                        className="rounded-xl"
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="Min 5 chars"
                                        disabled={saving || loading || locked}
                                    />
                                </div>
                                <Button
                                    variant="destructive"
                                    className="rounded-xl"
                                    onClick={doVoid}
                                    disabled={saving || loading || !data || !canManage || status === "VOIDED"}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Void
                                </Button>
                            </div>
                        </div>

                        {/* Finalize hint */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-50 p-3">
                            <ShieldAlert className="h-4 w-4 text-slate-700" />
                            <p className="text-xs text-slate-700">
                                Finalize requires: <b>DOB</b>, <b>Sex</b>, <b>APGAR 1 min</b>, <b>APGAR 5 min</b>. After finalize, record is locked.
                            </p>
                        </div>
                    </CardHeader>
                </Card>

                {/* Tabs */}
                <Card className="rounded-2xl border bg-white">
                    <CardContent className="p-3 sm:p-4">
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList className="w-full justify-start overflow-x-auto rounded-2xl">
                                <TabsTrigger value="mother" className="rounded-xl">Mother</TabsTrigger>
                                <TabsTrigger value="baby" className="rounded-xl">Baby</TabsTrigger>
                                <TabsTrigger value="resus" className="rounded-xl">Resuscitation</TabsTrigger>
                                <TabsTrigger value="exam" className="rounded-xl">Exam</TabsTrigger>
                                <TabsTrigger value="care" className="rounded-xl">Care & Vaccines</TabsTrigger>
                            </TabsList>

                            {/* Mother */}
                            <TabsContent value="mother" className="mt-4">
                                <Section title="Mother Details" icon={<HeartPulse className="h-4 w-4" />}>
                                    <Grid>
                                        <Field label="Mother Name">
                                            <Input className="rounded-xl" value={form.mother_name || ""} onChange={(e) => setField("mother_name", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="Age (years)">
                                            <Input className="rounded-xl" type="number" value={form.mother_age_years ?? ""} onChange={(e) => setField("mother_age_years", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="Blood Group">
                                            <Input className="rounded-xl" value={form.mother_blood_group || ""} onChange={(e) => setField("mother_blood_group", e.target.value)} disabled={locked} placeholder="A+ / O- / …" />
                                        </Field>

                                        <Field label="G">
                                            <Input className="rounded-xl" type="number" value={form.gravida ?? ""} onChange={(e) => setField("gravida", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="P">
                                            <Input className="rounded-xl" type="number" value={form.para ?? ""} onChange={(e) => setField("para", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="L">
                                            <Input className="rounded-xl" type="number" value={form.living ?? ""} onChange={(e) => setField("living", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="A">
                                            <Input className="rounded-xl" type="number" value={form.abortion ?? ""} onChange={(e) => setField("abortion", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="LMP">
                                            <Input className="rounded-xl" type="date" value={form.lmp_date ?? ""} onChange={(e) => setField("lmp_date", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="EDD">
                                            <Input className="rounded-xl" type="date" value={form.edd_date ?? ""} onChange={(e) => setField("edd_date", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="Gestational Age (weeks)">
                                            <Input className="rounded-xl" type="number" value={form.gestational_age_weeks ?? ""} onChange={(e) => setField("gestational_age_weeks", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="Consanguinity">
                                            <SelectNative
                                                value={form.consanguinity || ""}
                                                onChange={(v) => setField("consanguinity", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["No", "Yes", "Unknown"]}
                                            />
                                        </Field>

                                        <Field label="Mode of Conception">
                                            <SelectNative
                                                value={form.mode_of_conception || ""}
                                                onChange={(v) => setField("mode_of_conception", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Natural", "IUI", "IVF", "Other", "Unknown"]}
                                            />
                                        </Field>

                                        <Field label="Amniotic Fluid">
                                            <SelectNative
                                                value={form.amniotic_fluid || ""}
                                                onChange={(v) => setField("amniotic_fluid", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Clear", "Meconium stained", "Blood stained", "Foul smelling", "Unknown"]}
                                            />
                                        </Field>

                                        <Field label="Referred From">
                                            <Input className="rounded-xl" value={form.referred_from || ""} onChange={(e) => setField("referred_from", e.target.value)} disabled={locked} />
                                        </Field>
                                    </Grid>

                                    <Grid className="mt-4">
                                        <Field label="HIV">
                                            <SelectNative
                                                value={form.hiv_status || ""}
                                                onChange={(v) => setField("hiv_status", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Negative", "Positive", "Not done", "Unknown"]}
                                            />
                                        </Field>
                                        <Field label="VDRL">
                                            <SelectNative
                                                value={form.vdrl_status || ""}
                                                onChange={(v) => setField("vdrl_status", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Negative", "Positive", "Not done", "Unknown"]}
                                            />
                                        </Field>
                                        <Field label="HBsAg">
                                            <SelectNative
                                                value={form.hbsag_status || ""}
                                                onChange={(v) => setField("hbsag_status", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Negative", "Positive", "Not done", "Unknown"]}
                                            />
                                        </Field>
                                        <Field label="Thyroid">
                                            <Input className="rounded-xl" value={form.thyroid || ""} onChange={(e) => setField("thyroid", e.target.value)} disabled={locked} />
                                        </Field>
                                    </Grid>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <TriYesNo label="PIH" value={form.pih} onChange={(v) => setField("pih", v)} disabled={locked} />
                                        <TriYesNo label="GDM" value={form.gdm} onChange={(v) => setField("gdm", v)} disabled={locked} />
                                        <TriYesNo label="Fever" value={form.fever} onChange={(v) => setField("fever", v)} disabled={locked} />
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="Other Illness">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.other_illness || ""} onChange={(e) => setField("other_illness", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Drug Intake">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.drug_intake || ""} onChange={(e) => setField("drug_intake", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Antenatal Steroid">
                                            <Input className="rounded-xl" value={form.antenatal_steroid || ""} onChange={(e) => setField("antenatal_steroid", e.target.value)} disabled={locked} placeholder="Yes/No/Doses…" />
                                        </Field>
                                        <Field label="Previous sibling neonatal period">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.prev_sibling_neonatal_period || ""} onChange={(e) => setField("prev_sibling_neonatal_period", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>
                                </Section>
                            </TabsContent>

                            {/* Baby */}
                            <TabsContent value="baby" className="mt-4">
                                <Section title="Baby Details" icon={<Baby className="h-4 w-4" />}>
                                    <Grid>
                                        <Field label="Date of Birth *">
                                            <Input className={cx("rounded-xl", !form.date_of_birth && "border-amber-300")} type="date" value={form.date_of_birth ?? ""} onChange={(e) => setField("date_of_birth", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Field label="Time of Birth (HH:MM)">
                                            <Input className="rounded-xl" value={form.time_of_birth || ""} onChange={(e) => setField("time_of_birth", e.target.value)} disabled={locked} placeholder="09:15" />
                                        </Field>

                                        <Field label="Sex *">
                                            <SelectNative
                                                value={form.sex || "Unknown"}
                                                onChange={(v) => setField("sex", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                danger={!form.sex || form.sex === "Unknown"}
                                                options={["Male", "Female", "Transgender", "Unknown"]}
                                            />
                                        </Field>

                                        <Field label="Mode of Delivery">
                                            <SelectNative
                                                value={form.mode_of_delivery || ""}
                                                onChange={(v) => setField("mode_of_delivery", v)}
                                                disabled={locked}
                                                placeholder="Select…"
                                                options={["Normal vaginal", "LSCS", "Forceps", "Vacuum", "Breech", "Other"]}
                                            />
                                        </Field>
                                    </Grid>

                                    <Grid className="mt-4">
                                        <Field label="Birth Weight (kg)">
                                            <Input className="rounded-xl" type="number" step="0.01" value={form.birth_weight_kg ?? ""} onChange={(e) => setField("birth_weight_kg", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Length (cm)">
                                            <Input className="rounded-xl" type="number" step="0.1" value={form.length_cm ?? ""} onChange={(e) => setField("length_cm", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Head Circumference (cm)">
                                            <Input className="rounded-xl" type="number" step="0.1" value={form.head_circum_cm ?? ""} onChange={(e) => setField("head_circum_cm", e.target.value)} disabled={locked} />
                                        </Field>
                                    </Grid>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <TriYesNo label="Baby cried at birth" value={form.baby_cried_at_birth} onChange={(v) => setField("baby_cried_at_birth", v)} disabled={locked} />
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <Field label="APGAR 1 min *">
                                            <Input className={cx("rounded-xl", (form.apgar_1_min === "" || form.apgar_1_min == null) && "border-amber-300")} type="number" min={0} max={10} value={form.apgar_1_min ?? ""} onChange={(e) => setField("apgar_1_min", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="APGAR 5 min *">
                                            <Input className={cx("rounded-xl", (form.apgar_5_min === "" || form.apgar_5_min == null) && "border-amber-300")} type="number" min={0} max={10} value={form.apgar_5_min ?? ""} onChange={(e) => setField("apgar_5_min", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="APGAR 10 min">
                                            <Input className="rounded-xl" type="number" min={0} max={10} value={form.apgar_10_min ?? ""} onChange={(e) => setField("apgar_10_min", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>
                                </Section>
                            </TabsContent>

                            {/* Resus */}
                            <TabsContent value="resus" className="mt-4">
                                <Section title="Resuscitation" icon={<HeartPulse className="h-4 w-4" />}>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <Check label="Suction" value={!!form.resuscitation?.suction} onChange={(v) => setResus("suction", v)} disabled={locked} />
                                        <Check label="Stimulation" value={!!form.resuscitation?.stimulation} onChange={(v) => setResus("stimulation", v)} disabled={locked} />
                                        <Check label="Bag & Mask" value={!!form.resuscitation?.bag_mask} onChange={(v) => setResus("bag_mask", v)} disabled={locked} />
                                        <Check label="Oxygen" value={!!form.resuscitation?.oxygen} onChange={(v) => setResus("oxygen", v)} disabled={locked} />
                                        <Check label="Intubation" value={!!form.resuscitation?.intubation} onChange={(v) => setResus("intubation", v)} disabled={locked} />
                                        <Check label="Chest Compressions" value={!!form.resuscitation?.chest_compressions} onChange={(v) => setResus("chest_compressions", v)} disabled={locked} />
                                        <Check label="Drugs given" value={!!form.resuscitation?.drugs} onChange={(v) => setResus("drugs", v)} disabled={locked} />
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="Resuscitation Notes (free text)">
                                            <Textarea
                                                className="rounded-2xl min-h-[120px]"
                                                value={form.resuscitation_notes || ""}
                                                onChange={(e) => setField("resuscitation_notes", e.target.value)}
                                                disabled={locked}
                                                placeholder="Detailed steps, timing, outcomes…"
                                            />
                                        </Field>
                                        <Field label="Structured Notes (optional)">
                                            <Textarea
                                                className="rounded-2xl min-h-[120px]"
                                                value={form.resuscitation?.notes || ""}
                                                onChange={(e) => setResus("notes", e.target.value)}
                                                disabled={locked}
                                                placeholder="Short structured notes…"
                                            />
                                        </Field>
                                    </div>
                                </Section>
                            </TabsContent>

                            {/* Exam */}
                            <TabsContent value="exam" className="mt-4">
                                <Section title="Examination (Head to Foot)" icon={<FileText className="h-4 w-4" />}>
                                    <Grid>
                                        <Field label="HR">
                                            <Input className="rounded-xl" type="number" value={form.hr ?? ""} onChange={(e) => setField("hr", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="RR">
                                            <Input className="rounded-xl" type="number" value={form.rr ?? ""} onChange={(e) => setField("rr", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="CFT (sec)">
                                            <Input className="rounded-xl" type="number" step="0.1" value={form.cft_seconds ?? ""} onChange={(e) => setField("cft_seconds", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="SaO2">
                                            <Input className="rounded-xl" type="number" value={form.sao2 ?? ""} onChange={(e) => setField("sao2", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Sugar (mg/dL)">
                                            <Input className="rounded-xl" type="number" value={form.sugar_mgdl ?? ""} onChange={(e) => setField("sugar_mgdl", e.target.value)} disabled={locked} />
                                        </Field>
                                    </Grid>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="CVS">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.cvs || ""} onChange={(e) => setField("cvs", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="RS">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.rs || ""} onChange={(e) => setField("rs", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <Check label="ICR" value={!!form.icr} onChange={(v) => setField("icr", v)} disabled={locked} />
                                        <Check label="SCR" value={!!form.scr} onChange={(v) => setField("scr", v)} disabled={locked} />
                                        <Check label="Grunting" value={!!form.grunting} onChange={(v) => setField("grunting", v)} disabled={locked} />
                                        <Check label="Apnea" value={!!form.apnea} onChange={(v) => setField("apnea", v)} disabled={locked} />
                                        <Field label="Downes score (0–10)">
                                            <Input className="rounded-xl" type="number" min={0} max={10} value={form.downes_score ?? ""} onChange={(e) => setField("downes_score", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="P/A">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.pa || ""} onChange={(e) => setField("pa", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Card className="rounded-2xl border bg-slate-50">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Badge className="rounded-xl border bg-white">CNS</Badge>
                                                    <span className="text-xs text-slate-600">Cry / Activity / AF / Reflexes / Tone</span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <Field label="Cry">
                                                        <Input className="rounded-xl" value={form.cns_cry || ""} onChange={(e) => setField("cns_cry", e.target.value)} disabled={locked} />
                                                    </Field>
                                                    <Field label="Activity">
                                                        <Input className="rounded-xl" value={form.cns_activity || ""} onChange={(e) => setField("cns_activity", e.target.value)} disabled={locked} />
                                                    </Field>
                                                    <Field label="AF">
                                                        <Input className="rounded-xl" value={form.cns_af || ""} onChange={(e) => setField("cns_af", e.target.value)} disabled={locked} />
                                                    </Field>
                                                    <Field label="Reflexes">
                                                        <Input className="rounded-xl" value={form.cns_reflexes || ""} onChange={(e) => setField("cns_reflexes", e.target.value)} disabled={locked} />
                                                    </Field>
                                                    <Field label="Tone" className="sm:col-span-2">
                                                        <Input className="rounded-xl" value={form.cns_tone || ""} onChange={(e) => setField("cns_tone", e.target.value)} disabled={locked} />
                                                    </Field>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                                        <Field label="Musculo Skeletal">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.musculoskeletal || ""} onChange={(e) => setField("musculoskeletal", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Spine & Cranium">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.spine_cranium || ""} onChange={(e) => setField("spine_cranium", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Genitalia">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.genitalia || ""} onChange={(e) => setField("genitalia", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="Diagnosis">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.diagnosis || ""} onChange={(e) => setField("diagnosis", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Treatment">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.treatment || ""} onChange={(e) => setField("treatment", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>
                                </Section>
                            </TabsContent>

                            {/* Care */}
                            <TabsContent value="care" className="mt-4">
                                <Section title="Care, Vitamin K & Vaccination" icon={<BadgeCheck className="h-4 w-4" />}>
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="Oxygen">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.oxygen || ""} onChange={(e) => setField("oxygen", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Warmth">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.warmth || ""} onChange={(e) => setField("warmth", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Feed initiation">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.feed_initiation || ""} onChange={(e) => setField("feed_initiation", e.target.value)} disabled={locked} />
                                        </Field>

                                        <Card className="rounded-2xl border bg-slate-50">
                                            <CardContent className="p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold">Vitamin K (1mg IM stat)</div>
                                                        <div className="text-xs text-slate-600">Record given status + time</div>
                                                    </div>
                                                    <Switch checked={!!form.vitamin_k_given} onCheckedChange={(v) => setField("vitamin_k_given", v)} disabled={locked} />
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <Field label="Given at">
                                                        <Input className="rounded-xl" type="datetime-local" value={form.vitamin_k_at || ""} onChange={(e) => setField("vitamin_k_at", e.target.value)} disabled={locked} />
                                                    </Field>
                                                    <Field label="Remarks">
                                                        <Input className="rounded-xl" value={form.vitamin_k_remarks || ""} onChange={(e) => setField("vitamin_k_remarks", e.target.value)} disabled={locked} />
                                                    </Field>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Badge className="rounded-xl border bg-white">Vaccination (Birth Dose)</Badge>
                                            <span className="text-xs text-slate-600">BCG / OPV / HepB</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                            <VaccineCard
                                                title="BCG"
                                                item={form.vaccination?.BCG}
                                                onToggle={(v) => setVacc("BCG", "given", v)}
                                                onAt={(v) => setVacc("BCG", "at", v)}
                                                onBatch={(v) => setVacc("BCG", "batch", v)}
                                                onRemarks={(v) => setVacc("BCG", "remarks", v)}
                                                locked={locked}
                                            />
                                            <VaccineCard
                                                title="OPV"
                                                item={form.vaccination?.OPV}
                                                onToggle={(v) => setVacc("OPV", "given", v)}
                                                onAt={(v) => setVacc("OPV", "at", v)}
                                                onBatch={(v) => setVacc("OPV", "batch", v)}
                                                onRemarks={(v) => setVacc("OPV", "remarks", v)}
                                                locked={locked}
                                            />
                                            <VaccineCard
                                                title="HepB"
                                                item={form.vaccination?.HepB}
                                                onToggle={(v) => setVacc("HepB", "given", v)}
                                                onAt={(v) => setVacc("HepB", "at", v)}
                                                onBatch={(v) => setVacc("HepB", "batch", v)}
                                                onRemarks={(v) => setVacc("HepB", "remarks", v)}
                                                locked={locked}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Field label="Vitals monitor">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.vitals_monitor || ""} onChange={(e) => setField("vitals_monitor", e.target.value)} disabled={locked} />
                                        </Field>
                                        <Field label="Others">
                                            <Textarea className="rounded-2xl min-h-[90px]" value={form.others || ""} onChange={(e) => setField("others", e.target.value)} disabled={locked} />
                                        </Field>
                                    </div>
                                </Section>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <div className="text-xs text-slate-500 px-1 pb-2">
                    Danger signs: poor feeding / cyanosis / breathing difficulty — report immediately.
                </div>
            </motion.div>

            {/* Confirm Modal */}
            <ConfirmModal
                open={!!confirm.open}
                title={confirm.title}
                body={confirm.body}
                onClose={() => setConfirm((s) => ({ ...s, open: false }))}
                onYes={confirm.onYes}
            />
        </div>
    );
}

/* ---------- UI helpers ---------- */

function Section({ title, icon, children }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-sm sm:text-base font-semibold">{title}</div>
                    <div className="text-xs text-slate-500">NABH medico-legal newborn documentation</div>
                </div>
            </div>
            <div className="rounded-2xl border bg-white p-3 sm:p-4">{children}</div>
        </div>
    );
}

function Grid({ children, className }) {
    return <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}

function Field({ label, children, className }) {
    return (
        <div className={cx("space-y-1", className)}>
            <Label className="text-xs text-slate-600">{label}</Label>
            {children}
        </div>
    );
}

function SelectNative({ value, onChange, options, placeholder = "Select…", disabled, danger }) {
    return (
        <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cx(
                "h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none",
                "border-slate-200 focus:ring-2 focus:ring-slate-200",
                disabled && "opacity-60 cursor-not-allowed",
                danger && "border-amber-300"
            )}
        >
            <option value="">{placeholder}</option>
            {(options || []).map((x) => (
                <option key={x} value={x}>
                    {x}
                </option>
            ))}
        </select>
    );
}

function TriYesNo({ label, value, onChange, disabled }) {
    const v =
        value === true ? "YES" : value === false ? "NO" : "";
    return (
        <div className="rounded-2xl border bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{label}</div>
                <select
                    value={v}
                    onChange={(e) => {
                        const x = e.target.value;
                        if (x === "YES") onChange(true);
                        else if (x === "NO") onChange(false);
                        else onChange(null);
                    }}
                    disabled={disabled}
                    className={cx(
                        "h-9 rounded-xl border bg-white px-2 text-sm outline-none",
                        "border-slate-200 focus:ring-2 focus:ring-slate-200",
                        disabled && "opacity-60 cursor-not-allowed"
                    )}
                >
                    <option value="">Unknown</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                </select>
            </div>
            <div className="mt-1 text-xs text-slate-500">Yes / No / Unknown</div>
        </div>
    );
}

function Check({ label, value, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!value)}
            className={cx(
                "rounded-2xl border p-3 text-left transition",
                value ? "bg-emerald-50 border-emerald-200" : "bg-white hover:bg-slate-50",
                disabled && "opacity-60 cursor-not-allowed"
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{label}</div>
                <Badge className={cx("rounded-xl border", value ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200")}>
                    {value ? "Yes" : "No"}
                </Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500">Tap to toggle</div>
        </button>
    );
}

function VaccineCard({ title, item, onToggle, onAt, onBatch, onRemarks, locked }) {
    const given = !!item?.given;
    return (
        <Card className="rounded-2xl border">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{title}</div>
                    <Switch checked={given} onCheckedChange={onToggle} disabled={locked} />
                </div>
                <div className="text-xs text-slate-500">Batch/time for medico-legal traceability</div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Field label="Given at">
                    <Input className="rounded-xl" type="datetime-local" value={item?.at || ""} onChange={(e) => onAt(e.target.value)} disabled={locked} />
                </Field>
                <Field label="Batch">
                    <Input className="rounded-xl" value={item?.batch || ""} onChange={(e) => onBatch(e.target.value)} disabled={locked} />
                </Field>
                <Field label="Remarks">
                    <Input className="rounded-xl" value={item?.remarks || ""} onChange={(e) => onRemarks(e.target.value)} disabled={locked} />
                </Field>
            </CardContent>
        </Card>
    );
}

/* ---------- Dropdown Menu (no extra dependencies) ---------- */

function MiniMenu({ label, icon, items, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    return (
        <div ref={ref} className="relative">
            <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
            >
                {icon}
                <span className="ml-2">{label}</span>
            </Button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border bg-white shadow-xl">
                    <div className="p-2">
                        {items.map((it, idx) => {
                            if (it.type === "sep") {
                                return <div key={`sep-${idx}`} className="my-2 h-px bg-slate-100" />;
                            }
                            const dis = !!it.disabled;
                            return (
                                <button
                                    key={it.label}
                                    type="button"
                                    onClick={() => {
                                        if (dis) return;
                                        setOpen(false);
                                        it.onClick?.();
                                    }}
                                    className={cx(
                                        "w-full rounded-xl px-3 py-2 text-left text-sm transition flex items-center gap-2",
                                        dis ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50",
                                        it.destructive && !dis && "text-rose-600 hover:bg-rose-50"
                                    )}
                                >
                                    <span className={cx("shrink-0", it.destructive ? "text-rose-600" : "text-slate-700")}>
                                        {it.icon}
                                    </span>
                                    <span className="flex-1">{it.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------- Confirm Modal ---------- */

function ConfirmModal({ open, title, body, onClose, onYes }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative w-[92vw] max-w-lg rounded-2xl border bg-white shadow-2xl">
                <div className="p-4 border-b">
                    <div className="text-base font-semibold">{title}</div>
                    <div className="text-sm text-slate-600 mt-1">{body}</div>
                </div>
                <div className="p-4 flex gap-2 justify-end">
                    <Button variant="outline" className="rounded-xl" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button className="rounded-xl" onClick={onYes}>
                        Yes, Continue
                    </Button>
                </div>
            </div>
        </div>
    );
}
