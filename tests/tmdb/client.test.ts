import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

describe('tmdbFetch', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the token as a bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/lib/tmdb/client')

    await tmdbFetch('/movie/27205')

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers.accept).toBe('application/json')
  })

  it('builds the url against the v3 base and appends search params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/lib/tmdb/client')

    await tmdbFetch('/discover/movie', { searchParams: { with_genres: 28, page: 1 } })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.themoviedb.org/3/discover/movie?with_genres=28&page=1')
  })

  it('omits undefined search params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/lib/tmdb/client')

    await tmdbFetch('/search/multi', { searchParams: { query: 'matrix', page: undefined } })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.themoviedb.org/3/search/multi?query=matrix')
  })

  it('passes revalidate and tags through to the fetch cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/lib/tmdb/client')

    await tmdbFetch('/trending/all/week', { revalidate: 3600, tags: ['tmdb:trending'] })

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.next).toEqual({ revalidate: 3600, tags: ['tmdb:trending'] })
  })

  it('throws TmdbError on a non-ok response rather than returning a partial body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status_message: 'Not found' }), { status: 404 }),
    ))
    const { tmdbFetch, TmdbError } = await import('@/lib/tmdb/client')

    await expect(tmdbFetch('/movie/0')).rejects.toBeInstanceOf(TmdbError)
    await expect(tmdbFetch('/movie/0')).rejects.toMatchObject({ status: 404 })
  })

  it('throws when the token is missing', async () => {
    delete process.env.TMDB_ACCESS_TOKEN
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({})))
    const { tmdbFetch } = await import('@/lib/tmdb/client')

    await expect(tmdbFetch('/configuration')).rejects.toThrow(/TMDB_ACCESS_TOKEN/)
  })
})
