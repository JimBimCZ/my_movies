import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { MediaType, MovieDetailFull, TvDetailFull } from '../types'

// One request instead of four. `include_image_language=en,null` keeps English and
// textless artwork; without it TMDB returns every localisation of every poster.
const APPENDED = {
  append_to_response: 'credits,videos,images',
  include_image_language: 'en,null',
} as const

export function getMovieDetail(id: number): Promise<MovieDetailFull> {
  return tmdbFetch<MovieDetailFull>(`/movie/${id}`, {
    searchParams: APPENDED,
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('movie', id)],
  })
}

export function getTvDetail(id: number): Promise<TvDetailFull> {
  return tmdbFetch<TvDetailFull>(`/tv/${id}`, {
    searchParams: APPENDED,
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('tv', id)],
  })
}

export type TitleDetail =
  | (MovieDetailFull & { media_type: 'movie' })
  | (TvDetailFull & { media_type: 'tv' })

export async function getTitleDetail(mediaType: MediaType, id: number): Promise<TitleDetail> {
  return mediaType === 'movie'
    ? { ...(await getMovieDetail(id)), media_type: 'movie' }
    : { ...(await getTvDetail(id)), media_type: 'tv' }
}
