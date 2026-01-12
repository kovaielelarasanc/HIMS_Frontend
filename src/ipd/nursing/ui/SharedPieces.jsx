// FILE: frontend/src/ipd/nursing/ui/SharedPieces.jsx

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, User, Clock, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtIST, statusTone, toneClass } from './utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function SectionCard({ title, subtitle, right, children }) {
  return (
    <Card className="rounded-2xl border-zinc-200 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle ? <div className="text-xs text-zinc-500 mt-1">{subtitle}</div> : null}
          </div>
          {right}
        </div>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  )
}

export function StatusPill({ status }) {
  const tone = statusTone(status)
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${toneClass(
        tone,
      )}`}
    >
      {status || '—'}
    </span>
  )
}

export function AuditRow({ createdAt, createdBy, updatedAt, updatedBy, editReason }) {
  return (
    <div className="mt-3 rounded-xl border bg-zinc-50 p-3 text-xs text-zinc-600">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> Created: {(createdAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <User className="h-3.5 w-3.5" /> By: {createdBy ?? '—'}
        </span>

        {updatedAt ? (
          <>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Updated: {fmtIST(updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> By: {updatedBy ?? '—'}
            </span>
          </>
        ) : null}
      </div>

      {editReason ? <div className="mt-2 text-zinc-700">Edit reason: {editReason}</div> : null}
    </div>
  )
}

export function TimelineCard({
  title,
  subtitle,
  status,
  metaLeft,
  metaRight,
  canEdit,
  onEdit,
  children,
  audit,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-medium text-sm text-zinc-900">{title}</div>
              <StatusPill status={status} />
            </div>
            {subtitle ? <div className="text-xs text-zinc-500 mt-1">{subtitle}</div> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {metaLeft}
              {metaRight}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit ? (
              <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-xl"
              onClick={() => setOpen((s) => !s)}
              aria-expanded={open}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3"
            >
              <Separator className="mb-3" />
              {children}
              {audit}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function StickyActionBar({
  canWrite,
  onDraft,
  onSubmit,
  submitting,
  draftLabel = 'Save draft',
  submitLabel = 'Save',
}) {
  if (!canWrite) return null
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="mx-auto max-w-[980px] px-4 pb-4">
        <div className="rounded-2xl border bg-white/95 backdrop-blur shadow-sm p-2 flex items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl flex-1"
            onClick={onDraft}
            disabled={submitting}
          >
            {draftLabel}
          </Button>
          <Button className="h-11 rounded-xl flex-1" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function EditReasonDialog({ open, setOpen, onConfirm, title = 'Confirm update' }) {
  const [reason, setReason] = useState('')
  const valid = useMemo(() => reason.trim().length >= 3, [reason])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-zinc-600" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-zinc-600">
          NABH audit requires a reason for edits. Enter a short reason.
        </div>

        <div className="mt-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., corrected entry / updated due time"
            className="h-11 rounded-xl"
          />
          <div className="text-xs text-zinc-500 mt-1">Minimum 3 characters.</div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => {
              if (!valid) return
              onConfirm(reason.trim())
              setReason('')
            }}
            disabled={!valid}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
