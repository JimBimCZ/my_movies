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

  it('exhausts retries on repeated 429s and reports the last response body', async () => {
    vi.useFakeTimers()
    let call = 0
    // A fresh Response per call, not one shared instance: production hands each
    // attempt a separate body, and a shared one would let a message-extraction
    // regression pass.
    const fetchMock = vi.fn().mockImplementation(async () => {
      call += 1
      return new Response(JSON.stringify({ status_message: `Too Many Requests #${call}` }), {
        status: 429,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch, TmdbError } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    const rejection = expect(pending).rejects.toBeInstanceOf(TmdbError)
    await vi.runAllTimersAsync()
    await rejection

    await expect(pending).rejects.toMatchObject({
      status: 429,
      message: 'Too Many Requests #3',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('gives every retry its own signal so Next cannot serve it the memoised 429', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.runAllTimersAsync()
    await pending

    const [, first] = fetchMock.mock.calls[0]!
    const [, second] = fetchMock.mock.calls[1]!
    const [, third] = fetchMock.mock.calls[2]!
    expect(first.signal).toBeUndefined()
    expect(second.signal).toBeInstanceOf(AbortSignal)
    expect(third.signal).toBeInstanceOf(AbortSignal)
    expect(second.signal).not.toBe(third.signal)
    expect(second.signal.aborted).toBe(false)
  })

  it('draws the fallback delay afresh each time rather than a constant', async () => {
    vi.useFakeTimers()
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const { tmdbFetch } = await import('@/server/tmdb/client')

    for (let draw = 0; draw < 12; draw += 1) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(ok({ id: 1 })),
      )
      const pending = tmdbFetch('/movie/27205')
      await vi.runAllTimersAsync()
      await pending
    }

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms as number)
    expect(delays).toHaveLength(12)
    for (const ms of delays) {
      expect(ms).toBeGreaterThanOrEqual(750)
      expect(ms).toBeLessThanOrEqual(1250)
    }
    expect(new Set(delays).size).toBeGreaterThan(1)
    setTimeoutSpy.mockRestore()
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
      .mockResolvedValueOnce(rateLimited({ 'retry-after': 'Fri, 28 Aug 2026 00:00:01 GMT' }))
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

  it('clamps a past HTTP-date Retry-After to zero rather than a negative timeout', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': 'Mon, 01 Jan 2001 00:00:00 GMT' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    await expect(tmdbFetch('/movie/27205')).resolves.toEqual({ id: 1 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, delayMs] = setTimeoutSpy.mock.calls[0]!
    expect(delayMs).toBeGreaterThanOrEqual(0)
    setTimeoutSpy.mockRestore()
  })

  it('falls back to a jittered delay within +/-25% when Retry-After is absent', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(749)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(501)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(pending).resolves.toEqual({ id: 1 })
  })

  it('falls back to a jittered delay within +/-25% when Retry-After is unparseable', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ 'retry-after': 'not-a-value' }))
      .mockResolvedValueOnce(ok({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tmdbFetch } = await import('@/server/tmdb/client')

    const pending = tmdbFetch('/movie/27205')
    await vi.advanceTimersByTimeAsync(749)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(501)
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
    await vi.advanceTimersByTimeAsync(1999)
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
