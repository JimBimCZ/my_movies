import Image from 'next/image'
import Link from 'next/link'
import { BACKDROP_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/server/tmdb/images'
import type { TrendingItem } from '@/server/tmdb/types'
import { toCardItem } from '@/lib/media'

export async function Hero({ item }: { item: TrendingItem }) {
  const images = await getImageConfig()
  const card = toCardItem(item)
  const backdrop = buildImageUrl(
    images.secure_base_url,
    pickSize(images.backdrop_sizes, BACKDROP_SLOTS.hero),
    item.backdrop_path,
  )

  return (
    <section className="relative mb-8 h-[60vh] min-h-[380px] w-full">
      {backdrop && (
        <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/40 to-transparent" />
      <div className="absolute bottom-10 left-6 max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight">{card.title}</h1>
        <p className="mt-3 line-clamp-3 text-[var(--muted)]">{item.overview}</p>
        <Link
          href={`/title/${card.mediaType}/${card.id}`}
          className="mt-5 inline-block rounded bg-white px-5 py-2 font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          More info<span className="sr-only"> about {card.title}</span>
        </Link>
      </div>
    </section>
  )
}
