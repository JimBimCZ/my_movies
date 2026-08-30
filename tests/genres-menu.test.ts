import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const menu = () => readFileSync('components/genres-menu.tsx', 'utf8')

describe('genres menu', () => {
  it('never imports from server/, which server-only would turn into a build error', () => {
    expect(menu()).not.toContain("from '@/server/")
  })

  it('opens on hover and on click, not on hover alone', () => {
    // A hover-only menu is unreachable by keyboard and unusable on touch. Anchored
    // to onPointerEnter specifically: pointerType === 'mouse' also occurs under
    // onPointerLeave, so a file-wide match would not catch onPointerEnter reverting
    // to an ungated handler, which reintroduces the touch first-tap bug.
    const code = menu()
    expect(code).toMatch(/onPointerEnter=\{\(event\) =>[\s\S]{0,80}pointerType === 'mouse'/)
    expect(code).toMatch(/aria-expanded=\{open\}[\s\S]{0,200}onClick/)
  })

  it('announces its state to assistive technology', () => {
    const code = menu()
    expect(code).toContain('aria-expanded')
    expect(code).toContain('aria-controls')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    const code = menu()
    expect(code).toContain("'Escape'")
    expect(code).toMatch(/triggerRef\.current\?\.focus\(\)/)
  })

  it('closes when focus leaves the menu entirely', () => {
    // Anchored on the leading `!`: without it, moving focus outside the menu
    // would open it instead of closing it.
    expect(menu()).toMatch(/!event\.currentTarget\.contains\(event\.relatedTarget\)/)
  })

  it('hides the panel from the tree when closed, rather than only visually', () => {
    expect(menu()).toMatch(/hidden=\{!open\}/)
  })

  it('scrolls rather than growing past the viewport', () => {
    const code = menu()
    expect(code).toContain('overflow-y-auto')
    expect(code).toMatch(/max-h-/)
  })

  it('links each genre to its own page', () => {
    expect(menu()).toMatch(/href=\{`\/genre\/\$\{genre\.slug\}`\}/)
  })
})
