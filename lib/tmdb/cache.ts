import type { MediaType } from './types'

export const REVALIDATE = {
  configuration: 60 * 60 * 24,
  genres: 60 * 60 * 24,
  trending: 60 * 60,
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 5,
} as const

type ListName = 'now-playing' | 'top-rated' | 'airing-today' | `genre-${number}`

export const tags = {
  configuration: 'tmdb:configuration',
  genres: 'tmdb:genres',
  trending: 'tmdb:trending',
  list: (name: ListName) => `tmdb:list:${name}`,
  detail: (mediaType: MediaType, id: number) => `tmdb:title:${mediaType}:${id}`,
  search: 'tmdb:search',
} as const
