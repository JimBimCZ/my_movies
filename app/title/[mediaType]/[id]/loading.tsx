export default function Loading() {
  return (
    <main>
      <div className="h-[45vh] min-h-[280px] w-full animate-pulse bg-white/5" />
      <div className="mx-auto -mt-24 flex max-w-5xl gap-8 px-6">
        <div className="h-[330px] w-[220px] shrink-0 animate-pulse rounded-md bg-white/10" />
        <div className="flex-1 space-y-3 pt-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
          <div className="h-20 w-full animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </main>
  )
}
