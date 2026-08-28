import type { MediaType, TrendingItem } from '@/server/tmdb/types'

export interface CardItem {
  id: number
  title: string
  posterPath: string | null
  mediaType: MediaType
}

export function toCardItem(item: TrendingItem): CardItem {
  return {
    id: item.id,
    title: item.media_type === 'movie' ? item.title : item.name,
    posterPath: item.poster_path,
    mediaType: item.media_type,
  }
}
