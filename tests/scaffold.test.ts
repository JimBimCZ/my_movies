import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('builds a standalone server bundle', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    expect(config).toContain("output: 'standalone'")
  })

  it('keeps env files out of git', () => {
    expect(readFileSync('.gitignore', 'utf8')).toContain('.env*.local')
  })
})
