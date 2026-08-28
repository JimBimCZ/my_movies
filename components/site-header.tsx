import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 py-4">
      <nav className="mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link href="/search" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Search
        </Link>
      </nav>
    </header>
  )
}
