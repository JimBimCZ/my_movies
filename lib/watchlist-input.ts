import type { MediaType } from '@/server/tmdb/types'

export function parseToggleInput(
  input: unknown,
): { tmdbId: number; mediaType: MediaType } | null {
  if (typeof input !== 'object' || input === null) return null

  const { tmdbId, mediaType } = input as { tmdbId?: unknown; mediaType?: unknown }
  if (typeof tmdbId !== 'number' || !Number.isInteger(tmdbId) || tmdbId <= 0) return null
  if (mediaType !== 'movie' && mediaType !== 'tv') return null

  return { tmdbId, mediaType }
}
