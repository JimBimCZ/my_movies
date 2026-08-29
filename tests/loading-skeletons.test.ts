import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const home = () => readFileSync('app/page.tsx', 'utf8')
const search = () => readFileSync('app/search/page.tsx', 'utf8')
const rowSkeleton = () => readFileSync('components/row-skeleton.tsx', 'utf8')
const titleLoading = () => readFileSync('app/title/[mediaType]/[id]/loading.tsx', 'utf8')

describe('loading skeletons', () => {
  it('gives the hero a skeleton shaped like the hero, not a bare block', () => {
    const code = home()
    expect(code).toContain('<HeroSkeleton />')
    expect(code).not.toMatch(/fallback=\{<div className="mb-8 h-\[60vh\]/)
  })

  it('keeps the search box on screen while its boundary suspends', () => {
    // A Suspense with no fallback renders nothing, so the input disappears rather
    // than degrading to a placeholder of the same size.
    expect(search()).not.toMatch(/<Suspense>\s*<SearchInput \/>/)
    expect(search()).toContain('<SearchInputSkeleton />')
  })

  it('reserves a row per genre row that will arrive, not one for all of them', () => {
    const code = home()
    expect(code).toContain('GENRE_ROW_COUNT')
    expect(code).toMatch(/slice\(0, GENRE_ROW_COUNT\)/)
    expect(code).toMatch(/Array\.from\(\{ length: GENRE_ROW_COUNT \}\)/)
    expect(code).not.toContain('title="By genre"')
  })

  it('drops the label association when the row skeleton has no title to show', () => {
    const code = rowSkeleton()
    expect(code).toMatch(/title\?:/)
    expect(code).toMatch(/title \?/)
  })
})

describe('title detail skeleton', () => {
  it('reserves the facts block the page now renders', () => {
    expect(titleLoading()).toContain('animate-pulse')
    expect(titleLoading()).toMatch(/grid|sm:grid-cols-2/)
  })

  it('reserves a row below the fold for the cast', () => {
    // Without it the page grows by a full row height when the data lands and
    // everything below jumps.
    expect(titleLoading()).toContain('<RowSkeleton')
  })
})
