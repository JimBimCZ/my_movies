import { getMovieGenres, getTvGenres } from './lists'
import { mergeGenres, type MergedGenre } from '@/lib/genres'

export async function getMergedGenres(): Promise<MergedGenre[]> {
  const [movies, tv] = await Promise.all([getMovieGenres(), getTvGenres()])
  return mergeGenres(movies, tv)
}

export async function findGenreBySlug(slug: string): Promise<MergedGenre | null> {
  const merged = await getMergedGenres()
  return merged.find((genre) => genre.slug === slug) ?? null
}
