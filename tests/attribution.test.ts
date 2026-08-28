import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('TMDB attribution', () => {
  it('states that the app is not endorsed, certified, or otherwise approved by TMDB', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toMatch(/not endorsed, certified, or\s+otherwise approved by TMDB/)
  })

  it('renders the TMDB logo with an accessible name', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toContain('/tmdb-logo.svg')
    expect(footer).toMatch(/alt="The Movie Database"/)
  })
})
