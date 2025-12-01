// FILE: src/billing/components/ProviderSelect.jsx
import { useEffect, useState } from "react";
import { listProviders } from "@/api/billing";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createProvider } from "@/api/billing";

export default function ProviderSelect({ value, onChange }) {
    const [providers, setProviders] = useState([]);
    const [openNew, setOpenNew] = useState(false);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        const run = async () => {
            try {
                const { data } = await listProviders();
                setProviders(data || []);
            } catch (e) {
                console.error(e);
            }
        };
        run();
    }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            const { data } = await createProvider({ name: newName });
            setProviders((prev) => [...prev, data]);
            onChange?.(data.id);
            setNewName("");
            setOpenNew(false);
            toast.success("Provider created");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create provider");
        }
    };

    const selected = providers.find((p) => p.id === value);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                Credit Provider (TPA / Corporate)
            </label>
            <div className="flex gap-2 items-center">
                <Select
                    value={value ? String(value) : undefined}
                    onValueChange={(v) => onChange?.(Number(v))}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue
                            placeholder="Self / cash patient (no provider)"
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {providers.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setOpenNew(true)}
                    title="Add provider"
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            {selected && (
                <p className="text-[11px] text-muted-foreground">
                    Selected: {selected.name}
                </p>
            )}

            <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Credit Provider</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                        <label className="text-sm">Name</label>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Ex: Star Health Insurance"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpenNew(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleCreate}>
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
