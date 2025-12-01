// FILE: src/billing/components/PatientPicker.jsx
import { useEffect, useMemo, useState } from "react";
import { searchPatients } from "@/api/billing";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, User } from "lucide-react";

export default function PatientPicker({ value, onChange }) {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            try {
                setLoading(true);
                const { data } = await searchPatients(q || "");
                if (!alive) return;
                setList(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                if (alive) setLoading(false);
            }
        };
        run();
        return () => {
            alive = false;
        };
    }, [q]);

    const chosen = useMemo(
        () => list.find((p) => p.id === value),
        [list, value]
    );

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Patient
                </label>
            </div>
            <Input
                placeholder="Search patient by name / UHID / phone..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
            />
            <Search className="w-4 h-4 text-muted-foreground absolute mt-2 ml-2 pointer-events-none" />

            <div className="mt-2">
                {loading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                    </div>
                )}
                <ScrollArea className="max-h-40 rounded-md border bg-muted/30">
                    {list.map((p) => {
                        const fullName =
                            p.full_name ||
                            [p.first_name, p.middle_name, p.last_name]
                                .filter(Boolean)
                                .join(" ") ||
                            "Unnamed";

                        return (
                            <button
                                type="button"
                                key={p.id}
                                onClick={() => onChange?.(p)}
                                className={[
                                    "w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-accent transition-colors flex items-center justify-between",
                                    value === p.id ? "bg-accent/60" : "",
                                ].join(" ")}
                            >
                                <div>
                                    <div className="font-medium">{fullName}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                        UHID: {p.uhid || "-"} • Phone: {p.mobile_no || p.phone || "-"}
                                    </div>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {p.age ? `${p.age} yrs` : ""} {p.gender ? `• ${p.gender}` : ""}
                                </div>
                            </button>
                        );
                    })}
                    {!loading && list.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            No patients found.
                        </div>
                    )}
                </ScrollArea>
            </div>

            {chosen && (
                <Card className="mt-2 p-2 bg-primary/5 border-primary/20 text-xs">
                    <div className="font-semibold text-sm">
                        {chosen.full_name ||
                            [chosen.first_name, chosen.last_name].filter(Boolean).join(" ")}
                    </div>
                    <div className="text-muted-foreground">
                        UHID: {chosen.uhid || "-"}
                    </div>
                </Card>
            )}
        </div>
    );
}
