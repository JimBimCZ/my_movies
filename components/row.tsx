import { PosterCard } from './poster-card'
import { RowScroller } from './row-scroller'
import { getImageConfig } from '@/server/tmdb/images'
import type { CardItem } from '@/lib/media'

export async function Row({ title, items }: { title: string; items: CardItem[] }) {
  if (items.length === 0) return null
  const images = await getImageConfig()
  const headingId = `row-${crypto.randomUUID()}`

  return (
    <section className="mb-8" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 px-6 text-lg font-semibold">
        {title}
      </h2>
      <RowScroller label={title}>
        {items.map((item) => (
          <PosterCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            imageBase={images.secure_base_url}
            posterSizes={images.poster_sizes}
          />
        ))}
      </RowScroller>
    </section>
  )
}
