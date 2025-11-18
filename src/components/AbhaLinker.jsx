import { useState } from 'react'
import { usePatients } from '../store/patientStore'

export default function AbhaLinker({ patient }) {
    const { abhaGenerate, abhaVerify } = usePatients()
    const [txn, setTxn] = useState(null)
    const [otp, setOtp] = useState('')
    const [msg, setMsg] = useState('')

    const gen = async () => {
        setMsg('')
        const name = `${patient.first_name} ${patient.last_name || ''}`.trim()
        const dob = patient.dob || ''
        const mobile = '' // optional in this stub; pass empty or implement phone
        const res = await abhaGenerate({ name, dob, mobile })
        setTxn(res.txnId)
        setMsg(`OTP sent (dev: ${res.debug_otp})`)
    }

    const verify = async () => {
        const res = await abhaVerify({ txnId: txn, otp, patient_id: patient.id })
        setMsg(`Linked: ${res.abha_number}`)
    }

    if (patient.abha_number) {
        return <div className="text-sm text-emerald-700">ABHA Linked: <b>{patient.abha_number}</b></div>
    }

    return (
        <div className="space-y-2">
            {!txn ? (
                <button className="px-3 py-2 rounded-xl border hover:bg-gray-50" type="button" onClick={gen}>
                    Generate & Link ABHA
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <input className="input" placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} />
                    <button className="btn" type="button" onClick={verify}>Verify</button>
                </div>
            )}
            {msg && <div className="text-xs text-gray-600">{msg}</div>}
        </div>
    )
}
