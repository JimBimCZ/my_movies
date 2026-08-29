import { describe, expect, it } from 'vitest'
import { isKnownTag, tags } from '@/server/tmdb/cache'

describe('isKnownTag', () => {
  it('accepts every fixed tag', () => {
    expect(isKnownTag(tags.configuration)).toBe(true)
    expect(isKnownTag(tags.genres)).toBe(true)
    expect(isKnownTag(tags.trending)).toBe(true)
    expect(isKnownTag(tags.search)).toBe(true)
  })

  it('accepts the list tags the builder produces', () => {
    expect(isKnownTag(tags.list('now-playing'))).toBe(true)
    expect(isKnownTag(tags.list('top-rated'))).toBe(true)
    expect(isKnownTag(tags.list('airing-today'))).toBe(true)
    expect(isKnownTag(tags.list('genre-28'))).toBe(true)
  })

  it('accepts detail tags for both media types', () => {
    expect(isKnownTag(tags.detail('movie', 603))).toBe(true)
    expect(isKnownTag(tags.detail('tv', 1399))).toBe(true)
  })

  it('rejects a tag outside the tmdb namespace', () => {
    expect(isKnownTag('nextauth:session')).toBe(false)
    expect(isKnownTag('tmdb')).toBe(false)
    expect(isKnownTag('')).toBe(false)
  })

  it('rejects an unrecognised list name', () => {
    expect(isKnownTag('tmdb:list:everything')).toBe(false)
    expect(isKnownTag('tmdb:list:genre-')).toBe(false)
    expect(isKnownTag('tmdb:list:genre-abc')).toBe(false)
    expect(isKnownTag('tmdb:list:')).toBe(false)
  })

  it('accepts the tv genre list tag', () => {
    expect(isKnownTag(tags.list('tv-genre-10765'))).toBe(true)
  })

  it('still rejects a malformed tv genre tag', () => {
    expect(isKnownTag('tmdb:list:tv-genre-')).toBe(false)
    expect(isKnownTag('tmdb:list:tv-genre-abc')).toBe(false)
  })

  it('rejects a detail tag with a bad media type or id', () => {
    expect(isKnownTag('tmdb:title:person:31')).toBe(false)
    expect(isKnownTag('tmdb:title:movie:')).toBe(false)
    expect(isKnownTag('tmdb:title:movie:abc')).toBe(false)
    expect(isKnownTag('tmdb:title:movie:12:34')).toBe(false)
  })

  it('stays anchored at both ends', () => {
    // Dropping ^, $, or the (?:...) group around the alternation all pass the rest of
    // this suite. Unbracketed, the alternation would make 'nextauth:top-rated:evil' a
    // known tag on an endpoint reachable over HTTP.
    expect(isKnownTag('evil:top-rated')).toBe(false)
    expect(isKnownTag('tmdb:list:now-playing-x')).toBe(false)
  })
})
