import Image from 'next/image'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 px-6 py-8 text-sm text-[var(--muted)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <Image src="/tmdb-logo.svg" alt="The Movie Database" width={128} height={16} />
        <p>
          This application uses TMDB and the TMDB APIs but is not endorsed, certified, or
          otherwise approved by TMDB.
        </p>
      </div>
    </footer>
  )
}
