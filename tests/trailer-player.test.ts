import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const player = () => readFileSync('components/trailer-player.tsx', 'utf8')
const page = () => readFileSync('app/title/[mediaType]/[id]/page.tsx', 'utf8')

describe('trailer player', () => {
  it('is a client component, because the play state is interaction', () => {
    expect(player()).toMatch(/^'use client'/)
  })

  it('never imports from server/, which server-only would turn into a build error', () => {
    expect(player()).not.toContain("from '@/server/")
  })

  it('mounts the iframe only after the play state is set', () => {
    const code = player()
    expect(code).toContain('useState')
    expect(code).toMatch(/playing \?|playing &&/)
  })

  it('embeds through the no-cookie host', () => {
    expect(player()).toContain('youtube-nocookie.com/embed/')
    expect(player()).not.toContain('www.youtube.com/embed/')
  })

  it('gives the iframe and the play button accessible names', () => {
    const code = player()
    expect(code).toMatch(/title=\{`\$\{title\} trailer`\}/)
    expect(code).toMatch(/Play trailer/)
  })
})

describe('title detail page trailer section', () => {
  it('renders the section only when a trailer was found', () => {
    const code = page()
    expect(code).toContain('pickTrailer(detail.videos.results)')
    expect(code).toMatch(/trailer &&/)
  })
})
