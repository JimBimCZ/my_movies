import { describe, expect, it } from 'vitest'
import { buildImageUrl, pickSize } from '@/lib/tmdb/images'

const POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']
const BASE = 'https://image.tmdb.org/t/p/'

describe('pickSize', () => {
  it('picks the smallest size at or above the target', () => {
    expect(pickSize(POSTER_SIZES, 342)).toBe('w342')
    expect(pickSize(POSTER_SIZES, 200)).toBe('w342')
    expect(pickSize(POSTER_SIZES, 92)).toBe('w92')
  })

  it('falls back to the largest concrete size when the target exceeds all of them', () => {
    expect(pickSize(POSTER_SIZES, 5000)).toBe('w780')
  })

  it('ignores a malformed size entry instead of letting it win the fallback', () => {
    const withMalformed = ['w92', 'w780', 'w_large', 'original']
    expect(pickSize(withMalformed, 5000)).toBe('w780')
  })

  it('ignores the original entry when a concrete width fits', () => {
    expect(pickSize(POSTER_SIZES, 500)).toBe('w500')
  })
})

describe('buildImageUrl', () => {
  it('joins base, size and path', () => {
    expect(buildImageUrl(BASE, 'w342', '/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg')
  })

  it('returns null for a missing poster path', () => {
    expect(buildImageUrl(BASE, 'w342', null)).toBeNull()
  })
})
