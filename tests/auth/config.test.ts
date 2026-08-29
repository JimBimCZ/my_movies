import { describe, expect, it } from 'vitest'
import { projectSession } from '@/server/auth/config'

describe('auth config', () => {
  it('imports without a DATABASE_URL', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const mod = await import('@/server/auth/config')
      expect(typeof mod.auth).toBe('function')
      expect(typeof mod.signIn).toBe('function')
      expect(typeof mod.signOut).toBe('function')
      expect(mod.handlers).toHaveProperty('GET')
      expect(mod.handlers).toHaveProperty('POST')
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved
    }
  })
})

describe('projectSession', () => {
  it('does not leak the adapter session onto the returned object', () => {
    const result = projectSession(
      { id: 'user-1', name: 'Ada', email: 'ada@example.test', image: null },
      new Date('2026-09-01T00:00:00.000Z'),
    ) as unknown as Record<string, unknown>

    expect(result.sessionToken).toBeUndefined()
    expect(result.userId).toBeUndefined()
    expect(result).toEqual({
      user: { id: 'user-1', name: 'Ada', email: 'ada@example.test', image: null },
      expires: '2026-09-01T00:00:00.000Z',
    })
  })
})
