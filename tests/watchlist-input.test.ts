import { describe, expect, it } from 'vitest'
import { parseToggleInput } from '@/lib/watchlist-input'

describe('parseToggleInput', () => {
  it('accepts a well-formed payload', () => {
    expect(parseToggleInput({ tmdbId: 157336, mediaType: 'movie' })).toEqual({
      tmdbId: 157336,
      mediaType: 'movie',
    })
    expect(parseToggleInput({ tmdbId: 95396, mediaType: 'tv' })).toEqual({
      tmdbId: 95396,
      mediaType: 'tv',
    })
  })

  it('rejects a media type outside the union', () => {
    expect(parseToggleInput({ tmdbId: 1, mediaType: 'person' })).toBeNull()
    expect(parseToggleInput({ tmdbId: 1, mediaType: '' })).toBeNull()
  })

  it('rejects an id that is not a positive integer', () => {
    expect(parseToggleInput({ tmdbId: 0, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: -5, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: 1.5, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: Number.NaN, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: '157336', mediaType: 'movie' })).toBeNull()
  })

  it('rejects anything that is not an object with both fields', () => {
    expect(parseToggleInput(null)).toBeNull()
    expect(parseToggleInput(undefined)).toBeNull()
    expect(parseToggleInput('157336')).toBeNull()
    expect(parseToggleInput({ tmdbId: 157336 })).toBeNull()
    expect(parseToggleInput({ mediaType: 'movie' })).toBeNull()
  })
})
