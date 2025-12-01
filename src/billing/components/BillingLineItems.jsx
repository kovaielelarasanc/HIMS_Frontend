// FILE: src/billing/components/BillingLineItems.jsx
import { useEffect, useMemo, useState } from "react";
import {
    addManualItem,
    updateInvoiceItem,
    voidInvoiceItem,
    fetchUnbilledServices,
    bulkAddFromUnbilled,
} from "@/api/billing";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { IndianRupee, Plus, Trash2, ArrowDownCircle } from "lucide-react";

const SERVICE_LABELS = {
    lab: "Lab",
    radiology: "Radiology",
    pharmacy: "Pharmacy",
    opd: "OPD",
    ipd: "IPD",
    manual: "Manual",
};

export default function BillingLineItems({ invoice, masters, onChanged }) {
    const [manualDesc, setManualDesc] = useState("");
    const [manualQty, setManualQty] = useState(1);
    const [manualPrice, setManualPrice] = useState("");
    const [manualGst, setManualGst] = useState("");
    const [adding, setAdding] = useState(false);

    const [unbilled, setUnbilled] = useState([]);
    const [unbilledLoading, setUnbilledLoading] = useState(false);
    const [selectedUids, setSelectedUids] = useState([]);

    const [discountPercent, setDiscountPercent] = useState("");
    const [discountRemarks, setDiscountRemarks] = useState("");
    const [discountAuth, setDiscountAuth] = useState("");

    const gross = Number(invoice?.gross_total || 0);

    const discountAmountPreview = useMemo(() => {
        const p = Number(discountPercent || 0);
        if (!gross || !p) return 0;
        return (gross * p) / 100;
    }, [gross, discountPercent]);

    const loadUnbilled = async () => {
        if (!invoice?.id) return;
        try {
            setUnbilledLoading(true);
            const { data } = await fetchUnbilledServices(invoice.id);
            setUnbilled(data || []);
            setSelectedUids([]);
        } catch (err) {
            console.error(err);
            alert("Failed to load unbilled services.");
        } finally {
            setUnbilledLoading(false);
        }
    };

    const handleAddManual = async () => {
        if (!invoice?.id) return;
        if (!manualDesc || !manualPrice) {
            alert("Enter description and price.");
            return;
        }
        const qty = Number(manualQty || 1);
        const price = Number(manualPrice || 0);
        const taxRate = Number(manualGst || 0);

        try {
            setAdding(true);
            await addManualItem(invoice.id, {
                description: manualDesc,
                quantity: qty,
                unit_price: price,
                tax_rate: taxRate,
                service_type: "manual",
                service_ref_id: 0,
            });
            setManualDesc("");
            setManualQty(1);
            setManualPrice("");
            setManualGst("");
            await onChanged?.();
        } catch (err) {
            console.error(err);
            alert("Failed to add line item.");
        } finally {
            setAdding(false);
        }
    };

    const handleVoid = async (item) => {
        if (!invoice?.id) return;
        const reason = window.prompt(
            `Void this item?\n\n${item.description}\n\nReason:`,
            "Correction / discount adjustment"
        );
        if (reason === null) return;
        try {
            await voidInvoiceItem(invoice.id, item.id, { reason });
            await onChanged?.();
        } catch (err) {
            console.error(err);
            alert("Failed to void item.");
        }
    };

    const toggleUnbilledSelection = (uid) => {
        setSelectedUids((prev) =>
            prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
        );
    };

    const handleBulkAdd = async (all = false) => {
        if (!invoice?.id) return;
        const uids = all ? null : selectedUids;
        if (!all && (!uids || uids.length === 0)) {
            alert("Select at least one service.");
            return;
        }
        try {
            await bulkAddFromUnbilled(invoice.id, { uids });
            await onChanged?.();
            setSelectedUids([]);
            await loadUnbilled();
        } catch (err) {
            console.error(err);
            alert("Failed to add services.");
        }
    };

    const handleApplyDiscount = async () => {
        if (!invoice?.id) return;
        const p = Number(discountPercent || 0);
        if (!p || p <= 0) {
            alert("Enter a valid discount %.");
            return;
        }
        if (!window.confirm(`Apply ${p}% discount as a negative line item?`)) {
            return;
        }
        const amt = discountAmountPreview || 0;
        if (!amt) {
            alert("Discount amount is zero.");
            return;
        }
        const desc =
            `Discount ${p}%` +
            (discountRemarks ? ` — ${discountRemarks}` : "") +
            (discountAuth ? ` (Auth: ${discountAuth})` : "");
        try {
            await addManualItem(invoice.id, {
                description: desc,
                quantity: 1,
                unit_price: -amt, // negative amount as discount
                tax_rate: 0,
                service_type: "manual",
                service_ref_id: 0,
            });
            setDiscountPercent("");
            setDiscountRemarks("");
            setDiscountAuth("");
            await onChanged?.();
        } catch (err) {
            console.error(err);
            alert("Failed to apply discount.");
        }
    };

    const items = invoice?.items || [];

    return (
        <div className="space-y-4">
            {/* Line items table */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Line Items</CardTitle>
                    <div className="text-[11px] text-muted-foreground">
                        {items.length} item(s)
                    </div>
                </CardHeader>
                <CardContent className="text-[11px] space-y-3">
                    <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-12 bg-muted px-3 py-2 font-medium">
                            <div className="col-span-1">S. No</div>
                            <div className="col-span-4">Particulars</div>
                            <div className="col-span-1 text-right">QTY</div>
                            <div className="col-span-2 text-right">Price</div>
                            <div className="col-span-1 text-right">GST %</div>
                            <div className="col-span-2 text-right">Total</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>
                        {items.map((item, idx) => {
                            const total = Number(item.line_total || 0);
                            const isDiscount =
                                item.description &&
                                item.description.toLowerCase().includes("discount");
                            return (
                                <div
                                    key={item.id}
                                    className={`grid grid-cols-12 px-3 py-2 border-t ${item.is_voided ? "bg-red-50 text-red-500" : "hover:bg-muted/40"
                                        }`}
                                >
                                    <div className="col-span-1">{idx + 1}</div>
                                    <div className="col-span-4">
                                        <div className="font-medium truncate">{item.description}</div>
                                        <div className="text-[10px] text-muted-foreground flex gap-1 items-center">
                                            <Badge variant="outline">
                                                {SERVICE_LABELS[item.service_type] || item.service_type}
                                            </Badge>
                                            {item.is_voided && (
                                                <span className="text-[10px] text-red-600 ml-1">
                                                    Voided
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-1 text-right">{item.quantity}</div>
                                    <div className="col-span-2 text-right">
                                        <IndianRupee className="inline w-3 h-3 mr-0.5" />
                                        {Number(item.unit_price || 0).toFixed(2)}
                                    </div>
                                    <div className="col-span-1 text-right">
                                        {Number(item.tax_rate || 0).toFixed(2)}
                                    </div>
                                    <div
                                        className={`col-span-2 text-right ${isDiscount || total < 0 ? "text-emerald-700" : ""
                                            }`}
                                    >
                                        <IndianRupee className="inline w-3 h-3 mr-0.5" />
                                        {total.toFixed(2)}
                                    </div>
                                    <div className="col-span-1 text-right">
                                        {!item.is_voided && (
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleVoid(item)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {items.length === 0 && (
                            <div className="px-3 py-4 text-center text-muted-foreground">
                                No items added yet.
                            </div>
                        )}
                    </div>

                    {/* Manual add row */}
                    <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-medium">
                                Add manual item (procedure / misc / manual charge)
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <div className="md:col-span-3">
                                <label className="text-[10px] mb-1 block">Particulars</label>
                                <Input
                                    value={manualDesc}
                                    onChange={(e) => setManualDesc(e.target.value)}
                                    placeholder="e.g., Dressing charges"
                                    className="h-8 text-[11px]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] mb-1 block">QTY</label>
                                <Input
                                    type="number"
                                    value={manualQty}
                                    onChange={(e) => setManualQty(e.target.value)}
                                    className="h-8 text-[11px]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] mb-1 block">Unit Price</label>
                                <Input
                                    type="number"
                                    value={manualPrice}
                                    onChange={(e) => setManualPrice(e.target.value)}
                                    className="h-8 text-[11px]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] mb-1 block">GST %</label>
                                <Input
                                    type="number"
                                    value={manualGst}
                                    onChange={(e) => setManualGst(e.target.value)}
                                    className="h-8 text-[11px]"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleAddManual}
                                disabled={adding}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                {adding ? "Adding..." : "Add Item"}
                            </Button>
                        </div>
                    </div>

                    {/* Discount block using negative manual line */}
                    <div className="border rounded-lg p-3 space-y-2 bg-amber-50/40">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-medium">
                                Discount (Invoice level)
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                This will create a negative line item.
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div>
                                <label className="text-[10px] mb-1 block">Discount %</label>
                                <Input
                                    type="number"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(e.target.value)}
                                    placeholder="e.g., 10"
                                    className="h-8 text-[11px]"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[10px] mb-1 block">
                                    Remarks / Authorized by
                                </label>
                                <Textarea
                                    value={discountRemarks}
                                    onChange={(e) => setDiscountRemarks(e.target.value)}
                                    placeholder="Reason for discount"
                                    className="text-[11px] h-16"
                                />
                                <Input
                                    value={discountAuth}
                                    onChange={(e) => setDiscountAuth(e.target.value)}
                                    placeholder="Authorized by (Doctor / Manager)"
                                    className="mt-1 h-8 text-[11px]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <div className="text-muted-foreground">
                                Approx discount amount:{" "}
                                <span className="font-medium">
                                    <IndianRupee className="inline w-3 h-3 mr-0.5" />
                                    {discountAmountPreview.toFixed(2)}
                                </span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleApplyDiscount}
                                disabled={!discountPercent}
                            >
                                Apply Discount
                            </Button>
                        </div>
                    </div>

                    {/* Unbilled services import */}
                    <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-medium">
                                Add from unbilled services (OP/Lab/Radiology/Pharmacy)
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={loadUnbilled}
                                disabled={unbilledLoading}
                            >
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                                {unbilledLoading ? "Loading..." : "Load"}
                            </Button>
                        </div>

                        {unbilled.length > 0 && (
                            <div className="border rounded-md max-h-48 overflow-auto mt-2">
                                <div className="grid grid-cols-6 bg-muted px-2 py-1 font-medium">
                                    <div className="col-span-3">Service</div>
                                    <div className="col-span-2 text-right">Amount</div>
                                    <div className="col-span-1 text-right">Select</div>
                                </div>
                                {unbilled.map((u) => (
                                    <div
                                        key={u.uid}
                                        className="grid grid-cols-6 px-2 py-1 border-t text-[11px]"
                                    >
                                        <div className="col-span-3">
                                            <div className="font-medium">{u.label}</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {u.source_type} #{u.source_id}
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <IndianRupee className="inline w-3 h-3 mr-0.5" />
                                            {Number(u.amount || 0).toFixed(2)}
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <input
                                                type="checkbox"
                                                className="h-3 w-3"
                                                checked={selectedUids.includes(u.uid)}
                                                onChange={() => toggleUnbilledSelection(u.uid)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {unbilled.length > 0 && (
                            <div className="flex justify-end gap-2 mt-2 text-[11px]">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAdd(false)}
                                    disabled={selectedUids.length === 0}
                                >
                                    Add selected ({selectedUids.length})
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleBulkAdd(true)}
                                >
                                    Add all
                                </Button>
                            </div>
                        )}

                        {!unbilledLoading && unbilled.length === 0 && (
                            <div className="text-[11px] text-muted-foreground">
                                No unbilled services loaded yet. Click "Load" to fetch pending
                                orders linked to this patient/visit.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
