import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const header = () => readFileSync('components/site-header.tsx', 'utf8')

describe('site header', () => {
  it('reads the session on the server', () => {
    expect(header()).toContain("from '@/server/auth/config'")
    expect(header()).toMatch(/await\b[^\n]*\bauth\(\)/)
  })

  it('is not a client component', () => {
    expect(header()).not.toMatch(/["']use client["']/)
  })

  it('offers sign-in when signed out and sign-out when signed in', () => {
    expect(header()).toContain('/signin')
    expect(header()).toContain('signOutAction')
  })

  it('links to the watchlist only when signed in', () => {
    expect(header()).toContain('href="/watchlist"')
    expect(header()).toMatch(/session \? \(\s*<Link\s+href="\/watchlist"/)
  })

  it('scrims deeply enough to carry the nav over a bright backdrop', () => {
    const code = header()
    expect(code).toContain('from-black/90')
    expect(code).toContain('via-black/60')
  })

  it('does not put any header text on the muted colour', () => {
    // --muted is #9b9ba3. Over a bright backdrop with only a partial scrim it does not
    // reach 4.5:1, and every link, the sign-out button and the session name sat on it.
    // Asserted file-wide: three of the five inherit text-sm from an ancestor, so a
    // filter keyed on that class would not see them regress.
    expect(header()).not.toContain('text-[var(--muted)]')
  })

  it('fetches the merged genre list on the server and hands it to the menu', () => {
    const code = header()
    expect(code).toContain("from '@/server/tmdb/endpoints/genres'")
    expect(code).toMatch(/await\b[^\n]*\bgetMergedGenres\(\)/)
    expect(code).toMatch(/<GenresMenu genres=\{genres\} \/>/)
  })

  it('guards the genre fetch so a TMDB outage does not take down every route', () => {
    expect(header()).toMatch(/getMergedGenres\(\)\.catch\(/)
  })
})
