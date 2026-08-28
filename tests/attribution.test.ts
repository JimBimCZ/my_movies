import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('TMDB attribution', () => {
  it('renders the exact required TMDB notice', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    const normalized = footer.replace(/\s+/g, ' ')
    expect(normalized).toContain(
      'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    )
  })

  it('renders the TMDB logo with an accessible name', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toContain('/tmdb-logo.svg')
    expect(footer).toMatch(/alt="The Movie Database"/)
  })

  it('mounts the footer in the root layout', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).toContain('<SiteFooter')
  })
})
