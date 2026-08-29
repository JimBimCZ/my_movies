import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const header = () => readFileSync('components/site-header.tsx', 'utf8')

describe('site header', () => {
  it('reads the session on the server', () => {
    expect(header()).toContain("from '@/server/auth/config'")
    expect(header()).toMatch(/await auth\(\)/)
  })

  it('is not a client component', () => {
    expect(header()).not.toMatch(/["']use client["']/)
  })

  it('offers sign-in when signed out and sign-out when signed in', () => {
    expect(header()).toContain('/signin')
    expect(header()).toContain('signOutAction')
  })

  it('links to the watchlist only when signed in', () => {
    expect(header()).toContain('href="/watchlist"')
    expect(header()).toMatch(/session \? \(\s*<Link\s+href="\/watchlist"/)
  })
})
