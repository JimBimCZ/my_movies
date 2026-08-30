import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const home = () => readFileSync('app/page.tsx', 'utf8')

describe('home page rows', () => {
  it('renders an upcoming row from the upcoming endpoint', () => {
    const code = home()
    expect(code).toContain('getUpcoming')
    expect(code).toMatch(/<Row\s+title="Upcoming"/)
  })

  it('gives the upcoming row its own boundary and a matching skeleton title', () => {
    const code = home()
    expect(code).toMatch(/<Suspense fallback=\{<RowSkeleton title="Upcoming" \/>\}>\s*<UpcomingRow \/>/)
  })

  it('places upcoming between now playing and top rated', () => {
    const code = home()
    const order = ['<NowPlayingRow />', '<UpcomingRow />', '<TopRatedRow />'].map((tag) =>
      code.indexOf(tag),
    )
    expect(order.every((index) => index !== -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})
