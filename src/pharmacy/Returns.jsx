// src/pharmacy/Returns.jsx
import { useState } from 'react'
import PermGate from '../components/PermGate'
import { saleReturn } from '../api/pharmacy'

import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'

import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function Returns() {
    const [saleId, setSaleId] = useState('')
    const [saleItemId, setItemId] = useState('')
    const [qty, setQty] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [last, setLast] = useState(null) // { lot_on_hand }

    const ensureNum = (v) => v.replace(/[^\d]/g, '')

    const canSubmit = !!saleId && !!saleItemId && Number(qty) > 0

    const submit = async () => {
        // basic guardrails
        if (!saleId) { toast.error('Sale ID required'); return }
        if (!saleItemId) { toast.error('Sale Item ID required'); return }
        if (!qty || Number(qty) <= 0) { toast.error('Quantity must be > 0'); return }

        setSubmitting(true)
        setLast(null)
        try {
            const { data } = await saleReturn({
                sale_id: Number(saleId),
                sale_item_id: Number(saleItemId),
                qty: Number(qty),
            })
            setSaleId(''); setItemId(''); setQty('')
            setLast(data || null)

            toast.success('Return accepted', {
                description: data?.lot_on_hand != null
                    ? `Updated lot on-hand: ${data.lot_on_hand}`
                    : 'Stock updated successfully.',
            })
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Could not process the return. Please try again.'
            toast.error('Return failed', { description: msg })
        } finally {
            setSubmitting(false)
        }
    }

    const onEnter = (e) => {
        if (e.key === 'Enter' && canSubmit && !submitting) submit()
    }

    return (
        <div className="p-4 space-y-4">
            {/* If you already have a global <Toaster />, you can remove this one */}
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Returns</h1>
            </div>

            <PermGate anyOf={['pharmacy.returns.manage']}>
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    <Card className="overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Return to Stock</CardTitle>
                        </CardHeader>

                        <CardContent className="p-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-4 items-end">
                                <div>
                                    <Label>Sale ID</Label>
                                    <Input
                                        inputMode="numeric"
                                        value={saleId}
                                        onChange={e => setSaleId(ensureNum(e.target.value))}
                                        onKeyDown={onEnter}
                                        placeholder="e.g. 1024"
                                    />
                                </div>

                                <div>
                                    <Label>Sale Item ID</Label>
                                    <Input
                                        inputMode="numeric"
                                        value={saleItemId}
                                        onChange={e => setItemId(ensureNum(e.target.value))}
                                        onKeyDown={onEnter}
                                        placeholder="e.g. 3011"
                                    />
                                </div>

                                <div>
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        onKeyDown={onEnter}
                                        placeholder="e.g. 2"
                                    />
                                </div>

                                <div className="flex items-end">
                                    <Button
                                        className="w-full md:w-auto"
                                        onClick={submit}
                                        disabled={!canSubmit || submitting}
                                    >
                                        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                                        Return
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            {/* Helper / Hints */}
                            <div className="text-xs text-gray-500 grid gap-1 md:grid-cols-2">
                                <div>Tip: Return uses the **exact sale item’s lot** and credits stock back to that lot.</div>
                                <div>If the sale had multiple lots, return line-by-line using each Sale Item ID.</div>
                            </div>

                            {/* Success summary */}
                            {last && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                                >
                                    Return accepted. {last.lot_on_hand != null ? (
                                        <>Lot on-hand is now <span className="font-medium">{last.lot_on_hand}</span>.</>
                                    ) : 'Stock updated.'}
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </PermGate>
        </div>
    )
}
