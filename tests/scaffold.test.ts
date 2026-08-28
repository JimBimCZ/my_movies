import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('configures standalone output and the TMDB image host', async () => {
    const { default: config } = await import('../next.config')
    expect(config.output).toBe('standalone')
    expect(config.images?.remotePatterns).toContainEqual(
      expect.objectContaining({ hostname: 'image.tmdb.org' }),
    )
  })

  it('keeps env files out of git', () => {
    expect(readFileSync('.gitignore', 'utf8')).toContain('.env*.local')
  })
})
