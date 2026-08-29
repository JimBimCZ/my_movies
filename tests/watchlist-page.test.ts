import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/watchlist/page.tsx', 'utf8')

describe('watchlist page', () => {
  it('redirects a signed-out visitor to sign-in and back', () => {
    const code = page()
    expect(code).toContain('await auth()')
    expect(code).toContain("redirect('/signin?callbackUrl=%2Fwatchlist')")
  })

  it('scopes the query to the session user', () => {
    expect(page()).toContain('listForUser(session.user.id)')
  })

  it('renders from the stored snapshot, not per-item TMDB calls', () => {
    const code = page()
    expect(code).not.toContain('getTitleDetail')
  })
})
