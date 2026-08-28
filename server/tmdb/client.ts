import 'server-only'

const BASE_URL = 'https://api.themoviedb.org/3'

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

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    next: { revalidate: options.revalidate, tags: options.tags },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { status_message?: string } | null
    throw new TmdbError(response.status, body?.status_message ?? `TMDB request failed: ${path}`)
  }

  return response.json() as Promise<T>
}
