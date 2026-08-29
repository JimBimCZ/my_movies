import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mergeGenres, slugify } from '@/lib/genres'
import type { Genre } from '@/server/tmdb/types'

const list = (name: string): Genre[] =>
  JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8')).genres

const movieGenres = () => list('genres-movie')
const tvGenres = () => list('genres-tv')

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Science Fiction')).toBe('science-fiction')
    expect(slugify('TV Movie')).toBe('tv-movie')
  })

  it('spells out the ampersand rather than dropping it', () => {
    // Dropping it would collapse "Action & Adventure" and "Action Adventure"
    // onto one slug, and "Sci-Fi & Fantasy" reads as nonsense without it.
    expect(slugify('Action & Adventure')).toBe('action-and-adventure')
    expect(slugify('Sci-Fi & Fantasy')).toBe('sci-fi-and-fantasy')
    expect(slugify('War & Politics')).toBe('war-and-politics')
  })
})

describe('mergeGenres', () => {
  it('carries both ids for a name that exists on both sides', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const drama = merged.find((genre) => genre.slug === 'drama')
    expect(drama).toEqual({ slug: 'drama', name: 'Drama', movieId: 18, tvId: 18 })
  })

  it('carries only a movie id for a movie-only genre', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const history = merged.find((genre) => genre.slug === 'history')
    expect(history?.movieId).toBe(36)
    expect(history?.tvId).toBeUndefined()
  })

  it('carries only a tv id for a tv-only genre', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const reality = merged.find((genre) => genre.slug === 'reality')
    expect(reality?.tvId).toBe(10764)
    expect(reality?.movieId).toBeUndefined()
  })

  it('keeps Action and Action & Adventure apart, because TMDB does', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const action = merged.find((genre) => genre.slug === 'action')
    const actionAdventure = merged.find((genre) => genre.slug === 'action-and-adventure')
    expect(action).toEqual({ slug: 'action', name: 'Action', movieId: 28 })
    expect(actionAdventure).toEqual({
      slug: 'action-and-adventure',
      name: 'Action & Adventure',
      tvId: 10759,
    })
  })

  it('produces the union of both lists, deduplicated by name', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    expect(merged).toHaveLength(27)
    expect(new Set(merged.map((genre) => genre.slug)).size).toBe(27)
  })

  it('sorts alphabetically by name', () => {
    // The locale is pinned to 'en' in lib/genres.ts specifically because sort order
    // is locale-dependent; a locale-less comparator here would fail this assertion
    // under a differently-collating locale (e.g. lt-LT) even though the code is right.
    const names = mergeGenres(movieGenres(), tvGenres()).map((genre) => genre.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('never produces an entry with neither id', () => {
    for (const genre of mergeGenres(movieGenres(), tvGenres())) {
      expect(genre.movieId ?? genre.tvId).toBeDefined()
    }
  })
})
