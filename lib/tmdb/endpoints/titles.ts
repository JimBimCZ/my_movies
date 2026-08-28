import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { MediaType, MovieDetail, TvDetail } from '../types'

export function getMovieDetail(id: number): Promise<MovieDetail> {
  return tmdbFetch<MovieDetail>(`/movie/${id}`, {
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('movie', id)],
  })
}

export function getTvDetail(id: number): Promise<TvDetail> {
  return tmdbFetch<TvDetail>(`/tv/${id}`, {
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('tv', id)],
  })
}

export function getTitleDetail(mediaType: MediaType, id: number): Promise<MovieDetail | TvDetail> {
  return mediaType === 'movie' ? getMovieDetail(id) : getTvDetail(id)
}
