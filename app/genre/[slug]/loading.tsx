import { RowSkeleton } from '@/components/row-skeleton'

export default function Loading() {
  return (
    <main className="pt-8">
      <div className="mb-6 ml-6 h-9 w-56 animate-pulse rounded bg-white/10" />
      <RowSkeleton title="Movies" />
      <RowSkeleton title="Series" />
    </main>
  )
}
