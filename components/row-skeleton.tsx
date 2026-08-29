export function RowSkeleton({ title }: { title?: string }) {
  // A genre row's name is not known until the genre list resolves, so the heading becomes a
  // placeholder bar and the section drops the label association rather than pointing
  // aria-labelledby at an element that is not rendered.
  const headingId = title ? `row-skeleton-${crypto.randomUUID()}` : undefined

  return (
    <section className="mb-8" aria-labelledby={headingId}>
      {title ? (
        <h2 id={headingId} className="mb-3 px-6 text-lg font-semibold">
          {title}
        </h2>
      ) : (
        <div className="mb-3 ml-6 h-7 w-40 animate-pulse rounded bg-white/5" />
      )}
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
