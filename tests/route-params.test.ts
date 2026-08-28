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

  it('rejects zero', () => {
    expect(parseTmdbId('0')).toBeNull()
  })

  it('rejects non-canonical ids with leading zeros', () => {
    expect(parseTmdbId('007')).toBeNull()
    expect(parseTmdbId('01')).toBeNull()
  })

  it('rejects ids past Number.MAX_SAFE_INTEGER', () => {
    expect(parseTmdbId('99999999999999999999')).toBeNull()
    expect(parseTmdbId('9007199254740992')).toBeNull()
  })

  it('accepts the largest safe integer', () => {
    expect(parseTmdbId('9007199254740991')).toBe(9007199254740991)
  })
})
