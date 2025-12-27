// FILE: frontend/src/ipd/nursing/ui/ClinicalRecordWorkspace.jsx
import { Search, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function ClinicalRecordWorkspace({
  title,
  subtitle,
  patientChips = [],
  alertsChips = [],
  canWrite,
  permissionHint,
  search,
  setSearch,
  form,
  history,
}) {
  return (
    <div className="min-h-[60vh]">
      {/* Title */}
      <div className="mb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">{title}</div>
            {subtitle ? <div className="text-sm text-zinc-500 mt-1">{subtitle}</div> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {patientChips.map((c) => (
              <Badge key={c} variant="secondary" className="rounded-full bg-zinc-100 text-zinc-700">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        {alertsChips?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {alertsChips.map((a) => (
              <Badge key={a.label} className={a.className}>
                {a.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {!canWrite ? (
        <div className="mb-3 rounded-xl border bg-white/70 p-3 text-sm text-zinc-700 flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 text-zinc-500" />
          <div>
            <div className="font-medium">View only</div>
            <div className="text-zinc-500 text-xs mt-0.5">
              {permissionHint || 'You don’t have permission to edit this module.'}
            </div>
          </div>
        </div>
      ) : null}

      {/* Split view */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">{form}</div>

        <div className="lg:col-span-5">
          <Card className="rounded-2xl border-zinc-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">History</CardTitle>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search notes, staff, status…"
                    className="h-10 pl-9 rounded-xl bg-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">{history}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
