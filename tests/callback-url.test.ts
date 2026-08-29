import { describe, expect, it } from 'vitest'
import { safeCallbackUrl } from '@/lib/callback-url'

describe('safeCallbackUrl', () => {
  it('keeps a relative path', () => {
    expect(safeCallbackUrl('/title/movie/157336')).toBe('/title/movie/157336')
    expect(safeCallbackUrl('/watchlist')).toBe('/watchlist')
  })

  it('keeps a query string', () => {
    expect(safeCallbackUrl('/search?q=dune')).toBe('/search?q=dune')
  })

  it('rejects an absolute URL', () => {
    expect(safeCallbackUrl('https://evil.example/steal')).toBe('/')
    expect(safeCallbackUrl('http://evil.example')).toBe('/')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeCallbackUrl('//evil.example/steal')).toBe('/')
  })

  it('rejects a backslash-obscured host', () => {
    expect(safeCallbackUrl('/\\evil.example')).toBe('/')
  })

  it('falls back for anything missing or repeated', () => {
    expect(safeCallbackUrl(undefined)).toBe('/')
    expect(safeCallbackUrl('')).toBe('/')
    expect(safeCallbackUrl(['/a', '/b'])).toBe('/a')
    expect(safeCallbackUrl('watchlist')).toBe('/')
  })
})
