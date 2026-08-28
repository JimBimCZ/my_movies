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

export type TitleDetail =
  | (MovieDetail & { media_type: 'movie' })
  | (TvDetail & { media_type: 'tv' })

export async function getTitleDetail(mediaType: MediaType, id: number): Promise<TitleDetail> {
  return mediaType === 'movie'
    ? { ...(await getMovieDetail(id)), media_type: 'movie' }
    : { ...(await getTvDetail(id)), media_type: 'tv' }
}
