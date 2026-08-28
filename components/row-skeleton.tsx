export function RowSkeleton({ title }: { title: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-6 text-lg font-semibold">{title}</h2>
      <div className="flex gap-3 overflow-hidden px-6 pb-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="w-[160px] shrink-0">
            <div className="aspect-[2/3] animate-pulse rounded-md bg-white/5" />
            <div className="mt-2 h-10 space-y-1.5">
              <div className="h-4 w-full animate-pulse rounded bg-white/5" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
