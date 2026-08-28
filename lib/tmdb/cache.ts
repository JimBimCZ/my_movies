export const REVALIDATE = {
  configuration: 60 * 60 * 24,
  genres: 60 * 60 * 24,
  trending: 60 * 60,
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 5,
} as const

export const tags = {
  configuration: 'tmdb:configuration',
  genres: 'tmdb:genres',
  trending: 'tmdb:trending',
  list: (name: string) => `tmdb:list:${name}`,
  detail: (mediaType: string, id: number) => `tmdb:title:${mediaType}:${id}`,
  search: 'tmdb:search',
} as const
