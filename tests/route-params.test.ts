import { describe, expect, it } from 'vitest'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'

describe('parseMediaType', () => {
  it('accepts the two supported media types', () => {
    expect(parseMediaType('movie')).toBe('movie')
    expect(parseMediaType('tv')).toBe('tv')
  })

  it('rejects anything else', () => {
    expect(parseMediaType('person')).toBeNull()
    expect(parseMediaType('MOVIE')).toBeNull()
    expect(parseMediaType('')).toBeNull()
  })
})

describe('parseTmdbId', () => {
  it('accepts a positive integer', () => {
    expect(parseTmdbId('27205')).toBe(27205)
  })

  it('rejects non-numeric, negative, and float ids', () => {
    expect(parseTmdbId('abc')).toBeNull()
    expect(parseTmdbId('-1')).toBeNull()
    expect(parseTmdbId('1.5')).toBeNull()
  })
})
