import { describe, expect, it } from 'vitest'
import { resolveDriver } from '@/db/client'

describe('resolveDriver', () => {
  it('honours an explicit DB_DRIVER over runtime inference', () => {
    expect(resolveDriver({ DB_DRIVER: 'node-postgres', VERCEL: '1' })).toBe('node-postgres')
    expect(resolveDriver({ DB_DRIVER: 'neon-http' })).toBe('neon-http')
  })

  it('defaults to neon-http on Vercel', () => {
    expect(resolveDriver({ VERCEL: '1' })).toBe('neon-http')
  })

  it('defaults to node-postgres off Vercel', () => {
    expect(resolveDriver({})).toBe('node-postgres')
  })

  it('rejects an unrecognised DB_DRIVER rather than silently guessing', () => {
    expect(() => resolveDriver({ DB_DRIVER: 'sqlite' })).toThrow(/DB_DRIVER/)
  })
})
