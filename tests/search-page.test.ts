import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = () => readFileSync('app/search/page.tsx', 'utf8')

describe('search page announcements', () => {
  it('keeps a live region that outlives the suspense swap', () => {
    expect(source()).toContain('aria-live="polite"')
  })

  it('excludes the result list from the live region, so only the summary is announced', () => {
    expect(source()).toContain('aria-live="off"')
  })
})
