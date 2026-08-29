import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  formatRuntime,
  pickBackdrops,
  pickCast,
  pickTrailer,
  toTitleFacts,
} from '@/lib/title-detail'
import type { TitleDetail } from '@/server/tmdb/endpoints/titles'
import type { Video } from '@/server/tmdb/types'

const detail = (name: string, mediaType: 'movie' | 'tv') =>
  ({
    ...JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8')),
    media_type: mediaType,
  }) as TitleDetail

const movie = () => detail('movie-detail', 'movie')
const tv = () => detail('tv-detail', 'tv')

const video = (overrides: Partial<Video>): Video => ({
  id: 'x',
  iso_639_1: 'en',
  iso_3166_1: 'US',
  key: 'k',
  name: 'n',
  official: true,
  published_at: '2020-01-01T00:00:00.000Z',
  site: 'YouTube',
  size: 1080,
  type: 'Trailer',
  ...overrides,
})

describe('formatRuntime', () => {
  it('splits minutes into hours and minutes', () => {
    expect(formatRuntime(148)).toBe('2h 28m')
  })

  it('drops the hour part below an hour', () => {
    expect(formatRuntime(45)).toBe('45m')
  })

  it('drops the minute part on a whole hour', () => {
    expect(formatRuntime(120)).toBe('2h')
  })
})

describe('toTitleFacts', () => {
  it('names the director from the movie crew', () => {
    const facts = toTitleFacts(movie())
    expect(facts).toContainEqual({ label: 'Director', value: 'Christopher Nolan' })
  })

  it('formats the movie release date and runtime', () => {
    const facts = toTitleFacts(movie())
    expect(facts).toContainEqual({ label: 'Released', value: 'July 15, 2010' })
    expect(facts).toContainEqual({ label: 'Runtime', value: '2h 28m' })
  })

  it('names the creator for tv, where the crew has no Director', () => {
    const facts = toTitleFacts(tv())
    expect(facts).toContainEqual({ label: 'Creator', value: 'Vince Gilligan' })
    expect(facts.map((fact) => fact.label)).not.toContain('Director')
  })

  it('counts seasons and episodes for tv instead of a runtime', () => {
    const facts = toTitleFacts(tv())
    expect(facts).toContainEqual({ label: 'Seasons', value: '5 seasons · 62 episodes' })
    expect(facts.map((fact) => fact.label)).not.toContain('Runtime')
  })

  it('omits a fact rather than emitting an empty value', () => {
    const bare = { ...movie(), runtime: 0, status: '', production_companies: [] }
    const labels = toTitleFacts(bare as TitleDetail).map((fact) => fact.label)
    expect(labels).not.toContain('Runtime')
    expect(labels).not.toContain('Status')
    expect(labels).not.toContain('Studio')
  })
})

describe('pickTrailer', () => {
  it('prefers the newest official YouTube trailer', () => {
    const chosen = pickTrailer([
      video({ key: 'old', published_at: '2010-01-01T00:00:00.000Z' }),
      video({ key: 'new', published_at: '2022-01-01T00:00:00.000Z' }),
    ])
    expect(chosen?.key).toBe('new')
  })

  it('ignores clips and featurettes', () => {
    const chosen = pickTrailer([
      video({ key: 'clip', type: 'Clip', published_at: '2024-01-01T00:00:00.000Z' }),
      video({ key: 'trailer', type: 'Trailer' }),
    ])
    expect(chosen?.key).toBe('trailer')
  })

  it('falls back to a teaser when there is no trailer', () => {
    expect(pickTrailer([video({ key: 't', type: 'Teaser' })])?.key).toBe('t')
  })

  it('prefers an official trailer over an unofficial one', () => {
    const chosen = pickTrailer([
      video({ key: 'fan', official: false, published_at: '2024-01-01T00:00:00.000Z' }),
      video({ key: 'official', official: true, published_at: '2010-01-01T00:00:00.000Z' }),
    ])
    expect(chosen?.key).toBe('official')
  })

  it('prefers an unofficial trailer over an official teaser', () => {
    const chosen = pickTrailer([
      video({ key: 'teaser', type: 'Teaser', official: true, published_at: '2024-01-01T00:00:00.000Z' }),
      video({ key: 'trailer', type: 'Trailer', official: false, published_at: '2010-01-01T00:00:00.000Z' }),
    ])
    expect(chosen?.key).toBe('trailer')
  })

  it('ignores anything not hosted on YouTube', () => {
    expect(pickTrailer([video({ site: 'Vimeo' })])).toBeNull()
  })

  it('returns null for a title with no videos at all', () => {
    expect(pickTrailer(tv().videos.results)).toBeNull()
  })
})

describe('pickCast', () => {
  it('takes the top billing in order', () => {
    const reversed = { ...movie().credits, cast: [...movie().credits.cast].reverse() }
    const cast = pickCast(reversed, 3)
    expect(cast).toHaveLength(3)
    expect(cast[0]!.order).toBe(0)
    expect(cast[0]!.name).toBe('Leonardo DiCaprio')
  })

  it('returns everything available when the limit exceeds the cast', () => {
    expect(pickCast(tv().credits, 100)).toHaveLength(tv().credits.cast.length)
  })
})

describe('pickBackdrops', () => {
  it('puts the best-voted backdrop first and honours the limit', () => {
    const images = { ...movie().images, backdrops: [...movie().images.backdrops].reverse() }
    const picked = pickBackdrops(images, 3)
    expect(picked).toHaveLength(3)
    expect(picked[0]!.vote_average).toBeGreaterThanOrEqual(picked[1]!.vote_average)
    expect(picked[1]!.vote_average).toBeGreaterThanOrEqual(picked[2]!.vote_average)
  })

  it('does not mutate the payload it was handed', () => {
    const images = { ...movie().images, backdrops: [...movie().images.backdrops].reverse() }
    const before = images.backdrops.map((asset) => asset.file_path)
    pickBackdrops(images, 3)
    expect(images.backdrops.map((asset) => asset.file_path)).toEqual(before)
  })
})
