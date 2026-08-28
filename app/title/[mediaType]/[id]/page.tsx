import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { TmdbError } from '@/server/tmdb/client'
import { getTitleDetail } from '@/server/tmdb/endpoints/titles'
import { BACKDROP_SLOTS, POSTER_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/server/tmdb/images'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'

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
  const title = detail.media_type === 'movie' ? detail.title : detail.name
  const releaseDate = detail.media_type === 'movie' ? detail.release_date : detail.first_air_date
  const releaseYear = releaseDate ? releaseDate.slice(0, 4) : null
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

  return (
    <main>
      <div className="relative h-[45vh] min-h-[280px] w-full">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
      </div>

      <div className="mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
        {poster && (
          <Image
            src={poster}
            alt={title}
            width={220}
            height={330}
            className="w-[220px] shrink-0 rounded-md shadow-2xl"
          />
        )}
        <div className="pt-4">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {releaseYear && `${releaseYear} · `}
            {detail.vote_average.toFixed(1)} / 10
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {detail.genres.map((genre) => (
              <li key={genre.id} className="rounded-full border border-white/15 px-3 py-1 text-xs">
                {genre.name}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl leading-relaxed">{detail.overview}</p>
        </div>
      </div>
    </main>
  )
}
