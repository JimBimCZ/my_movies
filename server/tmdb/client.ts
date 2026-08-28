import 'server-only'

const BASE_URL = 'https://api.themoviedb.org/3'

// TMDB documents no Retry-After units or backoff advice, only "respect the 429
// if you receive one" (verified against the live rate-limiting page, 2026-08-28).
// These numbers are our own policy, not TMDB's:
// - RETRY_CEILING_MS bounds the worst case wait. It only binds when a Retry-After
//   header is present and larger than this: TMDB documents sending no header at
//   all, and its rate-limit window is roughly a second at ~40 req/s, so a longer
//   ceiling cannot make a real window recover any faster — it would just hold a
//   render open longer. Kept tight as a safety net against a hostile or mistaken
//   header, not as a limit we expect legitimate traffic to hit.
// - MAX_FETCH_ATTEMPTS(3) = 1 initial call + 2 retries, worst case
//   2 * RETRY_CEILING_MS = 4s before giving up.
// - RETRY_FALLBACK_MS is used when Retry-After is absent or unparseable — the
//   normal case, since TMDB sends no header at all. RETRY_FALLBACK_JITTER_RATIO
//   spreads it +/-25% so concurrent requests that all hit a 429 together don't
//   all retry on the same tick and resynchronise into another burst against the
//   limit we're trying to respect.
const RETRY_CEILING_MS = 2_000
const RETRY_FALLBACK_MS = 1_000
const RETRY_FALLBACK_JITTER_RATIO = 0.25
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

function jitteredFallbackMs(): number {
  const spread = RETRY_FALLBACK_MS * RETRY_FALLBACK_JITTER_RATIO
  return clampMs(RETRY_FALLBACK_MS + (Math.random() * 2 - 1) * spread)
}

function retryDelayMs(retryAfter: string | null): number {
  if (retryAfter === null) {
    return jitteredFallbackMs()
  }

  const trimmed = retryAfter.trim()
  if (/^\d+$/.test(trimmed)) {
    return clampMs(Number(trimmed) * 1000)
  }

  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    return clampMs(dateMs - Date.now())
  }

  return jitteredFallbackMs()
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
    await response.body?.cancel()
    await delay(retryDelayMs(response.headers.get('retry-after')))
    response = await fetch(url.toString(), init)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { status_message?: string } | null
    throw new TmdbError(response.status, body?.status_message ?? `TMDB request failed: ${path}`)
  }

  return response.json() as Promise<T>
}
