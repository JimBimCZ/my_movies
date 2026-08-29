import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Row } from '@/components/row'
import { RowSkeleton } from '@/components/row-skeleton'
import { toCardItem } from '@/lib/media'
import { discoverByGenre, discoverTvByGenre } from '@/server/tmdb/endpoints/lists'
import { findGenreBySlug } from '@/server/tmdb/endpoints/genres'

const FIRST_ROW_PRIORITY_COUNT = 4

export async function generateMetadata({
  params,
}: PageProps<'/genre/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const genre = await findGenreBySlug(slug)
  if (!genre) notFound()

  return { title: genre.name, description: `${genre.name} movies and TV shows.` }
}

async function MovieRow({ genreId }: { genreId: number }) {
  const items = await discoverByGenre(genreId)
  return (
    <Row
      title="Movies"
      items={items.map((item) => toCardItem(item))}
      priorityCount={FIRST_ROW_PRIORITY_COUNT}
    />
  )
}

async function SeriesRow({ genreId, priorityCount }: { genreId: number; priorityCount: number }) {
  const items = await discoverTvByGenre(genreId)
  return <Row title="Series" items={items.map((item) => toCardItem(item))} priorityCount={priorityCount} />
}

export default async function GenrePage({ params }: PageProps<'/genre/[slug]'>) {
  const { slug } = await params
  const genre = await findGenreBySlug(slug)
  if (!genre) notFound()

  return (
    <main className="pt-8">
      <h1 className="mb-6 px-6 text-3xl font-bold tracking-tight">{genre.name}</h1>
      {genre.movieId !== undefined && (
        <Suspense fallback={<RowSkeleton title="Movies" />}>
          <MovieRow genreId={genre.movieId} />
        </Suspense>
      )}
      {genre.tvId !== undefined && (
        <Suspense fallback={<RowSkeleton title="Series" />}>
          <SeriesRow
            genreId={genre.tvId}
            priorityCount={genre.movieId === undefined ? FIRST_ROW_PRIORITY_COUNT : 0}
          />
        </Suspense>
      )}
    </main>
  )
}
