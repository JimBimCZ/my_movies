import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/title/[mediaType]/[id]/page.tsx', 'utf8')

describe('title detail layout', () => {
  // The backdrop container is `relative`, so it paints after any static sibling that
  // follows it. Without its own stacking level the content pulled up by -mt-24 is
  // painted over rather than overlapping.
  it('raises the content container above the backdrop it overlaps', () => {
    const code = page()
    expect(code).toMatch(/-mt-24[^"]*/)
    const contentClass = code.match(/className="([^"]*-mt-24[^"]*)"/)?.[1] ?? ''
    expect(contentClass).toContain('relative')
    expect(contentClass).toMatch(/\bz-10\b/)
  })
})
