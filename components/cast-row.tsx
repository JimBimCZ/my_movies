import Image from 'next/image'
import { RowScroller } from './row-scroller'
import { buildImageUrl, getImageConfig, PROFILE_SLOTS, pickSize } from '@/server/tmdb/images'
import type { CastMember } from '@/server/tmdb/types'

export async function CastRow({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null
  const images = await getImageConfig()
  const size = pickSize(images.profile_sizes, PROFILE_SLOTS.card)

  return (
    <section className="mb-8" aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-3 px-6 text-lg font-semibold">
        Cast
      </h2>
      <RowScroller label="Cast">
        {cast.map((member) => {
          const profile = buildImageUrl(images.secure_base_url, size, member.profile_path)
          return (
            <div key={member.credit_id} className="w-[140px] shrink-0 snap-start">
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/5">
                {profile && (
                  <Image
                    src={profile}
                    alt={member.name}
                    fill
                    sizes="140px"
                    loading="lazy"
                    className="object-cover"
                  />
                )}
              </div>
              <p className="mt-2 text-sm leading-5">{member.name}</p>
              <p className="text-xs leading-5 text-[var(--muted)]">{member.character}</p>
            </div>
          )
        })}
      </RowScroller>
    </section>
  )
}
