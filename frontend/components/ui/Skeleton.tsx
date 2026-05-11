export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-stone-200/70 ${className}`}
      style={{ minHeight: "1rem" }}
    />
  );
}

export function SkeletonCard({ className = "", lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`space-y-3 rounded-2xl border border-stone-200 bg-white p-5 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine key={index} className={index === 0 ? "h-5 w-2/5" : "h-4 w-full"} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
