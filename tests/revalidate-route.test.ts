import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tags } from '@/server/tmdb/cache'

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag }))

const { POST } = await import('@/app/api/revalidate/route')

const SECRET = 'a-test-secret'

function post(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: secret === undefined ? undefined : { 'x-revalidate-secret': secret },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.REVALIDATE_SECRET = SECRET
})

afterEach(() => {
  delete process.env.REVALIDATE_SECRET
  vi.clearAllMocks()
})

describe('POST /api/revalidate', () => {
  it('refuses to revalidate when no secret is configured', async () => {
    delete process.env.REVALIDATE_SECRET

    const response = await POST(post({ tag: tags.trending }, SECRET))

    expect(response.status).toBe(503)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a request carrying no secret header', async () => {
    const response = await POST(post({ tag: tags.trending }))

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret of a different length without throwing', async () => {
    const response = await POST(post({ tag: tags.trending }, 'short'))

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret of the same length', async () => {
    const response = await POST(post({ tag: tags.trending }, 'b-test-secret'))

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a tag outside the allowlist', async () => {
    const response = await POST(post({ tag: 'tmdb:list:everything' }, SECRET))

    expect(response.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a body with no string tag', async () => {
    expect((await POST(post({}, SECRET))).status).toBe(400)
    expect((await POST(post({ tag: 7 }, SECRET))).status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('revalidates a known tag', async () => {
    const response = await POST(post({ tag: tags.detail('movie', 603) }, SECRET))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      tag: 'tmdb:title:movie:603',
    })
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith('tmdb:title:movie:603', 'max')
  })
})
