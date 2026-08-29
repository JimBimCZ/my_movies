import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('footer links', () => {
  it('links to the privacy policy', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toContain('href="/privacy"')
    expect(footer).toMatch(/Privacy Policy/)
  })

  it('serves a page at that route', () => {
    expect(existsSync('app/privacy/page.tsx')).toBe(true)
  })
})
