import Image from 'next/image'
import { RowScroller } from './row-scroller'
import { BACKDROP_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/server/tmdb/images'
import type { ImageAsset } from '@/server/tmdb/types'

export async function BackdropCarousel({ images, title }: { images: ImageAsset[]; title: string }) {
  if (images.length === 0) return null
  const config = await getImageConfig()
  const size = pickSize(config.backdrop_sizes, BACKDROP_SLOTS.still)

  return (
    <section className="mb-8" aria-labelledby="images-heading">
      <h2 id="images-heading" className="mb-3 px-6 text-lg font-semibold">
        Images from {title}
      </h2>
      <RowScroller label={`Images from ${title}`}>
        {images.map((asset) => {
          const src = buildImageUrl(config.secure_base_url, size, asset.file_path)
          if (!src) return null
          return (
            <div
              key={asset.file_path}
              className="relative aspect-video w-[280px] shrink-0 snap-start overflow-hidden rounded-md bg-white/5"
            >
              <Image src={src} alt="" fill sizes="280px" loading="lazy" className="object-cover" />
            </div>
          )
        })}
      </RowScroller>
    </section>
  )
}
