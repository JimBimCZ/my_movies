import type { MediaType } from './types'

export const REVALIDATE = {
  configuration: 60 * 60 * 24,
  genres: 60 * 60 * 24,
  trending: 60 * 60,
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 5,
} as const

type ListName =
  | 'now-playing'
  | 'top-rated'
  | 'airing-today'
  | `genre-${number}`
  | `tv-genre-${number}`

export const tags = {
  configuration: 'tmdb:configuration',
  genres: 'tmdb:genres',
  trending: 'tmdb:trending',
  list: (name: ListName) => `tmdb:list:${name}`,
  detail: (mediaType: MediaType, id: number) => `tmdb:title:${mediaType}:${id}`,
  search: 'tmdb:search',
} as const

const FIXED_TAGS: ReadonlySet<string> = new Set([
  tags.configuration,
  tags.genres,
  tags.trending,
  tags.search,
])
const LIST_TAG = /^tmdb:list:(?:now-playing|top-rated|airing-today|genre-\d+|tv-genre-\d+)$/
const DETAIL_TAG = /^tmdb:title:(?:movie|tv):\d+$/

// Mirrors the builders above, and must keep mirroring them. Revalidation is reachable over
// HTTP, and revalidateTag on a caller-chosen string would let one request purge anything and
// force an unbounded refetch against TMDB's rate limit.
export function isKnownTag(tag: string): boolean {
  return FIXED_TAGS.has(tag) || LIST_TAG.test(tag) || DETAIL_TAG.test(tag)
}
