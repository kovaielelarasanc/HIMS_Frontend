// FILE: src/billing/CreditMasterPage.jsx
import { useEffect, useState } from "react";
import {
    listPayers,
    createPayer,
    updatePayer,
    deletePayer,
    listTpas,
    createTpa,
    updateTpa,
    deleteTpa,
    listCreditPlans,
    createCreditPlan,
    updateCreditPlan,
    deleteCreditPlan,
    listCreditProviders,
    createCreditProvider,
    updateCreditProvider,
    deleteCreditProvider,
} from "../api/creditMasters";

const ENTITY_CONFIG = {
    payers: {
        title: "Payers (Insurance / Corporate / Govt)",
        list: listPayers,
        create: createPayer,
        update: updatePayer,
        remove: deletePayer,
        fields: [
            { name: "code", label: "Code", required: true },
            { name: "name", label: "Name", required: true },
            { name: "payer_type", label: "Type (insurance/corporate/govt)", required: true },
            { name: "contact_person", label: "Contact Person" },
            { name: "phone", label: "Phone" },
            { name: "email", label: "Email" },
        ],
    },
    tpas: {
        title: "TPA Masters",
        list: listTpas,
        create: createTpa,
        update: updateTpa,
        remove: deleteTpa,
        fields: [
            { name: "code", label: "Code", required: true },
            { name: "name", label: "Name", required: true },
            { name: "payer_id", label: "Payer ID (link)", required: false },
            { name: "contact_person", label: "Contact Person" },
            { name: "phone", label: "Phone" },
            { name: "email", label: "Email" },
        ],
    },
    creditPlans: {
        title: "Credit / Insurance Plans",
        list: listCreditPlans,
        create: createCreditPlan,
        update: updateCreditPlan,
        remove: deleteCreditPlan,
        fields: [
            { name: "code", label: "Code", required: true },
            { name: "name", label: "Name", required: true },
            { name: "payer_id", label: "Payer ID" },
            { name: "tpa_id", label: "TPA ID" },
            { name: "description", label: "Description" },
        ],
    },
    creditProviders: {
        title: "Credit Providers",
        list: listCreditProviders,
        create: createCreditProvider,
        update: updateCreditProvider,
        remove: deleteCreditProvider,
        fields: [
            { name: "name", label: "Name", required: true },
            { name: "display_name", label: "Display Name" },
            { name: "code", label: "Code" },
            { name: "type", label: "Type (insurance/corporate/govt/other)" },
        ],
    },
};

function MasterForm({ entityKey, editing, onCancel, onSaved }) {
    const cfg = ENTITY_CONFIG[entityKey];
    const [form, setForm] = useState(() => editing || {});

    useEffect(() => {
        setForm(editing || {});
    }, [editing]);

    const handleChange = (name, value) => {
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const api = editing?.id ? cfg.update : cfg.create;
        const id = editing?.id;
        const payload = { ...form };
        try {
            if (id) {
                await api(id, payload);
            } else {
                await api(payload);
            }
            onSaved();
        } catch (err) {
            console.error(err);
            alert("Save failed");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">
                    {editing ? "Edit" : "Add"} {cfg.title}
                </h2>
                {editing && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        Clear
                    </button>
                )}
            </div>

            {cfg.fields.map((f) => (
                <div key={f.name} className="space-y-1">
                    <label className="block text-xs font-medium text-gray-700">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        className="w-full border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring focus:ring-indigo-200"
                        value={form[f.name] ?? ""}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                    />
                </div>
            ))}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1 text-xs border rounded-md text-gray-600 hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    {editing ? "Update" : "Save"}
                </button>
            </div>
        </form>
    );
}

export function CreditMasterPage({ entity }) {
    const cfg = ENTITY_CONFIG[entity];
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await cfg.list();
            setRows(data || []);
        } catch (err) {
            console.error(err);
            alert("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [entity]);

    const handleDelete = async (row) => {
        if (!window.confirm("Delete this record?")) return;
        try {
            await cfg.remove(row.id);
            load();
        } catch (err) {
            console.error(err);
            alert("Delete failed");
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">{cfg.title}</h1>
                <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1 text-xs rounded-md border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                >
                    New
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-1 text-left font-semibold text-gray-600">ID</th>
                                {cfg.fields.map((f) => (
                                    <th
                                        key={f.name}
                                        className="px-2 py-1 text-left font-semibold text-gray-600"
                                    >
                                        {f.label}
                                    </th>
                                ))}
                                <th className="px-2 py-1 text-right font-semibold text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="px-2 py-2 text-center text-gray-500 text-xs" colSpan={cfg.fields.length + 2}>
                                        Loading...
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td className="px-2 py-2 text-center text-gray-500 text-xs" colSpan={cfg.fields.length + 2}>
                                        No records yet.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                rows.map((row) => (
                                    <tr key={row.id} className="border-t">
                                        <td className="px-2 py-1">{row.id}</td>
                                        {cfg.fields.map((f) => (
                                            <td key={f.name} className="px-2 py-1">
                                                {row[f.name] ?? ""}
                                            </td>
                                        ))}
                                        <td className="px-2 py-1 text-right space-x-2">
                                            <button
                                                onClick={() => setEditing(row)}
                                                className="text-[11px] text-indigo-600 hover:underline"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="text-[11px] text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                <MasterForm
                    entityKey={entity}
                    editing={editing}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        load();
                    }}
                />
            </div>
        </div>
    );
}

// Small wrappers so you can mount them in your router easily:

export function PayersPage() {
    return <CreditMasterPage entity="payers" />;
}

export function TpasPage() {
    return <CreditMasterPage entity="tpas" />;
}

export function CreditPlansPage() {
    return <CreditMasterPage entity="creditPlans" />;
}

export function CreditProvidersPage() {
    return <CreditMasterPage entity="creditProviders" />;
}
