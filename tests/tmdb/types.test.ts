import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type {
  Genre,
  MovieDetail,
  MovieDetailFull,
  MovieListItem,
  PagedResponse,
  SearchResultItem,
  TmdbConfiguration,
  TrendingItem,
  TvDetail,
  TvDetailFull,
  TvListItem,
} from '@/server/tmdb/types'

const load = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8'))

const declaredKeys = <T>(declared: Record<keyof T, true>): string[] =>
  Object.keys(declared).sort()

const MOVIE_LIST_ITEM_KEYS = declaredKeys<MovieListItem>({
  adult: true,
  backdrop_path: true,
  genre_ids: true,
  id: true,
  original_language: true,
  original_title: true,
  overview: true,
  popularity: true,
  poster_path: true,
  release_date: true,
  softcore: true,
  title: true,
  video: true,
  vote_average: true,
  vote_count: true,
})

const TV_LIST_ITEM_KEYS = declaredKeys<TvListItem>({
  adult: true,
  backdrop_path: true,
  first_air_date: true,
  genre_ids: true,
  id: true,
  name: true,
  origin_country: true,
  original_language: true,
  original_name: true,
  overview: true,
  popularity: true,
  poster_path: true,
  softcore: true,
  vote_average: true,
  vote_count: true,
})

const MOVIE_DETAIL_KEYS = declaredKeys<MovieDetail>({
  adult: true,
  backdrop_path: true,
  budget: true,
  genres: true,
  homepage: true,
  id: true,
  imdb_id: true,
  origin_country: true,
  original_language: true,
  original_title: true,
  overview: true,
  popularity: true,
  poster_path: true,
  production_companies: true,
  release_date: true,
  revenue: true,
  runtime: true,
  softcore: true,
  status: true,
  tagline: true,
  title: true,
  video: true,
  vote_average: true,
  vote_count: true,
})

const TV_DETAIL_KEYS = declaredKeys<TvDetail>({
  adult: true,
  backdrop_path: true,
  created_by: true,
  episode_run_time: true,
  first_air_date: true,
  genres: true,
  homepage: true,
  id: true,
  in_production: true,
  languages: true,
  last_air_date: true,
  name: true,
  networks: true,
  number_of_episodes: true,
  number_of_seasons: true,
  origin_country: true,
  original_language: true,
  original_name: true,
  overview: true,
  popularity: true,
  poster_path: true,
  softcore: true,
  status: true,
  tagline: true,
  type: true,
  vote_average: true,
  vote_count: true,
})

const keysOf = (value: unknown) => Object.keys(value as object).sort()

const isStringOrNull = (value: unknown) => value === null || typeof value === 'string'

describe('captured TMDB payloads', () => {
  it('configuration exposes an image base url and poster sizes', () => {
    const config = load('configuration') as TmdbConfiguration
    expect(config.images.secure_base_url).toBe('https://image.tmdb.org/t/p/')
    expect(config.images.poster_sizes).toContain('w342')
    expect(config.images.backdrop_sizes).toContain('w1280')
  })

  it('trending items carry a media_type discriminator', () => {
    const page = load('trending') as PagedResponse<TrendingItem>
    expect(page.results.length).toBeGreaterThan(0)
    for (const item of page.results) {
      expect(['movie', 'tv']).toContain(item.media_type)
    }
  })

  it('now_playing items do not carry media_type', () => {
    const page = load('now-playing') as PagedResponse<Record<string, unknown>>
    expect(page.results[0]).not.toHaveProperty('media_type')
    expect(page.results[0]).toHaveProperty('title')
  })

  it('airing_today items use name rather than title', () => {
    const page = load('airing-today') as PagedResponse<Record<string, unknown>>
    expect(page.results[0]).toHaveProperty('name')
    expect(page.results[0]).not.toHaveProperty('title')
  })

  it('MovieListItem declares exactly the keys the movie list endpoints return', () => {
    for (const fixture of ['now-playing', 'top-rated', 'discover-movie']) {
      const page = load(fixture) as PagedResponse<MovieListItem>
      for (const item of page.results) {
        expect(keysOf(item), fixture).toEqual(MOVIE_LIST_ITEM_KEYS)
      }
    }
  })

  it('TvListItem declares exactly the keys the tv list endpoints return', () => {
    const page = load('airing-today') as PagedResponse<TvListItem>
    for (const item of page.results) {
      expect(keysOf(item)).toEqual(TV_LIST_ITEM_KEYS)
    }
  })

  it('each TrendingItem variant is its list item plus media_type', () => {
    const page = load('trending') as PagedResponse<TrendingItem>
    const seen = new Set<string>()
    for (const item of page.results) {
      seen.add(item.media_type)
      const expected =
        item.media_type === 'movie' ? MOVIE_LIST_ITEM_KEYS : TV_LIST_ITEM_KEYS
      expect(keysOf(item)).toEqual([...expected, 'media_type'].sort())
    }
    expect(seen).toEqual(new Set(['movie', 'tv']))
  })

  it('search/multi mixes movie, tv and person results', () => {
    const page = load('search-multi') as PagedResponse<SearchResultItem>
    const kinds = new Set(page.results.map((item) => item.media_type))
    expect(kinds).toEqual(new Set(['movie', 'tv', 'person']))
    for (const item of page.results) {
      if (item.media_type !== 'person') continue
      expect(typeof item.name).toBe('string')
      expect(isStringOrNull(item.profile_path)).toBe(true)
      for (const known of item.known_for) {
        expect(['movie', 'tv']).toContain(known.media_type)
      }
    }
  })

  it('poster_path and backdrop_path are nullable across list payloads', () => {
    const page = load('search-multi') as PagedResponse<SearchResultItem>
    const media = page.results.filter(
      (item): item is TrendingItem => item.media_type !== 'person',
    )
    expect(media.length).toBeGreaterThan(0)
    for (const item of media) {
      expect(isStringOrNull(item.poster_path)).toBe(true)
      expect(isStringOrNull(item.backdrop_path)).toBe(true)
    }
    expect(media.some((item) => item.backdrop_path === null)).toBe(true)
  })

  it('the genre list endpoint returns id/name pairs', () => {
    const payload = load('genres-movie') as { genres: Genre[] }
    expect(payload.genres.length).toBeGreaterThan(0)
    for (const genre of payload.genres) {
      expect(keysOf(genre)).toEqual(['id', 'name'])
      expect(typeof genre.id).toBe('number')
      expect(typeof genre.name).toBe('string')
    }
  })

  it('movie detail expands genres and adds runtime instead of genre_ids', () => {
    const detail = load('movie-detail') as MovieDetail
    expect(detail).not.toHaveProperty('genre_ids')
    expect(detail).not.toHaveProperty('media_type')
    expect(detail.id).toBe(27205)
    expect(detail.title).toBe('Inception')
    expect(typeof detail.overview).toBe('string')
    expect(typeof detail.release_date).toBe('string')
    expect(typeof detail.vote_average).toBe('number')
    expect(typeof detail.runtime).toBe('number')
    expect(isStringOrNull(detail.poster_path)).toBe(true)
    expect(isStringOrNull(detail.backdrop_path)).toBe(true)
    expect(isStringOrNull(detail.imdb_id)).toBe(true)
    for (const genre of detail.genres) {
      expect(keysOf(genre)).toEqual(['id', 'name'])
    }
  })

  it('tv detail uses name/first_air_date and season counts, never runtime', () => {
    const detail = load('tv-detail') as TvDetail
    expect(detail).not.toHaveProperty('genre_ids')
    expect(detail).not.toHaveProperty('runtime')
    expect(detail).not.toHaveProperty('title')
    expect(detail).not.toHaveProperty('release_date')
    expect(detail.id).toBe(1396)
    expect(detail.name).toBe('Breaking Bad')
    expect(typeof detail.overview).toBe('string')
    expect(typeof detail.first_air_date).toBe('string')
    expect(typeof detail.vote_average).toBe('number')
    expect(typeof detail.number_of_seasons).toBe('number')
    expect(isStringOrNull(detail.last_air_date)).toBe(true)
    expect(isStringOrNull(detail.poster_path)).toBe(true)
    expect(isStringOrNull(detail.backdrop_path)).toBe(true)
    expect(Array.isArray(detail.episode_run_time)).toBe(true)
    for (const genre of detail.genres) {
      expect(keysOf(genre)).toEqual(['id', 'name'])
    }
  })

  it('every declared detail field is present in the captured detail payloads', () => {
    const movie = load('movie-detail')
    for (const key of MOVIE_DETAIL_KEYS) {
      expect(movie, `movie-detail.${key}`).toHaveProperty(key)
    }

    const tv = load('tv-detail')
    for (const key of TV_DETAIL_KEYS) {
      expect(tv, `tv-detail.${key}`).toHaveProperty(key)
    }
  })

  it('appended credits carry a cast ordered from the top billing', () => {
    const detail = load('movie-detail') as MovieDetailFull
    expect(detail.credits.cast[0]!.order).toBe(0)
    expect(typeof detail.credits.cast[0]!.character).toBe('string')
    expect(isStringOrNull(detail.credits.cast[0]!.profile_path)).toBe(true)
    expect(detail.credits.crew.some((member) => member.job === 'Director')).toBe(true)
  })

  it('cast_id is a movie-credits field: tv cast entries omit it entirely', () => {
    // Not null — the key is absent. CastMember is shared by both media types, so it
    // has to be optional or every tv cast entry is a lie about its own shape.
    const movie = load('movie-detail') as MovieDetailFull
    const tv = load('tv-detail') as TvDetailFull
    expect(movie.credits.cast.every((member) => 'cast_id' in member)).toBe(true)
    expect(tv.credits.cast.some((member) => 'cast_id' in member)).toBe(false)
  })

  it('tv credits name no Director; the creator lives on created_by', () => {
    const detail = load('tv-detail') as TvDetailFull
    expect(detail.credits.crew.some((member) => member.job === 'Director')).toBe(false)
    expect(detail.created_by.length).toBeGreaterThan(0)
    expect(typeof detail.created_by[0]!.name).toBe('string')
  })

  it('a real tv payload can carry no videos and no episode runtime at all', () => {
    const detail = load('tv-detail') as TvDetailFull
    expect(detail.videos.results).toEqual([])
    expect(detail.episode_run_time).toEqual([])
  })

  it('appended images expose voted backdrops', () => {
    const detail = load('movie-detail') as MovieDetailFull
    expect(detail.images.backdrops.length).toBeGreaterThan(0)
    for (const asset of detail.images.backdrops) {
      expect(typeof asset.file_path).toBe('string')
      expect(typeof asset.vote_average).toBe('number')
      expect(typeof asset.vote_count).toBe('number')
    }
  })

  it('paged envelopes carry page and total counts', () => {
    for (const fixture of [
      'trending',
      'now-playing',
      'top-rated',
      'airing-today',
      'discover-movie',
      'search-multi',
    ]) {
      const page = load(fixture) as PagedResponse<unknown>
      expect(typeof page.page, fixture).toBe('number')
      expect(typeof page.total_pages, fixture).toBe('number')
      expect(typeof page.total_results, fixture).toBe('number')
      expect(Array.isArray(page.results), fixture).toBe(true)
    }
  })
})
