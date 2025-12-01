// FILE: src/patients/PatientPage.jsx
import { useEffect, useState } from 'react';
import {
    listPatients,
    deactivatePatient,
    getPatientMastersAll,
} from '../api/patients';
import PatientFormModal from './PatientForm'; // or './PatientFormModal' based on your filename
import PatientDetailDrawer from './PatientDetailDrawer';

export default function PatientPage() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [editingPatient, setEditingPatient] = useState(null);

    const [lookups, setLookups] = useState({
        refSources: [],
        doctors: [],
        payers: [],
        tpas: [],
        creditPlans: [],
    });

    const [error, setError] = useState('');

    useEffect(() => {
        loadPatients();
        loadLookups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadPatients = async (search = q) => {
        setLoading(true);
        setError('');
        try {
            const res = await listPatients(search);
            setPatients(res.data || []);
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load patients';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const loadLookups = async () => {
        try {
            const res = await getPatientMastersAll();
            const data = res.data || {};
            setLookups({
                refSources: data.reference_sources || [],
                doctors: data.doctors || [],
                payers: data.payers || [],
                tpas: data.tpas || [],
                creditPlans: data.credit_plans || [],
            });
        } catch {
            // not critical; ignore for now
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadPatients(q);
    };

    const handleNew = () => {
        setEditingPatient(null);
        setFormOpen(true);
    };

    const handleEdit = (p) => {
        setEditingPatient(p);
        setFormOpen(true);
    };

    const handleView = (p) => {
        setSelectedPatient(p);
        setDetailOpen(true);
    };

    const handleDeactivate = async (p) => {
        if (!window.confirm(`Deactivate patient ${p.first_name}?`)) return;
        try {
            await deactivatePatient(p.id);
            await loadPatients();
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to deactivate patient';
            alert(msg);
        }
    };

    const updatePatientInList = (updated) => {
        setPatients((prev) => {
            const idx = prev.findIndex((p) => p.id === updated.id);
            if (idx === -1) return prev;
            const clone = [...prev];
            clone[idx] = updated;
            return clone;
        });
    };

    return (
        <div className="h-full flex flex-col px-3 py-3 sm:px-5 sm:py-4 gap-3 bg-white rounded">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">
                        Patient Management
                    </h1>
                    <p className="text-xs text-slate-500">
                        Register patients, manage profiles, attachments, consents and ABHA.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleNew}
                    className="self-start px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                    + New Patient
                </button>
            </div>

            {/* Search */}
            <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col sm:flex-row gap-2"
            >
                <input
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Search by UHID, name, mobile, email..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <button
                    type="submit"
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                    Search
                </button>
            </form>

            {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:block flex-1 border border-slate-200 rounded-2xl overflow-auto bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                                UHID / Name
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                                Demographics
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                                Contact
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                                Tags
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-3 py-4 text-center text-xs text-slate-500"
                                >
                                    Loading patients…
                                </td>
                            </tr>
                        )}
                        {!loading && patients.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-3 py-4 text-center text-xs text-slate-500"
                                >
                                    No patients found.
                                </td>
                            </tr>
                        )}
                        {patients.map((p, idx) => (
                            <tr
                                key={p.id}
                                className={`border-t border-slate-100 hover:bg-slate-50/70 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''
                                    }`}
                            >
                                <td className="px-3 py-2 align-top">
                                    <div className="font-medium text-slate-900">
                                        {p.first_name} {p.last_name || ''}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        UHID: {p.uhid}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        Age: {p.age_text || '—'}
                                    </div>
                                </td>
                                <td className="px-3 py-2 align-top text-xs text-slate-700">
                                    <div>Gender: {p.gender}</div>
                                    <div>Blood: {p.blood_group || '—'}</div>
                                    <div>Marital: {p.marital_status || '—'}</div>
                                </td>
                                <td className="px-3 py-2 align-top text-xs text-slate-700">
                                    <div>Mobile: {p.phone || '—'}</div>
                                    <div>Email: {p.email || '—'}</div>
                                </td>
                                <td className="px-3 py-2 align-top text-xs text-slate-700">
                                    <div>Type: {p.patient_type || '—'}</div>
                                    <div>Tag: {p.tag || '—'}</div>
                                </td>
                                <td className="px-3 py-2 align-top text-right text-xs">
                                    <div className="flex justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleView(p)}
                                            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(p)}
                                            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeactivate(p)}
                                            className="px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            Deactivate
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
                {loading && (
                    <div className="text-xs text-slate-500">Loading patients…</div>
                )}
                {!loading && patients.length === 0 && (
                    <div className="text-xs text-slate-500">No patients found.</div>
                )}
                {patients.map((p) => (
                    <div
                        key={p.id}
                        className="bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {p.first_name} {p.last_name || ''}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    UHID: {p.uhid} · Age: {p.age_text || '—'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {p.gender} · Blood: {p.blood_group || '—'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {p.phone || 'No mobile'}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleView(p)}
                                    className="px-2 py-1 text-[11px] rounded-md border border-slate-200 text-slate-700"
                                >
                                    View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleEdit(p)}
                                    className="px-2 py-1 text-[11px] rounded-md border border-slate-200 text-slate-700"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeactivate(p)}
                                    className="px-2 py-1 text-[11px] rounded-md border border-red-200 text-red-600"
                                >
                                    Deactivate
                                </button>
                            </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-600">
                            {p.patient_type && (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-900/5 text-slate-900 border border-slate-200">
                                    {p.patient_type}
                                </span>
                            )}
                            {p.tag && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    {p.tag}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modals / Drawers */}
            <PatientFormModal
                open={formOpen}
                onClose={() => setFormOpen(false)}
                onSaved={() => loadPatients()}
                initialPatient={editingPatient}
                lookups={lookups}
            />

            <PatientDetailDrawer
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                patient={selectedPatient}
                onUpdated={updatePatientInList}
            />
        </div>
    );
}
