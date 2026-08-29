import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = () => readFileSync('components/watchlist-button.tsx', 'utf8')

describe('watchlist button', () => {
  it('is a client component using optimistic state inside a transition', () => {
    const code = source()
    expect(code.startsWith("'use client'")).toBe(true)
    expect(code).toContain('useOptimistic')
    expect(code).toContain('startTransition')
  })

  it('sends only the id and media type, never the snapshot', () => {
    const code = source()
    expect(code).toContain('toggleWatchlist({ tmdbId, mediaType })')
    expect(code).not.toContain('posterPath')
    expect(code).not.toContain('title:')
  })

  it('surfaces a failed toggle in a live region rather than throwing', () => {
    const code = source()
    expect(code).toContain('role="status"')
    expect(code).toContain('result.ok')
  })

  it('links to sign-in instead of toggling when signed out', () => {
    expect(source()).toContain('/signin?callbackUrl=')
  })

  it('appends the title so several remove buttons on one page are distinguishable', () => {
    const code = source()
    expect(code).toMatch(/<span className="sr-only"> — \{title\}<\/span>/)
    // Appended, not substituted: the visible words must survive in the accessible name
    // or speech input stops matching the control (WCAG 2.5.3).
    expect(code).not.toContain('aria-label')
  })
})
