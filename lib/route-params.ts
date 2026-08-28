import type { MediaType } from '@/server/tmdb/types'

export function parseMediaType(value: string): MediaType | null {
  return value === 'movie' || value === 'tv' ? value : null
}

export function parseTmdbId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}
