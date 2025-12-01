// FILE: src/billing/components/BillingPaymentsSection.jsx
import { useState } from "react";
import { addPayment, deletePayment } from "@/api/billing";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, Trash2, Plus } from "lucide-react";

const MODE_LABELS = {
    cash: "Cash",
    card: "Card",
    upi: "UPI",
    credit: "Credit / TPA",
};

export default function BillingPaymentsSection({ invoice, onChanged }) {
    const [amount, setAmount] = useState("");
    const [mode, setMode] = useState("cash");
    const [refNo, setRefNo] = useState("");
    const [saving, setSaving] = useState(false);

    if (!invoice) return null;

    const net = Number(invoice.net_total || 0);
    const paid = Number(invoice.amount_paid || 0);
    const balance = Number(invoice.balance_due || 0);
    const payments = invoice.payments || [];

    const handleAdd = async () => {
        if (!amount || Number(amount) <= 0) {
            alert("Enter valid amount.");
            return;
        }
        try {
            setSaving(true);
            await addPayment(invoice.id, {
                amount: Number(amount),
                mode,
                reference_no: refNo || undefined,
            });
            setAmount("");
            setRefNo("");
            await onChanged?.();
        } catch (err) {
            console.error(err);
            alert("Failed to add payment.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddBalance = () => {
        if (balance <= 0) return;
        setAmount(balance.toFixed(2));
    };

    const handleDelete = async (pmt) => {
        if (!window.confirm("Delete this payment?")) return;
        try {
            await deletePayment(invoice.id, pmt.id);
            await onChanged?.();
        } catch (err) {
            console.error(err);
            alert("Failed to delete payment.");
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
                {/* Summary */}
                <div className="border rounded-lg p-3 space-y-1 text-[11px] bg-slate-50/60">
                    <div className="flex justify-between">
                        <span>Net amount</span>
                        <span className="font-medium">
                            <IndianRupee className="inline w-3 h-3 mr-0.5" />
                            {net.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Received</span>
                        <span className="font-medium text-emerald-700">
                            <IndianRupee className="inline w-3 h-3 mr-0.5" />
                            {paid.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <span>Balance</span>
                        <span className={balance > 0 ? "text-red-600" : "text-emerald-700"}>
                            <IndianRupee className="inline w-3 h-3 mr-0.5" />
                            {balance.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* New payment form */}
                <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-medium">
                        Add payment (multi-mode allowed)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] mb-1 block">Amount</label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-8 text-[11px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="mt-1"
                                onClick={handleAddBalance}
                                disabled={balance <= 0}
                            >
                                Fill balance ({balance.toFixed(2)})
                            </Button>
                        </div>
                        <div>
                            <label className="text-[10px] mb-1 block">Mode</label>
                            <Select value={mode} onValueChange={setMode}>
                                <SelectTrigger className="h-8 text-[11px]">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="upi">UPI</SelectItem>
                                    <SelectItem value="credit">Credit / TPA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] mb-1 block">
                                Ref / Txn No (optional)
                            </label>
                            <Input
                                value={refNo}
                                onChange={(e) => setRefNo(e.target.value)}
                                placeholder="Txn / cheque / UPI id"
                                className="h-8 text-[11px]"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleAdd}
                            disabled={saving}
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            {saving ? "Saving..." : "Add Payment"}
                        </Button>
                    </div>
                </div>

                {/* Payment history */}
                <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-6 bg-muted px-3 py-2 font-medium">
                        <div className="col-span-2">Date</div>
                        <div className="col-span-1">Mode</div>
                        <div className="col-span-2 text-right">Amount</div>
                        <div className="col-span-1 text-right">Action</div>
                    </div>
                    {payments.map((pmt) => (
                        <div
                            key={pmt.id}
                            className="grid grid-cols-6 px-3 py-2 border-t text-[11px]"
                        >
                            <div className="col-span-2">
                                {pmt.paid_at
                                    ? new Date(pmt.paid_at).toLocaleString()
                                    : "—"}
                                {pmt.reference_no && (
                                    <div className="text-[10px] text-muted-foreground">
                                        Ref: {pmt.reference_no}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-1">
                                {MODE_LABELS[pmt.mode] || pmt.mode}
                            </div>
                            <div className="col-span-2 text-right">
                                <IndianRupee className="inline w-3 h-3 mr-0.5" />
                                {Number(pmt.amount || 0).toFixed(2)}
                            </div>
                            <div className="col-span-1 text-right">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleDelete(pmt)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {payments.length === 0 && (
                        <div className="px-3 py-3 text-center text-muted-foreground text-[11px]">
                            No payments added yet.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
