import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { TitleFacts } from '@/components/title-facts'
import { WatchlistButton } from '@/components/watchlist-button'
import { auth } from '@/server/auth/config'
import { TmdbError } from '@/server/tmdb/client'
import { getTitleDetail } from '@/server/tmdb/endpoints/titles'
import { BACKDROP_SLOTS, POSTER_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/server/tmdb/images'
import { isInWatchlist } from '@/server/watchlist/queries'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'
import { toTitleFacts } from '@/lib/title-detail'

export async function generateMetadata({
  params,
}: PageProps<'/title/[mediaType]/[id]'>): Promise<Metadata> {
  const { mediaType: rawMediaType, id: rawId } = await params
  const mediaType = parseMediaType(rawMediaType)
  const id = parseTmdbId(rawId)
  if (!mediaType || !id) notFound()

  const detail = await getTitleDetail(mediaType, id).catch((error) => {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  })

  const title = detail.media_type === 'movie' ? detail.title : detail.name
  return {
    title,
    description: detail.overview || undefined,
  }
}

export default async function TitlePage({ params }: PageProps<'/title/[mediaType]/[id]'>) {
  const { mediaType: rawMediaType, id: rawId } = await params
  const mediaType = parseMediaType(rawMediaType)
  const id = parseTmdbId(rawId)
  if (!mediaType || !id) notFound()

  const detail = await getTitleDetail(mediaType, id).catch((error) => {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  })

  const images = await getImageConfig()
  const session = await auth()
  const userId = session?.user?.id
  const inWatchlist = userId ? await isInWatchlist(userId, id, mediaType) : false
  const title = detail.media_type === 'movie' ? detail.title : detail.name
  const poster = buildImageUrl(
    images.secure_base_url,
    pickSize(images.poster_sizes, POSTER_SLOTS.detail),
    detail.poster_path,
  )
  const backdrop = buildImageUrl(
    images.secure_base_url,
    pickSize(images.backdrop_sizes, BACKDROP_SLOTS.hero),
    detail.backdrop_path,
  )
  const facts = toTitleFacts(detail)

  return (
    <main>
      <div className="relative h-[45vh] min-h-[280px] w-full">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
        {poster && (
          <Image
            src={poster}
            alt={title}
            width={220}
            height={330}
            priority
            className="w-[220px] shrink-0 rounded-md shadow-2xl"
          />
        )}
        <div className="pt-4">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <ul className="mt-3 flex flex-wrap gap-2">
            {detail.genres.map((genre) => (
              <li key={genre.id} className="rounded-full border border-white/15 px-3 py-1 text-xs">
                {genre.name}
              </li>
            ))}
          </ul>
          <TitleFacts facts={facts} />
          {detail.tagline && (
            <p className="mt-5 text-lg italic text-[var(--muted)]">{detail.tagline}</p>
          )}
          <p className="mt-3 max-w-2xl leading-relaxed">{detail.overview}</p>
          <div className="mt-6">
            <WatchlistButton
              tmdbId={id}
              mediaType={mediaType}
              inWatchlist={inWatchlist}
              signedIn={Boolean(userId)}
              returnTo={`/title/${mediaType}/${id}`}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
