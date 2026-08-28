import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8'))

const respondWith = (body: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
  )

describe('list endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('getTrending requests the week window and tags the result', async () => {
    const fetchMock = respondWith(fixture('trending'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTrending } = await import('@/lib/tmdb/endpoints/lists')

    const results = await getTrending()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/trending/all/week')
    expect(init.next.tags).toContain('tmdb:trending')
    expect(results.length).toBeGreaterThan(0)
    expect(['movie', 'tv']).toContain(results[0]!.media_type)
  })

  it('getNowPlaying returns movie items tagged as a list', async () => {
    const fetchMock = respondWith(fixture('now-playing'))
    vi.stubGlobal('fetch', fetchMock)
    const { getNowPlaying } = await import('@/lib/tmdb/endpoints/lists')

    const results = await getNowPlaying()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/movie/now_playing')
    expect(init.next.tags).toContain('tmdb:list:now-playing')
    expect(results[0]).toHaveProperty('title')
  })

  it('getTopRated and getAiringToday tag their own lists', async () => {
    const fetchMock = respondWith(fixture('top-rated'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTopRated } = await import('@/lib/tmdb/endpoints/lists')
    await getTopRated()
    expect(fetchMock.mock.calls[0]![1].next.tags).toContain('tmdb:list:top-rated')

    vi.resetModules()
    const airingMock = respondWith(fixture('airing-today'))
    vi.stubGlobal('fetch', airingMock)
    const { getAiringToday } = await import('@/lib/tmdb/endpoints/lists')
    const shows = await getAiringToday()
    expect(airingMock.mock.calls[0]![1].next.tags).toContain('tmdb:list:airing-today')
    expect(shows[0]).toHaveProperty('name')
  })

  it('getMovieGenres unwraps the genres envelope', async () => {
    const fetchMock = respondWith(fixture('genres-movie'))
    vi.stubGlobal('fetch', fetchMock)
    const { getMovieGenres } = await import('@/lib/tmdb/endpoints/lists')

    const genres = await getMovieGenres()

    expect(Array.isArray(genres)).toBe(true)
    expect(genres[0]).toHaveProperty('name')
    expect(fetchMock.mock.calls[0]![1].next.tags).toContain('tmdb:genres')
  })

  it('discoverByGenre passes the genre filter', async () => {
    const fetchMock = respondWith(fixture('discover-movie'))
    vi.stubGlobal('fetch', fetchMock)
    const { discoverByGenre } = await import('@/lib/tmdb/endpoints/lists')

    await discoverByGenre(28)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('with_genres=28')
  })
})

describe('title endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('getTitleDetail routes movie to the movie endpoint with a per-title tag', async () => {
    const fetchMock = respondWith(fixture('movie-detail'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTitleDetail } = await import('@/lib/tmdb/endpoints/titles')

    await getTitleDetail('movie', 27205)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/movie/27205')
    expect(init.next.tags).toContain('tmdb:title:movie:27205')
  })

  it('getTitleDetail routes tv to the tv endpoint', async () => {
    const fetchMock = respondWith(fixture('tv-detail'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTitleDetail } = await import('@/lib/tmdb/endpoints/titles')

    await getTitleDetail('tv', 1396)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('/tv/1396')
  })
})

describe('search', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('drops person results, keeping only movie and tv', async () => {
    const fetchMock = respondWith(fixture('search-multi'))
    vi.stubGlobal('fetch', fetchMock)
    const { searchMulti } = await import('@/lib/tmdb/endpoints/search')

    const results = await searchMulti('matrix')

    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(['movie', 'tv']).toContain(item.media_type)
    }
  })

  it('returns an empty array for a blank query without calling TMDB', async () => {
    const fetchMock = respondWith(fixture('search-multi'))
    vi.stubGlobal('fetch', fetchMock)
    const { searchMulti } = await import('@/lib/tmdb/endpoints/search')

    expect(await searchMulti('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
