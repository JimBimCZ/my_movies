import 'server-only'

const BASE_URL = 'https://api.themoviedb.org/3'

// TMDB documents no Retry-After units or backoff advice, only "respect the 429
// if you receive one" (verified against the live rate-limiting page, 2026-08-28).
// These numbers are our own policy, not TMDB's:
// - RETRY_CEILING_MS bounds the worst case wait so a hostile or mistaken
//   Retry-After can never stall a page render or build for long.
// - MAX_FETCH_ATTEMPTS(3) = 1 initial call + 2 retries, worst case
//   2 * RETRY_CEILING_MS = 10s before giving up.
// - RETRY_FALLBACK_MS is used when Retry-After is absent or unparseable.
const RETRY_CEILING_MS = 5_000
const RETRY_FALLBACK_MS = 1_000
const MAX_FETCH_ATTEMPTS = 3

export interface TmdbFetchOptions {
  searchParams?: Record<string, string | number | undefined>
  revalidate?: number
  tags?: string[]
}

export class TmdbError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'TmdbError'
    this.status = status
  }
}

function clampMs(ms: number): number {
  return Math.min(Math.max(ms, 0), RETRY_CEILING_MS)
}

function retryDelayMs(retryAfter: string | null): number {
  if (retryAfter === null) {
    return RETRY_FALLBACK_MS
  }

  const trimmed = retryAfter.trim()
  if (/^\d+$/.test(trimmed)) {
    return clampMs(Number(trimmed) * 1000)
  }

  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    return clampMs(dateMs - Date.now())
  }

  return RETRY_FALLBACK_MS
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function tmdbFetch<T>(path: string, options: TmdbFetchOptions = {}): Promise<T> {
  const token = process.env.TMDB_ACCESS_TOKEN
  if (!token) {
    throw new Error('TMDB_ACCESS_TOKEN is not set')
  }

  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  const init: RequestInit = {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    next: { revalidate: options.revalidate, tags: options.tags },
  }

  let response = await fetch(url.toString(), init)

  for (let attempt = 1; response.status === 429 && attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    await delay(retryDelayMs(response.headers.get('retry-after')))
    response = await fetch(url.toString(), init)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { status_message?: string } | null
    throw new TmdbError(response.status, body?.status_message ?? `TMDB request failed: ${path}`)
  }

  return response.json() as Promise<T>
}
