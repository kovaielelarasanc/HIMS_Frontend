// FILE: src/billing/components/BillingSummaryCard.jsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { updateInvoice } from "@/api/billing";
import { toast } from "sonner";
import {
    FileText,
    Percent,
    IndianRupee,
    Tag,
    Info,
} from "lucide-react";

export default function BillingSummaryCard({
    invoice,
    billingTypeLabel,
    onInvoiceChange,
}) {
    const [openDiscount, setOpenDiscount] = useState(false);
    const [discPercent, setDiscPercent] = useState("");
    const [discAmount, setDiscAmount] = useState("");
    const [discRemarks, setDiscRemarks] = useState("");
    const [discAuthName, setDiscAuthName] = useState("");
    const [savingDiscount, setSavingDiscount] = useState(false);

    const gross = Number(invoice?.gross_total || 0);
    const discountTotal = Number(invoice?.discount_total || 0);
    const taxTotal = Number(invoice?.tax_total || 0);
    const net = Number(invoice?.net_total || 0);

    const handleOpenDiscount = () => {
        setDiscPercent(
            invoice?.header_discount_percent != null
                ? String(invoice.header_discount_percent)
                : ""
        );
        setDiscAmount(
            invoice?.header_discount_amount != null
                ? String(invoice.header_discount_amount)
                : ""
        );
        setDiscRemarks(invoice?.discount_remarks || "");
        setDiscAuthName("");
        setOpenDiscount(true);
    };

    const handleApplyDiscount = async () => {
        if (!invoice?.id) return;

        let headerAmount = discAmount ? Number(discAmount) || 0 : 0;
        if (!headerAmount && discPercent) {
            const pct = Number(discPercent) || 0;
            headerAmount = (gross * pct) / 100;
        }

        try {
            setSavingDiscount(true);
            const { data } = await updateInvoice(invoice.id, {
                header_discount_percent: discPercent
                    ? Number(discPercent)
                    : invoice.header_discount_percent,
                header_discount_amount: headerAmount,
                discount_remarks: discAuthName
                    ? `${discRemarks || ""} | Authorized by: ${discAuthName}`
                    : discRemarks || "",
            });
            onInvoiceChange?.(data);
            toast.success("Discount applied");
            setOpenDiscount(false);
        } catch (e) {
            console.error(e);
            toast.error("Failed to apply discount");
        } finally {
            setSavingDiscount(false);
        }
    };

    return (
        <>
            <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {billingTypeLabel} Invoice
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                            {invoice?.status?.toUpperCase() || "DRAFT"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-4 text-xs">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Invoice No</span>
                            <span className="font-semibold">
                                {invoice?.invoice_number || `#${invoice?.id || "-"}`}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Patient ID</span>
                            <span>{invoice?.patient_id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Context</span>
                            <span>
                                {invoice?.context_type || "-"} #{invoice?.context_id || "-"}
                            </span>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                            <span>Gross Total</span>
                            <span className="flex items-center gap-1">
                                <IndianRupee className="w-3 h-3" />
                                {gross.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Discount Total</span>
                            <span className="flex items-center gap-1 text-amber-700">
                                <IndianRupee className="w-3 h-3" />
                                {discountTotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tax Total</span>
                            <span className="flex items-center gap-1">
                                <IndianRupee className="w-3 h-3" />
                                {taxTotal.toFixed(2)}
                            </span>
                        </div>

                        <Separator className="my-1" />

                        <div className="flex justify-between items-center">
                            <span className="font-semibold flex items-center gap-1">
                                Net Payable
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-base">
                                <IndianRupee className="w-4 h-4" />
                                {net.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-center text-xs"
                            onClick={handleOpenDiscount}
                        >
                            <Tag className="w-3 h-3 mr-1" />
                            Apply Header Discount
                        </Button>
                        <div className="text-[10px] text-muted-foreground flex items-start gap-1">
                            <Info className="w-3 h-3 mt-[2px]" />
                            When you apply discount %, fields for &ldquo;Discount remarks&rdquo; and
                            &ldquo;Discount Authorized by&rdquo; are captured for audit.
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={openDiscount} onOpenChange={setOpenDiscount}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invoice Discount</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm mt-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs mb-1 flex items-center gap-1">
                                    Discount % (Header)
                                    <Percent className="w-3 h-3 text-muted-foreground" />
                                </label>
                                <Input
                                    type="number"
                                    value={discPercent}
                                    onChange={(e) => setDiscPercent(e.target.value)}
                                    placeholder="e.g., 10"
                                />
                            </div>
                            <div>
                                <label className="text-xs mb-1 flex items-center gap-1">
                                    Discount Amount
                                    <IndianRupee className="w-3 h-3 text-muted-foreground" />
                                </label>
                                <Input
                                    type="number"
                                    value={discAmount}
                                    onChange={(e) => setDiscAmount(e.target.value)}
                                    placeholder="Optional override"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    If left blank, amount is auto-calculated from % on gross.
                                </p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs mb-1">Discount Remarks</label>
                            <Input
                                value={discRemarks}
                                onChange={(e) => setDiscRemarks(e.target.value)}
                                placeholder="Reason for discount"
                            />
                        </div>
                        <div>
                            <label className="text-xs mb-1">Discount Authorized by</label>
                            <Input
                                value={discAuthName}
                                onChange={(e) => setDiscAuthName(e.target.value)}
                                placeholder="Name / ID of authority"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                This is stored inside discount remarks for audit trail.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpenDiscount(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleApplyDiscount}
                                disabled={savingDiscount}
                            >
                                {savingDiscount ? "Saving..." : "Apply"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
