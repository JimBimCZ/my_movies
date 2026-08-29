import Link from 'next/link'
import { GenresMenu } from '@/components/genres-menu'
import { signOutAction } from '@/server/auth/actions'
import { auth } from '@/server/auth/config'
import { getMergedGenres } from '@/server/tmdb/endpoints/genres'
import type { MergedGenre } from '@/lib/genres'

export async function SiteHeader() {
  const [session, genres] = await Promise.all([auth(), getMergedGenres().catch(() => [] as MergedGenre[])])

  return (
    <header className="pointer-events-none sticky top-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-6 pb-8 pt-4">
      <nav className="pointer-events-auto mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link
          href="/search"
          className="py-1 text-sm text-white/90 hover:text-white"
        >
          Search
        </Link>
        {genres.length > 0 ? <GenresMenu genres={genres} /> : null}
        {session ? (
          <Link
            href="/watchlist"
            className="py-1 text-sm text-white/90 hover:text-white"
          >
            Watchlist
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session ? (
            <>
              <span className="text-white/70">
                {session.user?.name ?? session.user?.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded py-1 text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded py-1 text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
