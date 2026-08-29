import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = () => readFileSync('components/hero.tsx', 'utf8')

describe('hero', () => {
  it('names the call to action with the title it leads to', () => {
    const code = source()
    expect(code).toMatch(/More info<span className="sr-only"> about \{card\.title\}<\/span>/)
  })

  it('keeps the visible words at the start of the accessible name', () => {
    // WCAG 2.5.3: a speech-input user saying "more info" must still match the control,
    // so the title is appended to the visible label rather than replacing it.
    const code = source()
    expect(code).not.toContain('aria-label')
  })
})
