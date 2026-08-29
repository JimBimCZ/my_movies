import { Suspense } from 'react'
import { connection } from 'next/server'
import { Hero } from '@/components/hero'
import { HeroSkeleton } from '@/components/hero-skeleton'
import { Row } from '@/components/row'
import { RowSkeleton } from '@/components/row-skeleton'
import { toCardItem } from '@/lib/media'
import {
  discoverByGenre,
  getAiringToday,
  getMovieGenres,
  getNowPlaying,
  getTopRated,
  getTrending,
} from '@/server/tmdb/endpoints/lists'

const FIRST_ROW_PRIORITY_COUNT = 4
// The fallback reserves one row per genre row that will arrive; a single skeleton for all of
// them collapsed to a quarter of the final height and shifted everything below it.
const GENRE_ROW_COUNT = 4

async function TrendingRow() {
  const items = await getTrending()
  return (
    <Row
      title="Trending this week"
      items={items.map((item) => toCardItem(item))}
      priorityCount={FIRST_ROW_PRIORITY_COUNT}
    />
  )
}

async function NowPlayingRow() {
  const items = await getNowPlaying()
  return <Row title="Now playing" items={items.map((item) => toCardItem(item))} />
}

async function TopRatedRow() {
  const items = await getTopRated()
  return <Row title="Top rated" items={items.map((item) => toCardItem(item))} />
}

async function AiringTodayRow() {
  const items = await getAiringToday()
  return <Row title="Airing today" items={items.map((item) => toCardItem(item))} />
}

async function GenreRow({ id, name }: { id: number; name: string }) {
  const items = await discoverByGenre(id)
  return <Row title={name} items={items.map((item) => toCardItem(item))} />
}

async function GenreRows() {
  const genres = await getMovieGenres()
  return (
    <>
      {genres.slice(0, GENRE_ROW_COUNT).map((genre) => (
        <Suspense key={genre.id} fallback={<RowSkeleton title={genre.name} />}>
          <GenreRow id={genre.id} name={genre.name} />
        </Suspense>
      ))}
    </>
  )
}

async function HomeHero() {
  const [first] = await getTrending()
  return first ? <Hero item={first} /> : null
}

// `/` has no request-time inputs, so Next would prerender it at build time and
// call TMDB during `next build`. The Docker image is built without secrets, so
// the build must not need a token: `connection()` defers the render to request
// time. The TMDB responses themselves stay in the fetch cache, so this costs an
// HTML render per request, not a TMDB round-trip per request.
export default async function HomePage() {
  await connection()

  return (
    <main>
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Trending this week" />}>
        <TrendingRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Now playing" />}>
        <NowPlayingRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Top rated" />}>
        <TopRatedRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Airing today" />}>
        <AiringTodayRow />
      </Suspense>
      <Suspense
        fallback={
          <>
            {Array.from({ length: GENRE_ROW_COUNT }).map((_, index) => (
              <RowSkeleton key={index} />
            ))}
          </>
        }
      >
        <GenreRows />
      </Suspense>
    </main>
  )
}
