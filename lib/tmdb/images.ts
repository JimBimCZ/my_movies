import { tmdbFetch } from './client'
import type { TmdbConfiguration } from './types'

export const POSTER_SLOTS = { card: 342, detail: 500 } as const
export const BACKDROP_SLOTS = { hero: 1280 } as const

export function pickSize(available: string[], target: number): string {
  const widths = available
    .filter((size) => size.startsWith('w'))
    .map((size) => ({ size, width: Number(size.slice(1)) }))
    .sort((a, b) => a.width - b.width)

  const fit = widths.find((candidate) => candidate.width >= target) ?? widths[widths.length - 1]
  return fit?.size ?? 'original'
}

export function buildImageUrl(base: string, size: string, path: string | null): string | null {
  return path ? `${base}${size}${path}` : null
}

export async function getImageConfig(): Promise<TmdbConfiguration['images']> {
  const config = await tmdbFetch<TmdbConfiguration>('/configuration', {
    revalidate: 60 * 60 * 24,
    tags: ['tmdb:configuration'],
  })
  return config.images
}
