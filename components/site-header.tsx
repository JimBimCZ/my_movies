import Link from 'next/link'
import { signOutAction } from '@/server/auth/actions'
import { auth } from '@/server/auth/config'

export async function SiteHeader() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 py-4">
      <nav className="mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link href="/search" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Search
        </Link>
        {session ? (
          <Link
            href="/watchlist"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Watchlist
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session ? (
            <>
              <span className="text-[var(--muted)]">{session.user?.name ?? session.user?.email}</span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
