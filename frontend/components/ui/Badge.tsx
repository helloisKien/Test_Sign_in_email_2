import { ReactNode } from "react";

export function Badge({ active, children }: { active?: boolean; children: ReactNode }) {
    return (
        <span
            className={[
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
                active
                    ? "border-teal-950 bg-teal-950 text-white shadow-[0_10px_24px_rgba(15,118,110,0.22)]"
                    : "border-stone-200 bg-white/80 text-stone-600",
            ].join(" ")}
        >
            {children}
        </span>
    );
}
