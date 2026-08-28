import Image from 'next/image'
import Link from 'next/link'
import { buildImageUrl, POSTER_SLOTS, pickSize } from '@/server/tmdb/images'
import type { CardItem } from '@/lib/media'

interface PosterCardProps {
  item: CardItem
  imageBase: string
  posterSizes: string[]
  priority?: boolean
  variant?: 'row' | 'grid'
}

export function PosterCard({
  item,
  imageBase,
  posterSizes,
  priority = false,
  variant = 'row',
}: PosterCardProps) {
  const src = buildImageUrl(imageBase, pickSize(posterSizes, POSTER_SLOTS.card), item.posterPath)
  const sizing = variant === 'row' ? 'w-[160px] shrink-0 snap-start' : 'w-full'

  return (
    <Link
      href={`/title/${item.mediaType}/${item.id}`}
      className={`group block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${sizing}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/5">
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            sizes={variant === 'row' ? '160px' : '(max-width: 640px) 45vw, 180px'}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center p-2 text-center text-xs text-[var(--muted)]">
            {item.title}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)] group-hover:text-[var(--foreground)]">
        {item.title}
      </p>
    </Link>
  )
}
