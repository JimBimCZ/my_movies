import type { MediaType } from '@/server/tmdb/types'

export function parseMediaType(value: string): MediaType | null {
  return value === 'movie' || value === 'tv' ? value : null
}

export function parseTmdbId(value: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(value)) return null
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return id
}
