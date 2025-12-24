// frontend/src/components/emr/PatientHeaderCard.jsx
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

import { patientFullName, patientDobText, patientAgeText } from "./patientFormat"

export default function PatientHeaderCard({
    patient,
    rightActionLabel,
    onRightAction,
}) {
    if (!patient?.id) return null

    const name = patientFullName(patient)
    const uhid = patient?.uhid || "—"
    const phone = patient?.phone || "—"
    const dob = patientDobText(patient)
    const gender = patient?.gender || ""
    const age = patientAgeText(patient)

    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <div className="text-lg font-black text-slate-900 truncate">
                        {name}
                    </div>

                    <div className="mt-1 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <Badge variant="secondary">UHID</Badge>
                            <span className="font-semibold">{uhid}</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                            <Badge variant="secondary">Phone</Badge>
                            <span className="font-semibold">{phone}</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                            <Badge variant="secondary">DOB</Badge>
                            <span className="font-semibold">{dob}</span>
                        </span>

                        {!!age && (
                            <span className="inline-flex items-center gap-1">
                                <Badge variant="secondary">Age</Badge>
                                <span className="font-semibold">{age}</span>
                            </span>
                        )}

                        {!!gender && (
                            <span className="inline-flex items-center gap-1">
                                <Badge variant="secondary">Gender</Badge>
                                <span className="font-semibold">{gender}</span>
                            </span>
                        )}
                    </div>
                </div>

                {!!rightActionLabel && !!onRightAction && (
                    <Button variant="outline" onClick={onRightAction}>
                        <Download className="h-4 w-4 mr-2" />
                        {rightActionLabel}
                    </Button>
                )}
            </div>
        </div>
    )
}
