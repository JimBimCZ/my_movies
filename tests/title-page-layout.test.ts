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

  it('does not re-add an inline rating beside the title', () => {
    // Task 5 moved the rating into the facts list; an inline vote_average here would
    // duplicate it.
    expect(page()).not.toContain('vote_average')
  })

  it('orders the details column: genres, facts, tagline, overview', () => {
    // Anchored on the JSX forms: bare `detail.overview` also matches generateMetadata's
    // description, which sits above all of this in the file.
    const code = page()
    const genres = code.indexOf('{detail.genres.map')
    const facts = code.indexOf('<TitleFacts')
    const tagline = code.indexOf('{detail.tagline &&')
    const overview = code.indexOf('{detail.overview}')
    expect(genres).toBeGreaterThan(-1)
    expect(genres).toBeLessThan(facts)
    expect(facts).toBeLessThan(tagline)
    expect(tagline).toBeLessThan(overview)
  })
})

const castRow = () => readFileSync('components/cast-row.tsx', 'utf8')

describe('cast row', () => {
  it('is a server component that reuses the shared scroller', () => {
    const code = castRow()
    expect(code).not.toMatch(/["']use client["']/)
    expect(code).toContain('RowScroller')
  })

  it('names both the actor and the character', () => {
    const code = castRow()
    expect(code).toContain('member.name')
    expect(code).toContain('member.character')
  })

  it('gives every profile image alt text naming the actor', () => {
    expect(castRow()).toMatch(/alt=\{member\.name\}/)
  })

  it('renders nothing for a title with no cast', () => {
    expect(castRow()).toMatch(/cast\.length === 0/)
  })
})

const carousel = () => readFileSync('components/backdrop-carousel.tsx', 'utf8')

describe('backdrop carousel', () => {
  it('is a server component reusing the shared scroller', () => {
    const code = carousel()
    expect(code).not.toMatch(/["']use client["']/)
    expect(code).toContain('RowScroller')
  })

  it('renders nothing when the title has no extra images', () => {
    expect(carousel()).toMatch(/images\.length === 0\) return null/)
  })

  it('lazily loads the stills, which are all below the fold', () => {
    expect(carousel()).toContain("loading=\"lazy\"")
  })

  it('marks the stills decorative rather than inventing alt text per frame', () => {
    // A still has no caption in the payload; an invented one is worse than none,
    // and the section heading already names the title.
    expect(carousel()).toMatch(/alt=""/)
  })
})

describe('title detail page images section', () => {
  it('caps how many stills it asks for', () => {
    const code = page()
    expect(code).toContain('BACKDROP_LIMIT')
    expect(code).toContain('pickBackdrops(detail.images, BACKDROP_LIMIT)')
  })

  it('renders the image carousel after the cast row', () => {
    const code = page()
    const cast = code.indexOf('<CastRow')
    const carousel = code.indexOf('<BackdropCarousel')
    expect(cast).toBeGreaterThan(-1)
    expect(cast).toBeLessThan(carousel)
  })
})
