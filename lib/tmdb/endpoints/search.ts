import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { PagedResponse, SearchResultItem, TrendingItem } from '../types'

export async function searchMulti(query: string): Promise<TrendingItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const page = await tmdbFetch<PagedResponse<SearchResultItem>>('/search/multi', {
    searchParams: { query: trimmed },
    revalidate: REVALIDATE.search,
    tags: [tags.search],
  })

  return page.results.filter(
    (item): item is TrendingItem => item.media_type === 'movie' || item.media_type === 'tv',
  )
}
