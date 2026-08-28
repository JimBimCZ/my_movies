import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { Genre, MovieListItem, PagedResponse, TrendingItem, TvListItem } from '../types'

export async function getTrending(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<TrendingItem>>('/trending/all/week', {
    revalidate: REVALIDATE.trending,
    tags: [tags.trending],
  })
  return page.results
}

export async function getNowPlaying(): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/now_playing', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('now-playing')],
  })
  return page.results
}

export async function getTopRated(): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/top_rated', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('top-rated')],
  })
  return page.results
}

export async function getAiringToday(): Promise<TvListItem[]> {
  const page = await tmdbFetch<PagedResponse<TvListItem>>('/tv/airing_today', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('airing-today')],
  })
  return page.results
}

export async function getMovieGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<{ genres: Genre[] }>('/genre/movie/list', {
    revalidate: REVALIDATE.genres,
    tags: [tags.genres],
  })
  return response.genres
}

export async function discoverByGenre(genreId: number): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/discover/movie', {
    searchParams: { with_genres: genreId, sort_by: 'popularity.desc' },
    revalidate: REVALIDATE.list,
    tags: [tags.list(`genre-${genreId}`)],
  })
  return page.results
}
