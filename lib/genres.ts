import type { Genre } from '@/server/tmdb/types'

export interface MergedGenre {
  slug: string
  name: string
  movieId?: number
  tvId?: number
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// TMDB's movie and TV genre lists are disjoint ID spaces: Action is 28 for movies
// and has no TV counterpart, while TV has Action & Adventure at 10759. The eight
// names that appear on both sides do share an ID, which is what makes keying the
// merge on the name safe.
export function mergeGenres(movieGenres: Genre[], tvGenres: Genre[]): MergedGenre[] {
  const merged = new Map<string, MergedGenre>()

  const add = (genre: Genre, key: 'movieId' | 'tvId') => {
    const slug = slugify(genre.name)
    const existing = merged.get(slug) ?? { slug, name: genre.name }
    merged.set(slug, { ...existing, [key]: genre.id })
  }

  for (const genre of movieGenres) add(genre, 'movieId')
  for (const genre of tvGenres) add(genre, 'tvId')

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))
}
