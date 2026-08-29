import { Suspense } from 'react'
import { PosterCard } from '@/components/poster-card'
import { SearchInput } from '@/components/search-input'
import { SearchInputSkeleton } from '@/components/search-input-skeleton'
import { toCardItem } from '@/lib/media'
import { searchMulti } from '@/server/tmdb/endpoints/search'
import { getImageConfig } from '@/server/tmdb/images'

async function Results({ query }: { query: string }) {
  if (!query.trim()) {
    return <p className="mx-auto max-w-2xl px-6 py-10 text-[var(--muted)]">Start typing to search.</p>
  }

  const [items, images] = await Promise.all([searchMulti(query), getImageConfig()])

  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-2xl px-6 py-10 text-[var(--muted)]">
        No movies or TV shows match &ldquo;{query}&rdquo;.
      </p>
    )
  }

  return (
    <>
      <p className="sr-only">
        {items.length} result{items.length === 1 ? '' : 's'} for {query}.
      </p>
      {/* The list sits inside the live region but must not be read out of it: without this
          every debounced keystroke announces the summary and then all twenty titles. */}
      <ul
        aria-live="off"
        className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6"
      >
        {items.map((item) => (
          <li key={`${item.media_type}-${item.id}`}>
            <PosterCard
              item={toCardItem(item)}
              imageBase={images.secure_base_url}
              posterSizes={images.poster_sizes}
              variant="grid"
            />
          </li>
        ))}
      </ul>
    </>
  )
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q) ?? ''

  return (
    <main>
      <h1 className="mx-auto max-w-2xl px-6 pt-8 text-2xl font-bold tracking-tight">Search</h1>
      <Suspense fallback={<SearchInputSkeleton />}>
        <SearchInput />
      </Suspense>
      {/* The live region is outside the boundary so it survives the swap: the skeleton
          holds no text, and the summary Results adds when it resolves is announced. */}
      <div aria-live="polite">
        <Suspense key={query} fallback={<ResultsSkeleton />}>
          <Results query={query} />
        </Suspense>
      </div>
    </main>
  )
}

function ResultsSkeleton() {
  return (
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
  )
}
