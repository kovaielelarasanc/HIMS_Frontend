// FILE: src/billing/components/BillingLineItems.jsx
import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee } from "lucide-react";

export default function BillingLineItems({
    invoice,
    onAddManualItem,
    onUpdateItem,
    onVoidItem,
    disabled,
}) {
    const items = invoice?.items || [];

    // new manual item form
    const [desc, setDesc] = useState("");
    const [qty, setQty] = useState("1");
    const [price, setPrice] = useState("");
    const [gst, setGst] = useState("");
    const [discPercent, setDiscPercent] = useState("");

    const numericQty = Number(qty || 0) || 0;
    const numericPrice = Number(price || 0) || 0;
    const numericGst = Number(gst || 0) || 0;
    const numericDiscPercent = Number(discPercent || 0) || 0;

    const discountAmount = useMemo(() => {
        const base = numericQty * numericPrice;
        return (base * numericDiscPercent) / 100;
    }, [numericQty, numericPrice, numericDiscPercent]);

    const handleAdd = async () => {
        if (!desc.trim()) {
            alert("Enter particulars / description.");
            return;
        }
        if (!numericQty || !numericPrice) {
            alert("Enter valid quantity and price.");
            return;
        }
        const base = numericQty * numericPrice;
        const discAmt = discountAmount || 0;
        const effectiveBase = base - discAmt;
        const effectiveUnitPrice =
            numericQty > 0 ? effectiveBase / numericQty : numericPrice;

        const payload = {
            description:
                desc.trim() +
                (numericDiscPercent
                    ? ` (Disc ${numericDiscPercent}%: -${discAmt.toFixed(2)})`
                    : ""),
            quantity: numericQty,
            unit_price: effectiveUnitPrice,
            tax_rate: numericGst,
            service_type: "manual",
            service_ref_id: 0,
        };

        await onAddManualItem(payload);
        setDesc("");
        setQty("1");
        setPrice("");
        setGst("");
        setDiscPercent("");
    };

    const totalGross = items
        .filter((it) => !it.is_voided)
        .reduce((s, it) => s + Number(it.line_total || 0), 0);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Bill Items</CardTitle>
                    <div className="text-[11px] text-muted-foreground">
                        Gross total:{" "}
                        <span className="font-semibold flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" />
                            {totalGross.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col gap-3">
                {/* Items table */}
                <div className="border rounded-md overflow-hidden text-[11px] flex-1">
                    <div className="grid grid-cols-10 bg-muted px-2 py-1 font-medium">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-3">Particulars</div>
                        <div className="col-span-1 text-right">Qty</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">GST %</div>
                        <div className="col-span-1 text-right">GST Amt</div>
                        <div className="col-span-1 text-right">Disc %</div>
                        <div className="col-span-1 text-right">Total</div>
                    </div>
                    {items.map((it, idx) => {
                        const isVoided = it.is_voided;
                        const cls = isVoided
                            ? "opacity-60 line-through text-muted-foreground"
                            : "";
                        return (
                            <div
                                key={it.id}
                                className={`grid grid-cols-10 px-2 py-1 border-t text-[11px] ${cls}`}
                            >
                                <div className="col-span-1">{idx + 1}</div>
                                <div className="col-span-3 truncate">
                                    {it.description || `${it.service_type} #${it.service_ref_id}`}
                                </div>
                                <div className="col-span-1 text-right">
                                    {it.quantity || 0}
                                </div>
                                <div className="col-span-1 text-right">
                                    {Number(it.unit_price || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">
                                    {Number(it.tax_rate || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">
                                    {Number(it.tax_amount || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">—</div>
                                <div className="col-span-1 text-right">
                                    {Number(it.line_total || 0).toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                    {items.length === 0 && (
                        <div className="px-3 py-3 text-center text-muted-foreground text-[11px]">
                            No items added yet. Add manual items below.
                        </div>
                    )}
                </div>

                {/* Add manual item row */}
                <div className="border rounded-md p-2 space-y-2 bg-muted/40">
                    <div className="text-[11px] font-medium">
                        Add Manual Item (Charges, Procedures, Misc)
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-[11px] items-end">
                        <div className="col-span-4">
                            <label className="block mb-1">Particulars</label>
                            <Input
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                placeholder="e.g., Dressing charges"
                                className="h-8 text-[11px]"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block mb-1">Qty</label>
                            <Input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                className="h-8 text-[11px]"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block mb-1">Price</label>
                            <Input
                                type="number"
                                min={0}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="h-8 text-[11px]"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block mb-1">GST %</label>
                            <Input
                                type="number"
                                min={0}
                                value={gst}
                                onChange={(e) => setGst(e.target.value)}
                                className="h-8 text-[11px]"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block mb-1">Disc %</label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={discPercent}
                                onChange={(e) => setDiscPercent(e.target.value)}
                                className="h-8 text-[11px]"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <div className="text-muted-foreground">
                            Discount Amount (calculated):{" "}
                            <span className="font-semibold">
                                {discountAmount.toFixed(2)}
                            </span>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={disabled}
                            onClick={handleAdd}
                        >
                            Add Item
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
