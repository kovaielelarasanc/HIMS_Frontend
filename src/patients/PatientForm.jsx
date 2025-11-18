import { useState } from 'react'
import { usePatients } from '../store/patientStore'
import QRCodeBadge from '../components/QRCodeBadge'
import AbhaLinker from '../components/AbhaLinker'
import DocumentUpload from '../components/DocumentUpload'
import { useCan } from '../hooks/useCan'

export default function PatientForm({ onCreated }) {
    const { create, listDocs } = usePatients()
    const canCreate = useCan('patients.create')
    const canAttach = useCan('patients.attachments.manage')

    const [form, setForm] = useState({
        first_name: '', last_name: '', gender: 'male', dob: '', phone: '', email: '',
        aadhar_last4: '', address: { type: 'current', line1: '', line2: '', city: '', state: '', pincode: '' }
    })
    const [created, setCreated] = useState(null)
    const [docs, setDocs] = useState([])
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        if (!canCreate) { setErr('You do not have permission to register patients'); return }
        setLoading(true); setErr('')
        try {
            const p = await create(form)
            setCreated(p)
            onCreated && onCreated(p)
            const d = await listDocs(p.id); setDocs(d)
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to create')
        } finally { setLoading(false) }
    }

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* left: form */}
            <form onSubmit={submit} className="md:col-span-2 card space-y-3">
                <h3 className="text-lg font-semibold">Patient Registration</h3>

                <div className="grid sm:grid-cols-2 gap-3">
                    <input className="input" placeholder="First name" value={form.first_name}
                        onChange={e => setForm({ ...form, first_name: e.target.value })} required />
                    <input className="input" placeholder="Last name" value={form.last_name}
                        onChange={e => setForm({ ...form, last_name: e.target.value })} />
                    <select className="input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                        <option>male</option><option>female</option><option>other</option>
                    </select>
                    <input className="input" type="date" value={form.dob}
                        onChange={e => setForm({ ...form, dob: e.target.value })} />
                    <input className="input" placeholder="Phone" value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })} />
                    <input className="input" placeholder="Email" type="email" value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })} />
                    <input className="input" placeholder="Aadhaar last 4" maxLength={4} value={form.aadhar_last4}
                        onChange={e => setForm({ ...form, aadhar_last4: e.target.value.replace(/\D/g, '') })} />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                    <input className="input" placeholder="Address line 1" value={form.address.line1}
                        onChange={e => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} />
                    <input className="input" placeholder="Address line 2" value={form.address.line2}
                        onChange={e => setForm({ ...form, address: { ...form.address, line2: e.target.value } })} />
                    <input className="input" placeholder="City" value={form.address.city}
                        onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                    <input className="input" placeholder="State" value={form.address.state}
                        onChange={e => setForm({ ...form, address: { ...form.address, state: e.target.value } })} />
                    <input className="input" placeholder="Pincode" value={form.address.pincode}
                        onChange={e => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} />
                </div>

                <button className="btn" disabled={loading}>{loading ? 'Saving...' : 'Register'}</button>
                {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            </form>

            {/* right: after-create panel */}
            <div className="space-y-3">
                <div className="card space-y-3">
                    <h3 className="text-lg font-semibold">Identification</h3>
                    {created ? (
                        <>
                            <QRCodeBadge value={created.uhid} />
                            <div className="text-sm text-gray-600">
                                Name: <b>{created.first_name} {created.last_name}</b><br />
                                Gender: {created.gender} | DOB: {created.dob || '—'}
                            </div>
                            <AbhaLinker patient={created} />
                        </>
                    ) : (
                        <div className="text-sm text-gray-500">Register patient to generate UHID & link ABHA.</div>
                    )}
                </div>

                <div className="card space-y-2">
                    <h3 className="text-lg font-semibold">Attachments</h3>
                    {!created ? (
                        <div className="text-sm text-gray-500">Create patient to upload documents.</div>
                    ) : (
                        <>
                            {canAttach && <DocumentUpload patientId={created.id} onUploaded={() => { }} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
