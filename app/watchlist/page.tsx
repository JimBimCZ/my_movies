import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PosterCard } from '@/components/poster-card'
import { WatchlistButton } from '@/components/watchlist-button'
import { auth } from '@/server/auth/config'
import { getImageConfig } from '@/server/tmdb/images'
import { listForUser } from '@/server/watchlist/queries'

export const metadata: Metadata = { title: 'Watchlist' }

export default async function WatchlistPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin?callbackUrl=%2Fwatchlist')

  const [items, images] = await Promise.all([listForUser(session.user.id), getImageConfig()])

  return (
    <main>
      <h1 className="mx-auto max-w-7xl px-6 pt-8 text-2xl font-bold tracking-tight">Watchlist</h1>

      {items.length === 0 ? (
        <p className="mx-auto max-w-7xl px-6 py-10 text-[var(--muted)]">
          Nothing saved yet.{' '}
          <Link href="/" className="underline hover:text-[var(--foreground)]">
            Browse something to add
          </Link>
          .
        </p>
      ) : (
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {items.map((item) => (
            <li key={`${item.mediaType}-${item.tmdbId}`} className="flex flex-col gap-2">
              <PosterCard
                item={{
                  id: item.tmdbId,
                  title: item.title,
                  posterPath: item.posterPath,
                  mediaType: item.mediaType,
                }}
                imageBase={images.secure_base_url}
                posterSizes={images.poster_sizes}
                variant="grid"
              />
              <WatchlistButton
                tmdbId={item.tmdbId}
                mediaType={item.mediaType}
                inWatchlist
                signedIn
                returnTo="/watchlist"
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
