import { describe, expect, it } from 'vitest'

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
