import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const header = () => readFileSync('components/site-header.tsx', 'utf8')

describe('site header', () => {
  it('reads the session on the server', () => {
    expect(header()).toContain("from '@/server/auth/config'")
    expect(header()).toMatch(/await auth\(\)/)
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

  it('does not put nav links on the muted colour', () => {
    // --muted is #9b9ba3. Over a bright backdrop with only a partial scrim it does not
    // reach 4.5:1, and every link in the header sat on it.
    const code = header()
    const linkClasses = [...code.matchAll(/className="([^"]*)"/g)].map((match) => match[1]!)
    const navClasses = linkClasses.filter((value) => value.includes('text-sm'))
    expect(navClasses.length).toBeGreaterThan(0)
    for (const value of navClasses) {
      expect(value).not.toContain('text-[var(--muted)]')
    }
  })
})
