import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/genre/[slug]/page.tsx', 'utf8')

describe('genre page', () => {
  it('404s on a slug TMDB does not know', () => {
    const code = page()
    expect(code).toContain('findGenreBySlug')
    expect(code).toContain('notFound()')
  })

  it('renders a movie row and a tv row from their own endpoints', () => {
    const code = page()
    expect(code).toContain('discoverByGenre')
    expect(code).toContain('discoverTvByGenre')
  })

  it('renders each row only when that side has an id', () => {
    // Ten of the 27 merged genres exist on one side only; rendering an empty
    // row for the other side would be a heading over nothing.
    const code = page()
    expect(code).toMatch(/genre\.movieId !== undefined/)
    expect(code).toMatch(/genre\.tvId !== undefined/)
  })

  it('suspends each row separately so one slow list does not hold the other', () => {
    const code = page()
    expect(code.match(/<Suspense/g)).toHaveLength(2)
    expect(code).toContain('RowSkeleton')
  })

  it('names the genre in the page metadata', () => {
    expect(page()).toContain('generateMetadata')
  })
})
