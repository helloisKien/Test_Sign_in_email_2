export function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-stone-900">{value}</div>
        </div>
    );
}
