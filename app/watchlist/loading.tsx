export default function Loading() {
  return (
    <main>
      <h1 className="mx-auto max-w-7xl px-6 pt-8 text-2xl font-bold tracking-tight">Watchlist</h1>
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
