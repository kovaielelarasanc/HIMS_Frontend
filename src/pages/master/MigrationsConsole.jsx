// src/pages/master/MigrationsConsole.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
    listTenants,
    tenantStorage,
    volumesStorage,
    allowedTypes,
    listJobs,
    jobDetail,
    cancelJob,
    planMigration,
    applyMigration,
    setTenantVolume,
} from "@/api/masterMigrations";

import PermGate from "@/components/PermGate";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import {
    Database,
    Table2,
    Columns,
    Play,
    Eye,
    ShieldAlert,
    Trash2,
    RefreshCcw,
    ChevronRight,
    HardDrive,
    Layers,
    X,
    Loader2,
} from "lucide-react";

// ✅ provider check (no env)
const PROVIDER_TENANT_CODE = "NUTRYAH";

function decodeJwtPayload(token) {
    try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const b64url = parts[1];
        const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
        return JSON.parse(atob(b64 + pad));
    } catch {
        return null;
    }
}

function isProviderTenant() {
    const token = localStorage.getItem("access_token");
    const payload = decodeJwtPayload(token);

    const tokenTcode = String(payload?.tcode || "").trim().toUpperCase();
    const tenantCode = String(localStorage.getItem("tenant_code") || "").trim().toUpperCase();
    const provider = String(PROVIDER_TENANT_CODE).trim().toUpperCase();

    return (tokenTcode && tokenTcode === provider) || (tenantCode && tenantCode === provider);
}

const errMsg = (e, fallback) =>
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback;

const statusBadge = (s) => {
    const v = (s || "").toUpperCase();
    const map = {
        RUNNING: "bg-amber-100 text-amber-800 border-amber-200",
        DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
        FAILED: "bg-rose-100 text-rose-800 border-rose-200",
        CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
        PLANNED: "bg-sky-100 text-sky-800 border-sky-200",
        PENDING: "bg-slate-100 text-slate-700 border-slate-200",
        SKIPPED: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return map[v] || "bg-slate-100 text-slate-700 border-slate-200";
};

const opTemplates = {
    add_column: () => ({
        op: "add_column",
        table: "",
        column: { name: "", type: "VARCHAR(255)", nullable: true, default: null, comment: "", after: null },
    }),
    modify_column: () => ({
        op: "modify_column",
        table: "",
        column: { name: "", type: "VARCHAR(255)", nullable: true, default: null, comment: "", after: null },
    }),
    drop_column: () => ({ op: "drop_column", table: "", column_name: "" }),
    create_table: () => ({
        op: "create_table",
        table: "",
        columns: [{ name: "id", type: "BIGINT", nullable: false, default: null, comment: "" }],
    }),
    drop_table: () => ({ op: "drop_table", table: "" }),
    rename_column: () => ({ op: "rename_column", table: "", old_column_name: "", new_column_name: "" }),
    create_database: () => ({ op: "create_database", db_name: "" }),
    drop_database: () => ({ op: "drop_database", db_name: "" }),
};

export default function MigrationsConsole() {
    // ✅ hard stop if not provider (route already protected, but safe)
    if (!isProviderTenant()) {
        return (
            <div className="p-6">
                <div className="rounded-2xl border bg-white p-4">
                    <div className="font-semibold">Provider Only</div>
                    <div className="text-sm text-slate-600 mt-1">
                        You are not in provider tenant. Switch to provider tenant ({PROVIDER_TENANT_CODE}).
                    </div>
                </div>
            </div>
        );
    }

    const [loading, setLoading] = useState(true);
    const [tenants, setTenants] = useState([]);
    const [types, setTypes] = useState([]);
    const [tab, setTab] = useState("builder");

    // selection
    const [q, setQ] = useState("");
    const [applyAll, setApplyAll] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    // builder
    const [name, setName] = useState("Schema Migration");
    const [description, setDescription] = useState("");
    const [dryRun, setDryRun] = useState(true);
    const [allowDestructive, setAllowDestructive] = useState(false);
    const [confirmPhrase, setConfirmPhrase] = useState("");
    const [ops, setOps] = useState([opTemplates.add_column()]);

    // plan preview
    const [planning, setPlanning] = useState(false);
    const [plan, setPlan] = useState(null);

    // apply
    const [applying, setApplying] = useState(false);

    // jobs
    const [jobs, setJobs] = useState([]);
    const [jobOpen, setJobOpen] = useState(null);
    const [jobLoading, setJobLoading] = useState(false);

    // storage
    const [volumes, setVolumes] = useState([]);
    const [tenantUsage, setTenantUsage] = useState({}); // tenantId -> used_mb

    const filteredTenants = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return tenants;
        return tenants.filter((t) =>
            [t.name, t.code, t.db_name, t.subscription_plan].filter(Boolean).join(" ").toLowerCase().includes(s)
        );
    }, [tenants, q]);

    const selectedTenants = useMemo(() => {
        if (applyAll) return filteredTenants.filter((t) => t.is_active);
        const setIds = new Set(selectedIds);
        return filteredTenants.filter((t) => setIds.has(t.id));
    }, [applyAll, selectedIds, filteredTenants]);

    const refresh = async () => {
        setLoading(true);
        try {
            const [tRes, typeRes] = await Promise.all([listTenants(), allowedTypes()]);
            setTenants(tRes.items || []);
            setTypes(typeRes.items || []);
        } catch (e) {
            toast.error(errMsg(e, "Failed to load tenants"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const toggleTenant = (id) => {
        setSelectedIds((prev) => {
            const s = new Set(prev);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return Array.from(s);
        });
    };

    const addOp = (k) => setOps((p) => [...p, opTemplates[k]()]);
    const removeOp = (idx) => setOps((p) => p.filter((_, i) => i !== idx));

    const updateOp = (idx, patch) => setOps((p) => p.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

    const updateColumn = (opIdx, patch) =>
        setOps((p) =>
            p.map((o, i) => {
                if (i !== opIdx) return o;
                return { ...o, column: { ...(o.column || {}), ...patch } };
            })
        );

    const updateCreateTableColumn = (opIdx, colIdx, patch) =>
        setOps((p) =>
            p.map((o, i) => {
                if (i !== opIdx) return o;
                const cols = (o.columns || []).map((c, ci) => (ci === colIdx ? { ...c, ...patch } : c));
                return { ...o, columns: cols };
            })
        );

    const addCreateTableColumn = (opIdx) =>
        setOps((p) =>
            p.map((o, i) => {
                if (i !== opIdx) return o;
                return {
                    ...o,
                    columns: [
                        ...(o.columns || []),
                        { name: "", type: "VARCHAR(255)", nullable: true, default: null, comment: "" },
                    ],
                };
            })
        );

    const removeCreateTableColumn = (opIdx, colIdx) =>
        setOps((p) =>
            p.map((o, i) => {
                if (i !== opIdx) return o;
                return { ...o, columns: (o.columns || []).filter((_, ci) => ci !== colIdx) };
            })
        );

    const buildPayload = () => ({
        name,
        description: description || null,
        apply_all: applyAll,
        tenant_ids: applyAll ? [] : selectedIds,
        dry_run: dryRun,
        allow_destructive: allowDestructive,
        confirm_phrase: confirmPhrase || null,
        client_request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ops,
    });

    const validateOps = () => {
        if (!ops?.length) {
            toast.error("Add at least one operation")
            return false
        }

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i]
            const kind = String(op?.op || "").trim()

            if (!kind) {
                toast.error(`Operation #${i + 1}: missing op type`)
                return false
            }

            if (kind === "create_database" || kind === "drop_database") {
                if (!String(op?.db_name || "").trim()) {
                    toast.error(`Operation #${i + 1} (${kind}): Database name is required`)
                    return false
                }
                continue
            }

            // Table required
            if (!String(op?.table || "").trim()) {
                toast.error(`Operation #${i + 1} (${kind}): Table is required`)
                return false
            }

            if (kind === "add_column" || kind === "modify_column") {
                if (!String(op?.column?.name || "").trim()) {
                    toast.error(`Operation #${i + 1} (${kind}): Column name is required`)
                    return false
                }
                if (!String(op?.column?.type || "").trim()) {
                    toast.error(`Operation #${i + 1} (${kind}): Column type is required`)
                    return false
                }
            }

            if (kind === "drop_column") {
                if (!String(op?.column_name || "").trim()) {
                    toast.error(`Operation #${i + 1} (${kind}): Column name is required`)
                    return false
                }
            }

            if (kind === "rename_column") {
                if (!String(op?.old_column_name || "").trim() || !String(op?.new_column_name || "").trim()) {
                    toast.error(`Operation #${i + 1} (${kind}): Old + New column names are required`)
                    return false
                }
            }

            if (kind === "create_table") {
                const cols = op?.columns || []
                if (!Array.isArray(cols) || cols.length === 0) {
                    toast.error(`Operation #${i + 1} (${kind}): Add at least one column`)
                    return false
                }
                for (let ci = 0; ci < cols.length; ci++) {
                    if (!String(cols[ci]?.name || "").trim()) {
                        toast.error(`Operation #${i + 1} (${kind}): Column #${ci + 1} name required`)
                        return false
                    }
                    if (!String(cols[ci]?.type || "").trim()) {
                        toast.error(`Operation #${i + 1} (${kind}): Column #${ci + 1} type required`)
                        return false
                    }
                }
            }
        }

        return true
    }


    const doPlan = async () => {
        if (!applyAll && selectedIds.length === 0) {
            toast.error("Select at least one tenant (or enable Apply All).");
            if (!validateOps()) return
        }
        setPlanning(true);
        try {
            const res = await planMigration(buildPayload());
            setPlan(res);
            toast.success("Plan generated");
        } catch (e) {
            toast.error(errMsg(e, "Plan failed"));
        } finally {
            setPlanning(false);
        }
    };

    const doApply = async () => {
        if (!plan) {
            toast.error("Run PLAN first");
            if (!validateOps()) return
        }
        if (allowDestructive && (confirmPhrase || "").trim().toUpperCase() !== "I UNDERSTAND") {
            toast.error('Type "I UNDERSTAND" to allow destructive ops.');
            if (!validateOps()) return
        }
        setApplying(true);
        try {
            const res = await applyMigration(buildPayload());
            toast.success(`Applied. Job #${res.job_id}`);
            setTab("jobs");
            await loadJobs();
        } catch (e) {
            toast.error(errMsg(e, "Apply failed"));
        } finally {
            setApplying(false);
        }
    };

    const loadJobs = async () => {
        try {
            const res = await listJobs();
            setJobs(res.items || []);
        } catch (e) {
            toast.error(errMsg(e, "Failed to load jobs"));
        }
    };

    const openJob = async (id) => {
        setJobLoading(true);
        try {
            const res = await jobDetail(id);
            setJobOpen(res);
        } catch (e) {
            toast.error(errMsg(e, "Failed to load job"));
        } finally {
            setJobLoading(false);
        }
    };

    const doCancel = async (id) => {
        try {
            await cancelJob(id);
            toast.success("Cancel requested");
            await openJob(id);
            await loadJobs();
        } catch (e) {
            toast.error(errMsg(e, "Cancel failed"));
        }
    };

    const loadStorage = async () => {
        try {
            const [v] = await Promise.all([volumesStorage()]);
            setVolumes(v.items || []);

            // lazy load per tenant usage (only active)
            const active = tenants.filter((t) => t.is_active).slice(0, 40); // prevent UI freeze
            const map = {};
            for (const t of active) {
                try {
                    const r = await tenantStorage(t.id);
                    map[t.id] = r.used_mb;
                } catch {
                    map[t.id] = null;
                }
            }
            setTenantUsage(map);
        } catch (e) {
            toast.error(errMsg(e, "Storage load failed"));
        }
    };

    useEffect(() => {
        if (tab === "jobs") loadJobs();
        if (tab === "storage") loadStorage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    return (
        <PermGate perm="master.migrations.view">
            <div className="p-4 md:p-6 space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border bg-gradient-to-b from-white to-slate-50 shadow-sm"
                >
                    <div className="p-5 md:p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Master Migration Console</h1>
                                <Badge variant="outline" className="rounded-full">Provider Only</Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                                Apply schema changes to all tenants or selected tenants with full audit + job tracking.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={refresh} disabled={loading}>
                                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="px-5 md:px-6 pb-5 md:pb-6">
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList className="rounded-2xl">
                                <TabsTrigger value="builder" className="rounded-xl">Builder</TabsTrigger>
                                <TabsTrigger value="jobs" className="rounded-xl">Jobs</TabsTrigger>
                                <TabsTrigger value="storage" className="rounded-xl">Storage</TabsTrigger>
                            </TabsList>

                            {/* BUILDER */}
                            <TabsContent value="builder" className="mt-4">
                                <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
                                    {/* Tenant selector */}
                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Layers className="h-4 w-4" /> Target Tenants
                                            </CardTitle>
                                            <CardDescription>Select all tenants or only specific hospitals.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <Input
                                                    value={q}
                                                    onChange={(e) => setQ(e.target.value)}
                                                    placeholder="Search tenant (name / code / db)..."
                                                    className="rounded-2xl"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between rounded-2xl border p-3 bg-slate-50">
                                                <div>
                                                    <div className="font-medium text-sm">Apply to all active tenants</div>
                                                    <div className="text-xs text-slate-600">Overrides manual selection.</div>
                                                </div>
                                                <Switch checked={applyAll} onCheckedChange={setApplyAll} />
                                            </div>

                                            <ScrollArea className="h-[360px] pr-2">
                                                <div className="space-y-2">
                                                    {filteredTenants.map((t) => (
                                                        <div key={t.id} className="rounded-2xl border p-3 flex items-center gap-3">
                                                            <Checkbox
                                                                checked={applyAll ? t.is_active : selectedIds.includes(t.id)}
                                                                onCheckedChange={() => toggleTenant(t.id)}
                                                                disabled={applyAll}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-medium truncate">{t.name}</div>
                                                                    {!t.is_active && (
                                                                        <Badge variant="outline" className="rounded-full">inactive</Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-slate-600 truncate">
                                                                    {t.code} • {t.db_name} • {t.subscription_plan || "—"}
                                                                </div>
                                                            </div>
                                                            <Badge variant="outline" className="rounded-full">{t.volume_tag || "default"}</Badge>
                                                        </div>
                                                    ))}
                                                    {!filteredTenants.length && (
                                                        <div className="text-sm text-slate-600">No tenants</div>
                                                    )}
                                                </div>
                                            </ScrollArea>

                                            <Separator />

                                            <div className="text-xs text-slate-600">
                                                Selected:{" "}
                                                <span className="font-medium text-slate-900">
                                                    {applyAll ? "ALL active" : selectedIds.length}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Migration builder */}
                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Table2 className="h-4 w-4" /> Migration Builder
                                            </CardTitle>
                                            <CardDescription>Build operations → preview SQL → apply as job.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <div>
                                                    <div className="text-xs text-slate-600 mb-1">Job name</div>
                                                    <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-600 mb-1">Dry run</div>
                                                    <div className="rounded-2xl border p-3 flex items-center justify-between bg-slate-50">
                                                        <div className="text-sm font-medium">
                                                            {dryRun ? "ON (no DB change)" : "OFF (execute DDL)"}
                                                        </div>
                                                        <Switch checked={!dryRun} onCheckedChange={(v) => setDryRun(!v)} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-slate-600 mb-1">Description</div>
                                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-2xl" />
                                            </div>

                                            <div className="rounded-2xl border p-3 bg-gradient-to-b from-white to-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-sm flex items-center gap-2">
                                                            <ShieldAlert className="h-4 w-4" /> Destructive operations
                                                        </div>
                                                        <div className="text-xs text-slate-600">
                                                            DROP database/table/column requires explicit confirmation.
                                                        </div>
                                                    </div>
                                                    <Switch checked={allowDestructive} onCheckedChange={setAllowDestructive} />
                                                </div>
                                                {allowDestructive && (
                                                    <div className="mt-3">
                                                        <div className="text-xs text-slate-600 mb-1">Type exactly: I UNDERSTAND</div>
                                                        <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} className="rounded-2xl" />
                                                    </div>
                                                )}
                                            </div>

                                            <Separator />

                                            {/* Operations */}
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("add_column")}>
                                                    <Columns className="h-4 w-4 mr-2" /> Add Column
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("modify_column")}>
                                                    <Columns className="h-4 w-4 mr-2" /> Modify Column
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("drop_column")}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Drop Column
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("create_table")}>
                                                    <Table2 className="h-4 w-4 mr-2" /> Create Table
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("drop_table")}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Drop Table
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("rename_column")}>
                                                    <ChevronRight className="h-4 w-4 mr-2" /> Rename Column
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("create_database")}>
                                                    <Database className="h-4 w-4 mr-2" /> Create DB
                                                </Button>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => addOp("drop_database")}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Drop DB
                                                </Button>
                                            </div>

                                            <div className="space-y-3">
                                                <AnimatePresence>
                                                    {ops.map((op, idx) => (
                                                        <motion.div
                                                            key={idx}
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -6 }}
                                                            className="rounded-3xl border bg-white shadow-sm"
                                                        >
                                                            <div className="p-4 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="rounded-full">{op.op}</Badge>
                                                                    <div className="text-sm font-medium text-slate-900">Operation #{idx + 1}</div>
                                                                </div>
                                                                <Button variant="ghost" className="rounded-2xl" onClick={() => removeOp(idx)}>
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>

                                                            <div className="px-4 pb-4 space-y-3">
                                                                {/* op-specific */}
                                                                {(op.op === "create_database" || op.op === "drop_database") && (
                                                                    <div>
                                                                        <div className="text-xs text-slate-600 mb-1">Database name</div>
                                                                        <Input
                                                                            value={op.db_name || ""}
                                                                            onChange={(e) => updateOp(idx, { db_name: e.target.value })}
                                                                            placeholder="nabh_hims_newtenant"
                                                                            className="rounded-2xl"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {(op.op === "drop_table" ||
                                                                    op.op === "create_table" ||
                                                                    op.op === "add_column" ||
                                                                    op.op === "modify_column" ||
                                                                    op.op === "drop_column" ||
                                                                    op.op === "rename_column") && (
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Table</div>
                                                                            <Input
                                                                                value={op.table || ""}
                                                                                onChange={(e) => updateOp(idx, { table: e.target.value })}
                                                                                placeholder="example: patients"
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>
                                                                    )}

                                                                {(op.op === "add_column" || op.op === "modify_column") && (
                                                                    <div className="grid md:grid-cols-2 gap-3">
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Column name</div>
                                                                            <Input
                                                                                value={op.column?.name || ""}
                                                                                onChange={(e) => updateColumn(idx, { name: e.target.value })}
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Type</div>
                                                                            <Select
                                                                                value={op.column?.type || ""}
                                                                                onValueChange={(v) => updateColumn(idx, { type: v })}
                                                                            >
                                                                                <SelectTrigger className="rounded-2xl">
                                                                                    <SelectValue placeholder="Select type" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {(types.length ? types : ["VARCHAR(255)", "INT", "DATETIME", "JSON"]).map((t) => (
                                                                                        <SelectItem key={t} value={t}>
                                                                                            {t}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>

                                                                        <div className="rounded-2xl border p-3 bg-slate-50 flex items-center justify-between">
                                                                            <div className="text-sm font-medium">Nullable</div>
                                                                            <Switch checked={!!op.column?.nullable} onCheckedChange={(v) => updateColumn(idx, { nullable: v })} />
                                                                        </div>

                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Default (optional)</div>
                                                                            <Input
                                                                                value={op.column?.default ?? ""}
                                                                                onChange={(e) =>
                                                                                    updateColumn(idx, { default: e.target.value ? e.target.value : null })
                                                                                }
                                                                                placeholder="NULL | CURRENT_TIMESTAMP | 0 | 'abc'"
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>

                                                                        <div className="md:col-span-2">
                                                                            <div className="text-xs text-slate-600 mb-1">Comment</div>
                                                                            <Input
                                                                                value={op.column?.comment || ""}
                                                                                onChange={(e) => updateColumn(idx, { comment: e.target.value })}
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {op.op === "drop_column" && (
                                                                    <div>
                                                                        <div className="text-xs text-slate-600 mb-1">Column name</div>
                                                                        <Input
                                                                            value={op.column_name || ""}
                                                                            onChange={(e) => updateOp(idx, { column_name: e.target.value })}
                                                                            className="rounded-2xl"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {op.op === "rename_column" && (
                                                                    <div className="grid md:grid-cols-2 gap-3">
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Old name</div>
                                                                            <Input
                                                                                value={op.old_column_name || ""}
                                                                                onChange={(e) => updateOp(idx, { old_column_name: e.target.value })}
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">New name</div>
                                                                            <Input
                                                                                value={op.new_column_name || ""}
                                                                                onChange={(e) => updateOp(idx, { new_column_name: e.target.value })}
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {op.op === "create_table" && (
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <div className="text-xs text-slate-600 mb-1">Table name</div>
                                                                            <Input
                                                                                value={op.table || ""}
                                                                                onChange={(e) => updateOp(idx, { table: e.target.value })}
                                                                                className="rounded-2xl"
                                                                            />
                                                                        </div>

                                                                        <div className="rounded-2xl border bg-slate-50 p-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="text-sm font-medium">Columns</div>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="rounded-2xl"
                                                                                    onClick={() => addCreateTableColumn(idx)}
                                                                                >
                                                                                    + Add column
                                                                                </Button>
                                                                            </div>

                                                                            <div className="mt-3 space-y-2">
                                                                                {(op.columns || []).map((c, ci) => (
                                                                                    <div key={ci} className="rounded-2xl border bg-white p-3">
                                                                                        <div className="grid md:grid-cols-2 gap-3">
                                                                                            <div>
                                                                                                <div className="text-xs text-slate-600 mb-1">Name</div>
                                                                                                <Input
                                                                                                    value={c.name || ""}
                                                                                                    onChange={(e) => updateCreateTableColumn(idx, ci, { name: e.target.value })}
                                                                                                    className="rounded-2xl"
                                                                                                />
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-xs text-slate-600 mb-1">Type</div>
                                                                                                <Select
                                                                                                    value={c.type || ""}
                                                                                                    onValueChange={(v) => updateCreateTableColumn(idx, ci, { type: v })}
                                                                                                >
                                                                                                    <SelectTrigger className="rounded-2xl">
                                                                                                        <SelectValue />
                                                                                                    </SelectTrigger>
                                                                                                    <SelectContent>
                                                                                                        {(types.length ? types : ["VARCHAR(255)", "INT", "DATETIME", "JSON"]).map((t) => (
                                                                                                            <SelectItem key={t} value={t}>
                                                                                                                {t}
                                                                                                            </SelectItem>
                                                                                                        ))}
                                                                                                    </SelectContent>
                                                                                                </Select>
                                                                                            </div>

                                                                                            <div className="rounded-2xl border p-3 bg-slate-50 flex items-center justify-between">
                                                                                                <div className="text-sm font-medium">Nullable</div>
                                                                                                <Switch checked={!!c.nullable} onCheckedChange={(v) => updateCreateTableColumn(idx, ci, { nullable: v })} />
                                                                                            </div>

                                                                                            <div>
                                                                                                <div className="text-xs text-slate-600 mb-1">Default</div>
                                                                                                <Input
                                                                                                    value={c.default ?? ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateCreateTableColumn(idx, ci, { default: e.target.value ? e.target.value : null })
                                                                                                    }
                                                                                                    placeholder="NULL | CURRENT_TIMESTAMP | 0 | 'abc'"
                                                                                                    className="rounded-2xl"
                                                                                                />
                                                                                            </div>

                                                                                            <div className="md:col-span-2 flex items-center gap-2">
                                                                                                <Input
                                                                                                    value={c.comment || ""}
                                                                                                    onChange={(e) => updateCreateTableColumn(idx, ci, { comment: e.target.value })}
                                                                                                    placeholder="comment (optional)"
                                                                                                    className="rounded-2xl"
                                                                                                />
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    className="rounded-2xl"
                                                                                                    onClick={() => removeCreateTableColumn(idx, ci)}
                                                                                                >
                                                                                                    <Trash2 className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>

                                            <Separator />

                                            <div className="flex flex-wrap gap-2">
                                                <Button onClick={doPlan} className="rounded-2xl" disabled={planning}>
                                                    {planning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                                                    Plan (Preview SQL)
                                                </Button>
                                                <Button onClick={doApply} className="rounded-2xl" variant="default" disabled={applying}>
                                                    {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                                    Apply (Create Job)
                                                </Button>
                                            </div>

                                            {/* Plan preview */}
                                            {plan && (
                                                <div className="rounded-3xl border bg-slate-50 p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-medium text-sm">SQL Preview</div>
                                                        <Badge
                                                            className={`rounded-full border ${plan.destructive_detected
                                                                    ? "bg-rose-100 text-rose-800 border-rose-200"
                                                                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                                }`}
                                                        >
                                                            {plan.destructive_detected ? "Destructive detected" : "Safe"}
                                                        </Badge>
                                                    </div>

                                                    {plan.global_sql?.length > 0 && (
                                                        <div className="mt-3">
                                                            <div className="text-xs text-slate-600 mb-1">Global SQL (runs once)</div>
                                                            <pre className="text-xs bg-white border rounded-2xl p-3 overflow-auto">
                                                                {plan.global_sql.join(";\n") + ";"}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 space-y-3">
                                                        {(plan.targets || []).slice(0, 8).map((t) => (
                                                            <div key={t.tenant_id} className="rounded-2xl border bg-white p-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-sm font-medium">{t.db_name}</div>
                                                                    <Badge variant="outline" className="rounded-full">#{t.tenant_id}</Badge>
                                                                </div>
                                                                <pre className="mt-2 text-xs bg-slate-50 border rounded-2xl p-3 overflow-auto">
                                                                    {(t.sql || []).join(";\n") + ((t.sql || []).length ? ";" : "")}
                                                                </pre>
                                                            </div>
                                                        ))}

                                                        {(plan.targets || []).length > 8 && (
                                                            <div className="text-xs text-slate-600">
                                                                Showing 8 tenants preview. Apply will run on all selected targets.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* JOBS */}
                            <TabsContent value="jobs" className="mt-4">
                                <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle>Jobs</CardTitle>
                                            <CardDescription>Track executions per tenant.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Button variant="outline" className="rounded-2xl w-full" onClick={loadJobs}>
                                                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh Jobs
                                            </Button>
                                            <ScrollArea className="h-[520px] pr-2">
                                                <div className="space-y-2">
                                                    {jobs.map((j) => (
                                                        <button
                                                            key={j.id}
                                                            onClick={() => openJob(j.id)}
                                                            className="w-full text-left rounded-2xl border p-3 bg-white hover:bg-slate-50 transition"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="font-medium truncate">{j.name}</div>
                                                                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(j.status)}`}>
                                                                    {j.status}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-600 mt-1">Job #{j.id}</div>
                                                        </button>
                                                    ))}
                                                    {!jobs.length && <div className="text-sm text-slate-600">No jobs</div>}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="flex items-center justify-between">
                                                <span>Job Details</span>
                                                {jobOpen?.job?.status === "RUNNING" && (
                                                    <Button
                                                        variant="outline"
                                                        className="rounded-2xl"
                                                        onClick={() => doCancel(jobOpen.job.id)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </CardTitle>
                                            <CardDescription>{jobOpen ? `Job #${jobOpen.job.id}` : "Select a job to view details"}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {jobLoading && (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                                </div>
                                            )}

                                            {!jobLoading && jobOpen && (
                                                <div className="space-y-3">
                                                    <div className="rounded-2xl border p-3 bg-slate-50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-medium">{jobOpen.job.name}</div>
                                                            <Badge className={`rounded-full border ${statusBadge(jobOpen.job.status)}`}>
                                                                {jobOpen.job.status}
                                                            </Badge>
                                                        </div>
                                                        {jobOpen.job.description && (
                                                            <div className="text-sm text-slate-700 mt-1">{jobOpen.job.description}</div>
                                                        )}
                                                    </div>

                                                    <div className="rounded-2xl border overflow-hidden">
                                                        <div className="px-3 py-2 bg-white border-b font-medium text-sm">Targets</div>
                                                        <div className="divide-y">
                                                            {jobOpen.targets.map((t) => (
                                                                <div key={t.tenant_id} className="p-3 flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="font-medium text-sm">Tenant #{t.tenant_id}</div>
                                                                        {t.error && <div className="text-xs text-rose-700 mt-1 break-words">{t.error}</div>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <Badge className={`rounded-full border ${statusBadge(t.status)}`}>{t.status}</Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!jobLoading && !jobOpen && (
                                                <div className="text-sm text-slate-600">Pick a job on the left.</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* STORAGE */}
                            <TabsContent value="storage" className="mt-4">
                                <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <HardDrive className="h-4 w-4" /> Volume Usage
                                            </CardTitle>
                                            <CardDescription>Grouped by tenant meta.volume_tag.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Button variant="outline" className="rounded-2xl w-full" onClick={loadStorage}>
                                                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                                            </Button>
                                            <div className="space-y-2">
                                                {volumes.map((v) => (
                                                    <div key={v.volume_tag} className="rounded-2xl border p-3 bg-white flex items-center justify-between">
                                                        <div className="font-medium">{v.volume_tag}</div>
                                                        <Badge variant="outline" className="rounded-full">{v.used_mb} MB</Badge>
                                                    </div>
                                                ))}
                                                {!volumes.length && <div className="text-sm text-slate-600">No data</div>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-3xl shadow-sm">
                                        <CardHeader>
                                            <CardTitle>Tenant Storage</CardTitle>
                                            <CardDescription>Shows usage for active tenants (limited for UI speed).</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-[520px] pr-2">
                                                <div className="space-y-2">
                                                    {tenants.filter((t) => t.is_active).map((t) => (
                                                        <div key={t.id} className="rounded-2xl border p-3 bg-white">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="font-medium truncate">{t.name}</div>
                                                                    <div className="text-xs text-slate-600 truncate">{t.code} • {t.db_name}</div>
                                                                </div>
                                                                <Badge variant="outline" className="rounded-full">
                                                                    {tenantUsage[t.id] == null ? "—" : `${tenantUsage[t.id]} MB`}
                                                                </Badge>
                                                            </div>

                                                            <div className="mt-3 flex items-center gap-2">
                                                                <div className="text-xs text-slate-600">Volume</div>
                                                                <Input
                                                                    defaultValue={t.volume_tag || "default"}
                                                                    className="rounded-2xl h-9"
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === "Enter") {
                                                                            const vol = e.currentTarget.value;
                                                                            try {
                                                                                await setTenantVolume(t.id, vol);
                                                                                toast.success("Volume updated");
                                                                                await refresh();
                                                                            } catch (err) {
                                                                                toast.error(errMsg(err, "Volume update failed"));
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="text-xs text-slate-500">Enter to save</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </motion.div>
            </div>
        </PermGate>
    );
}
