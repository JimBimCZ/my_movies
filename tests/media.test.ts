import { describe, expect, it } from 'vitest'
import { toCardItem } from '@/lib/media'
import type { TrendingItem } from '@/server/tmdb/types'

describe('toCardItem', () => {
  it('reads title from a movie item', () => {
    const card = toCardItem({
      id: 1,
      title: 'Inception',
      poster_path: '/a.jpg',
      media_type: 'movie',
    } as TrendingItem)
    expect(card).toEqual({ id: 1, title: 'Inception', posterPath: '/a.jpg', mediaType: 'movie' })
  })

  it('reads name from a tv item', () => {
    const card = toCardItem({
      id: 2,
      name: 'Breaking Bad',
      poster_path: '/b.jpg',
      media_type: 'tv',
    } as TrendingItem)
    expect(card.title).toBe('Breaking Bad')
    expect(card.mediaType).toBe('tv')
  })

  it('carries a null poster path through rather than inventing one', () => {
    const card = toCardItem({
      id: 4,
      title: 'X',
      poster_path: null,
      media_type: 'movie',
    } as TrendingItem)
    expect(card.posterPath).toBeNull()
  })
})
