import { Link } from 'react-router-dom'

export default function OrdersTab({ admissionId, admission, patient, canWrite }) {
    return (
        <div className="space-y-4 text-sm text-black">
            <h2 className="font-semibold">IPD Orders</h2>

            <div className="rounded-xl border bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-800">
                This tab is designed as a hub for **Lab / Radiology / Procedure**
                orders from IPD. You can wire it to your existing Lab & RIS
                order screens using the admission / patient context.
            </div>

            <div className="rounded-xl border bg-white p-3 space-y-2">
                <div className="text-xs text-gray-600">
                    Admission ID: <span className="font-mono">ADM-{String(admissionId).padStart(6, '0')}</span>
                </div>
                <div className="text-xs text-gray-600">
                    Patient: <span className="font-medium">
                        {patient?.uhid || `P-${admission?.patient_id}`}
                    </span>
                </div>

                {/* Example placeholder actions – update routes as per your app */}
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <Link
                        to="/lab/orders/new"
                        state={{ fromAdmissionId: admissionId, patient }}
                        className="btn text-center text-xs md:text-sm"
                    >
                        New Lab Order
                    </Link>
                    <Link
                        to="/ris/orders/new"
                        state={{ fromAdmissionId: admissionId, patient }}
                        className="btn text-center text-xs md:text-sm"
                    >
                        New Radiology Order
                    </Link>
                    <Link
                        to="/procedures/new"
                        state={{ fromAdmissionId: admissionId, patient }}
                        className="btn text-center text-xs md:text-sm"
                    >
                        New Procedure Order
                    </Link>
                </div>
            </div>
        </div>
    )
}
