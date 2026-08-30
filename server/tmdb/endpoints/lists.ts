import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { Genre, MovieListItem, PagedResponse, SearchResultItem, TrendingItem, TvListItem } from '../types'

export async function getTrending(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<SearchResultItem>>('/trending/all/week', {
    revalidate: REVALIDATE.trending,
    tags: [tags.trending],
  })
  return page.results.filter(
    (item): item is TrendingItem => item.media_type === 'movie' || item.media_type === 'tv',
  )
}

export async function getNowPlaying(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/now_playing', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('now-playing')],
  })
  return page.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function getTopRated(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/top_rated', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('top-rated')],
  })
  return page.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function getAiringToday(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<TvListItem>>('/tv/airing_today', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('airing-today')],
  })
  return page.results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

const UPCOMING_WINDOW_MONTHS = 12

// Not /movie/upcoming: that endpoint sorts by popularity and ignores its own advertised
// `dates` window, so it returns films released months ago (verified 2026-08-30 — it reported
// a 2026-09-02..2026-09-23 window while returning a 2026-04-16 title). Passing a region
// tightens the window but mixes in anniversary re-releases. Discover with an explicit
// release-date floor is the only variant where every result is genuinely unreleased.
export async function getUpcoming(): Promise<TrendingItem[]> {
  const from = new Date()
  const to = new Date(from)
  to.setMonth(to.getMonth() + UPCOMING_WINDOW_MONTHS)
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/discover/movie', {
    searchParams: {
      'primary_release_date.gte': from.toISOString().slice(0, 10),
      'primary_release_date.lte': to.toISOString().slice(0, 10),
      sort_by: 'popularity.desc',
    },
    revalidate: REVALIDATE.list,
    tags: [tags.list('upcoming')],
  })
  return page.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function getMovieGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<{ genres: Genre[] }>('/genre/movie/list', {
    revalidate: REVALIDATE.genres,
    tags: [tags.genres],
  })
  return response.genres
}

export async function discoverByGenre(genreId: number): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/discover/movie', {
    searchParams: { with_genres: genreId, sort_by: 'popularity.desc' },
    revalidate: REVALIDATE.list,
    tags: [tags.list(`genre-${genreId}`)],
  })
  return page.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function getTvGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<{ genres: Genre[] }>('/genre/tv/list', {
    revalidate: REVALIDATE.genres,
    tags: [tags.genres],
  })
  return response.genres
}

export async function discoverTvByGenre(genreId: number): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<TvListItem>>('/discover/tv', {
    searchParams: { with_genres: genreId, sort_by: 'popularity.desc' },
    revalidate: REVALIDATE.list,
    tags: [tags.list(`tv-genre-${genreId}`)],
  })
  return page.results.map((item) => ({ ...item, media_type: 'tv' as const }))
}
