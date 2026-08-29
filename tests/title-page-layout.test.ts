import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/title/[mediaType]/[id]/page.tsx', 'utf8')
const facts = () => readFileSync('components/title-facts.tsx', 'utf8')

describe('title detail layout', () => {
  // The backdrop container is `relative`, so it paints after any static sibling that
  // follows it. Without its own stacking level the content pulled up by -mt-24 is
  // painted over rather than overlapping.
  it('raises the content container above the backdrop it overlaps', () => {
    const code = page()
    expect(code).toMatch(/-mt-24[^"]*/)
    const contentClass = code.match(/className="([^"]*-mt-24[^"]*)"/)?.[1] ?? ''
    expect(contentClass).toContain('relative')
    expect(contentClass).toMatch(/\bz-10\b/)
  })
})

describe('title facts', () => {
  it('renders facts as a definition list, not a paragraph', () => {
    const code = facts()
    expect(code).toContain('<dl')
    expect(code).toContain('<dt')
    expect(code).toContain('<dd')
  })

  it('renders nothing when there are no facts to show', () => {
    expect(facts()).toMatch(/facts\.length === 0/)
  })

  it('is a server component', () => {
    expect(facts()).not.toMatch(/["']use client["']/)
  })
})

describe('title detail page', () => {
  it('builds its facts from the view model rather than inline in the page', () => {
    const code = page()
    expect(code).toContain("from '@/lib/title-detail'")
    expect(code).toContain('toTitleFacts(detail)')
    expect(code).toContain('<TitleFacts')
  })

  it('shows the tagline only when the payload has one', () => {
    expect(page()).toMatch(/detail\.tagline &&/)
  })
})
