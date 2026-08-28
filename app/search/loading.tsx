export default function Loading() {
  return (
    <main>
      <div className="mx-auto mt-8 max-w-2xl px-6">
        <div className="mb-2 h-5 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-[54px] w-full animate-pulse rounded-md border border-white/15 bg-white/5" />
      </div>
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <li key={index}>
            <div className="aspect-[2/3] animate-pulse rounded-md bg-white/5" />
            <div className="mt-2 h-10 space-y-1.5">
              <div className="h-4 w-full animate-pulse rounded bg-white/5" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
