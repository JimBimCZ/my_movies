import { RowSkeleton } from '@/components/row-skeleton'

export default function Loading() {
  return (
    <main>
      <div className="h-[45vh] min-h-[280px] w-full animate-pulse bg-white/5" />
      <div className="relative z-10 mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
        <div className="h-[330px] w-[220px] shrink-0 animate-pulse rounded-md bg-white/10" />
        <div className="space-y-3 pt-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-5 w-40 animate-pulse rounded bg-white/5" />
            ))}
          </div>
          <div className="mt-5 h-6 w-1/2 animate-pulse rounded bg-white/5" />
          <div className="h-20 w-full animate-pulse rounded bg-white/5" />
          <div className="mt-6 h-[38px] w-52 animate-pulse rounded-md bg-white/10" />
        </div>
      </div>
      <div className="mt-12">
        <RowSkeleton title="Cast" />
      </div>
    </main>
  )
}
