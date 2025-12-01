// FILE: src/billing/components/ConsultantSelect.jsx
import { useEffect, useState } from "react";
import { searchConsultants } from "@/api/billing";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserSquare2, Loader2 } from "lucide-react";

export default function ConsultantSelect({ value, onChange }) {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            try {
                setLoading(true);
                const { data } = await searchConsultants(q || "");
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

    const selected = list.find((d) => d.id === value);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
                <UserSquare2 className="w-4 h-4" />
                Consultant
            </label>
            <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search doctor..."
            />
            {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                </div>
            )}
            <ScrollArea className="max-h-32 rounded-md border bg-muted/30 mt-1">
                {list.map((d) => (
                    <button
                        type="button"
                        key={d.id}
                        onClick={() => onChange?.(d)}
                        className={[
                            "w-full px-3 py-1.5 text-left text-xs hover:bg-accent border-b last:border-b-0",
                            value === d.id ? "bg-accent/60" : "",
                        ].join(" ")}
                    >
                        <div className="font-medium">
                            {d.full_name || d.name || d.email}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {d.speciality || d.role || ""}
                        </div>
                    </button>
                ))}
                {!loading && list.length === 0 && (
                    <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                        No consultants found
                    </div>
                )}
            </ScrollArea>

            {selected && (
                <p className="text-[11px] text-muted-foreground mt-1">
                    Selected: {selected.full_name || selected.name || selected.email}
                </p>
            )}
        </div>
    );
}
