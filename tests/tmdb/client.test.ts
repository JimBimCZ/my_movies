import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const rateLimited = (headers?: Record<string, string>) =>
  new Response(JSON.stringify({ status_message: 'Too Many Requests' }), { status: 429, headers })

describe('tmdbFetch', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sends the token as a bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await tmdbFetch('/movie/27205')

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers.accept).toBe('application/json')
  })

  it('builds the url against the v3 base and appends search params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await tmdbFetch('/discover/movie', { searchParams: { with_genres: 28, page: 1 } })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.themoviedb.org/3/discover/movie?with_genres=28&page=1')
  })

  it('omits undefined search params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await tmdbFetch('/search/multi', { searchParams: { query: 'matrix', page: undefined } })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.themoviedb.org/3/search/multi?query=matrix')
  })

  it('passes revalidate and tags through to the fetch cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await tmdbFetch('/trending/all/week', { revalidate: 3600, tags: ['tmdb:trending'] })

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.next).toEqual({ revalidate: 3600, tags: ['tmdb:trending'] })
  })

  it('throws TmdbError on a non-ok response rather than returning a partial body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status_message: 'Not found' }), { status: 404 }),
    ))
    const { tmdbFetch, TmdbError } = await import('@/server/tmdb/client')

    await expect(tmdbFetch('/movie/0')).rejects.toBeInstanceOf(TmdbError)
    await expect(tmdbFetch('/movie/0')).rejects.toMatchObject({ status: 404 })
  })

  it('throws when the token is missing', async () => {
    delete process.env.TMDB_ACCESS_TOKEN
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({})))
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await expect(tmdbFetch('/configuration')).rejects.toThrow(/TMDB_ACCESS_TOKEN/)
  })

  it('retries once on 429 and returns the following 200', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': '1' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.runAllTimersAsync()

    await expect(pending).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('exhausts retries on repeated 429s and throws TmdbError with status 429', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(rateLimited())
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch, TmdbError } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    pending.catch(() => {})
    await vi.runAllTimersAsync()

    await expect(pending).rejects.toBeInstanceOf(TmdbError)
    await expect(pending.catch((e: unknown) => e)).resolves.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('honours Retry-After given as delta-seconds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': '2' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('honours Retry-After given as an HTTP-date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T00:00:00Z'))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': 'Fri, 28 Aug 2026 00:00:03 GMT' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('falls back to a fixed delay when Retry-After is absent', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('falls back to a fixed delay when Retry-After is unparseable', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': 'not-a-value' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('clamps an out-of-range Retry-After to the ceiling', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': '999999' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(4999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status_message: 'Not found' }), { status: 404 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch, TmdbError } = await import('@/server/tmdb/client')

    await expect(tmdbFetch('/movie/0')).rejects.toBeInstanceOf(TmdbError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('carries the revalidate and tags options through a retry', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': '1' }))
      .mockResolvedValueOnce(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/trending/all/week', { revalidate: 3600, tags: ['tmdb:trending'] })
    await vi.runAllTimersAsync()
    await pending

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.next).toEqual({ revalidate: 3600, tags: ['tmdb:trending'] })
    }
  })
})
