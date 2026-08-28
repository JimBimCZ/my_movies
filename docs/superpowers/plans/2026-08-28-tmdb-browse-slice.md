# TMDB Browse Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TMDB read path — home with mixed movie/TV rows, title detail, search — together with the deployment substrate (`db/client.ts`, `/api/health`, a Docker image that has been built and run).

**Architecture:** All TMDB access funnels through `lib/tmdb/`, which is server-only; response types are derived from captured real payloads, never guessed. Pages are server components, with `'use client'` confined to the search input and the row scroll controls. `db/client.ts` selects a Drizzle driver once at module load — `neon-http` on Vercel, `node-postgres` in a container — and exports one instance whose type does not vary.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind CSS, Drizzle ORM + Drizzle Kit, `@neondatabase/serverless`, `pg`, Vitest, Docker.

**Spec:** `docs/superpowers/specs/2026-08-28-tmdb-browse-slice-design.md`

## Global Constraints

- Node 24. pnpm 11.24.0 (verified installed). Docker 29.6.2 (verified installed).
- `next.config.ts` sets `output: 'standalone'`.
- `TMDB_ACCESS_TOKEN` is server-only. No `NEXT_PUBLIC_` prefix, no TMDB fetch from a client component, ever.
- Every TMDB request goes through `lib/tmdb/`. No `fetch('https://api.themoviedb.org/...')` anywhere else.
- Every endpoint wrapper has an explicit response type derived from a captured payload in `tests/fixtures/tmdb/`.
- TMDB image base URL is `https://image.tmdb.org/t/p/` — verified against `/configuration` on 2026-08-28, HTTP 200.
  Verified `poster_sizes`: `w92, w154, w185, w342, w500, w780, original`.
  Verified `backdrop_sizes`: `w300, w780, w1280, original`.
  These are read at runtime from `/configuration` regardless; the values above are for writing correct tests.
- `DB_DRIVER` accepts `neon-http` or `node-postgres`. Unset defaults to `neon-http` when `process.env.VERCEL` is set, `node-postgres` otherwise.
- No comments that restate what the code does. No JSDoc where the signature suffices. No commented-out code, no leftover TODOs.
- Server components by default. `'use client'` only where interactivity requires it.
- Every interactive element keyboard-reachable with an accessible name. Posters carry `alt` = title.
- Loading states are skeletons matching final layout, never spinners.
- No test makes a network call. Tests read fixtures from disk.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` must pass before any task is considered complete.
- Commit and push to `origin main` at the end of each task.

---

### Task 1: Scaffold the project and toolchain

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `pnpm build | lint | typecheck | test` cycle. The `@/*` import alias resolves to the repository root.

- [ ] **Step 1: Scaffold Next.js into the existing directory**

The directory already contains `CLAUDE.md`, `LICENSE`, `.gitignore`, and `docs/`. `create-next-app` must not clobber them.

```bash
pnpm create next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-pnpm
```

If it refuses because the directory is non-empty, scaffold into a temp directory and copy in:

```bash
pnpm create next-app@latest /tmp/scaffold --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-pnpm
rsync -a --exclude '.git' --exclude 'README.md' /tmp/scaffold/ .
```

Do not accept a generated `.gitignore` that replaces the existing one — the existing one already covers `.env*.local` and must survive. Verify after scaffolding:

```bash
grep -n 'env\*\.local' .gitignore
```

- [ ] **Step 2: Set standalone output and the TMDB image host**

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' }],
  },
}

export default nextConfig
```

- [ ] **Step 3: Turn on TypeScript strict mode**

In `tsconfig.json`, ensure `compilerOptions.strict` is `true` and add `"noUncheckedIndexedAccess": true`.

- [ ] **Step 4: Install Vitest and the data-layer dependencies**

```bash
pnpm add drizzle-orm @neondatabase/serverless pg server-only
pnpm add -D vitest @types/pg drizzle-kit
```

- [ ] **Step 5: Configure Vitest**

Create `tests/stubs/server-only.ts` containing exactly:

```ts
export {}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The server-only package resolves to a module that throws unless the
      // react-server export condition is active, which it is not under vitest.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
```

Do not drop the `server-only` alias. `lib/tmdb/client.ts` (Task 3) imports `server-only` to make a client-component import a build error; without this alias every test that imports the TMDB client fails at import time.

- [ ] **Step 6: Add the scripts CLAUDE.md documents**

In `package.json`, the `scripts` block must contain exactly these keys (alongside the generated `dev`/`build`/`start`/`lint`):

```json
{
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 7: Write the failing scaffold test**

`tests/scaffold.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('configures standalone output and the TMDB image host', async () => {
    const { default: config } = await import('../next.config')
    expect(config.output).toBe('standalone')
    expect(config.images?.remotePatterns).toContainEqual(
      expect.objectContaining({ hostname: 'image.tmdb.org' }),
    )
  })

  it('keeps env files out of git', () => {
    expect(readFileSync('.gitignore', 'utf8')).toContain('.env*.local')
  })
})
```

The first test imports the config and asserts on parsed values rather than grepping the source text, so it cannot pass on a commented-out line or fail on a requote. The second deliberately does assert on file text: for `.gitignore` the text *is* the behaviour, and it guards a real regression.

- [ ] **Step 8: Run the test**

Run: `pnpm test`
Expected: PASS, 2 tests.

- [ ] **Step 9: Write .env.example**

Names only, no values. This file IS committed.

```
TMDB_ACCESS_TOKEN=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
DB_DRIVER=
AUTH_SECRET=
AUTH_URL=
```

- [ ] **Step 10: Run the full gate**

Run: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
Expected: all four pass. Paste the output.

- [ ] **Step 11: Commit and push**

```bash
git add -A
git commit -m "Scaffold Next.js app with standalone output and Vitest"
git push origin main
```

---

### Task 2: Capture TMDB fixtures and derive response types

**Files:**
- Create: `scripts/capture-tmdb-fixtures.sh`, `tests/fixtures/tmdb/*.json`, `lib/tmdb/types.ts`
- Test: `tests/tmdb/types.test.ts`

**Interfaces:**
- Consumes: `TMDB_ACCESS_TOKEN` from `.env.local`.
- Produces: `MediaType`, `MovieListItem`, `TvListItem`, `TrendingItem`, `PagedResponse<T>`, `MovieDetail`, `TvDetail`, `Genre`, `SearchResultItem`, `TmdbConfiguration` from `@/lib/tmdb/types`.

**This task must complete before any other type is written.** TMDB's field names and pagination differ between endpoints and between v3 and v4; a type generalised from a neighbouring endpoint is probably wrong.

- [ ] **Step 1: Write the capture script**

`scripts/capture-tmdb-fixtures.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

set -a; . ./.env.local; set +a
OUT=tests/fixtures/tmdb
mkdir -p "$OUT"

trap 'rm -f "${OUT}"/*.json.tmp' EXIT

fetch() {
  local name="$1"
  local path="$2"
  local tmp="${OUT}/${name}.json.tmp"
  if ! curl -sS --fail-with-body \
    -H "Authorization: Bearer ${TMDB_ACCESS_TOKEN}" \
    -H "accept: application/json" \
    "https://api.themoviedb.org/3${path}" > "$tmp"; then
    echo "failed to capture ${name}; ${OUT}/${name}.json left unchanged" >&2
    return 1
  fi
  mv "$tmp" "${OUT}/${name}.json"
  echo "captured ${name}"
}

fetch configuration   "/configuration"
fetch trending        "/trending/all/week"
fetch now-playing     "/movie/now_playing"
fetch top-rated       "/movie/top_rated"
fetch airing-today    "/tv/airing_today"
fetch genres-movie    "/genre/movie/list"
fetch discover-movie  "/discover/movie?with_genres=28"
fetch movie-detail    "/movie/27205"
fetch tv-detail       "/tv/1396"
fetch search-multi    "/search/multi?query=matrix"
```

`27205` is Inception, `1396` is Breaking Bad — stable long-lived ids.

The temp file matters: a bare `>` truncates the target before curl runs, so a 429 or an
expired token on a re-run replaces a known-good committed fixture with TMDB's error body.
These fixtures are the payload authority for Tasks 3 and 5; a corrupted one is worse than
a failed run.

Write it as an explicit `if !`, not as `curl > tmp && mv`. A command on the left of `&&`
is exempt from `set -e`, so the one-liner short-circuits the `mv`, falls through to the
success `echo`, and exits 0 — protecting the fixture while silently swallowing the
failure, which is worse than the loud abort it replaced. Verified: under
`set -euo pipefail`, `false && echo` leaves the script exiting 0.

The two `local` declarations are separate statements because bash 3.2, still the macOS
default, cannot reference an earlier `local` from the same statement under `set -u`.

- [ ] **Step 2: Run it**

```bash
chmod +x scripts/capture-tmdb-fixtures.sh && ./scripts/capture-tmdb-fixtures.sh
```

Expected: ten "captured" lines. Any non-2xx aborts the script.

- [ ] **Step 3: Inspect the captured shapes before writing a single type**

```bash
for f in tests/fixtures/tmdb/*.json; do
  echo "=== $f ==="
  python3 -c "
import json,sys
d=json.load(open('$f'))
if isinstance(d,dict) and 'results' in d:
    print('envelope:', [k for k in d if k!='results'])
    print('item keys:', sorted(d['results'][0].keys()))
else:
    print('keys:', sorted(d.keys()))
"
done
```

Read this output. Write the types in Step 4 from what it actually prints — in particular check whether `trending` items carry a `media_type` discriminator that the single-type list endpoints lack, and whether the detail endpoints are the list item plus fields or a different shape entirely.

- [ ] **Step 4: Write lib/tmdb/types.ts**

Write it against the Step 3 output. The skeleton below is the required *structure*; field lists must match the captured payloads, adding or removing fields as the real data dictates.

```ts
export type MediaType = 'movie' | 'tv'

export interface PagedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface MovieListItem {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  genre_ids: number[]
}

export interface TvListItem {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  genre_ids: number[]
}

export type TrendingItem =
  | (MovieListItem & { media_type: 'movie' })
  | (TvListItem & { media_type: 'tv' })

export type SearchResultItem = TrendingItem | { media_type: 'person'; id: number; name: string }

export interface Genre {
  id: number
  name: string
}

export interface TmdbConfiguration {
  images: {
    secure_base_url: string
    poster_sizes: string[]
    backdrop_sizes: string[]
  }
}
```

`MovieDetail` and `TvDetail` are written in this same file, from the captured `movie-detail.json` and `tv-detail.json`. Include at minimum the fields the detail page renders: id, title/name, overview, poster_path, backdrop_path, release_date/first_air_date, vote_average, runtime (movie) or number_of_seasons (tv), and `genres: Genre[]`. Do not copy the list-item shape — confirm each field against the fixture.

- [ ] **Step 5: Write the test that pins types to fixtures**

`tests/tmdb/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PagedResponse, TrendingItem, TmdbConfiguration } from '@/lib/tmdb/types'

const load = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8'))

describe('captured TMDB payloads', () => {
  it('configuration exposes an image base url and poster sizes', () => {
    const config = load('configuration') as TmdbConfiguration
    expect(config.images.secure_base_url).toBe('https://image.tmdb.org/t/p/')
    expect(config.images.poster_sizes).toContain('w342')
  })

  it('trending items carry a media_type discriminator', () => {
    const page = load('trending') as PagedResponse<TrendingItem>
    expect(page.results.length).toBeGreaterThan(0)
    for (const item of page.results) {
      expect(['movie', 'tv']).toContain(item.media_type)
    }
  })

  it('now_playing items do not carry media_type', () => {
    const page = load('now-playing') as PagedResponse<Record<string, unknown>>
    expect(page.results[0]).not.toHaveProperty('media_type')
    expect(page.results[0]).toHaveProperty('title')
  })

  it('airing_today items use name rather than title', () => {
    const page = load('airing-today') as PagedResponse<Record<string, unknown>>
    expect(page.results[0]).toHaveProperty('name')
    expect(page.results[0]).not.toHaveProperty('title')
  })
})
```

Any array of expected field names in this test must be bound to the interface it
describes, not left as an inferred `string[]`. An untyped array pins fixture against
hand-copied literals with no compile-time link to `types.ts`, so renaming or deleting a
field there passes the whole gate silently. This file is imported by nine downstream
tasks; the link is worth having.

Use a `Record<keyof T, true>` witness rather than an `Array<keyof T>` annotation. The
annotation catches renames and deletions but not additions, so it needs a second
construct for exhaustiveness; one witness object catches all three. Prove it: delete,
rename, and add a field in turn and confirm `pnpm typecheck` fails each time.

- [ ] **Step 6: Run the tests**

Run: `pnpm test`
Expected: PASS. **If the third or fourth test fails, the real payload differs from the assumption — fix `types.ts` to match the fixture, never the other way round.** Report the discrepancy.

- [ ] **Step 7: Commit and push**

Fixtures are committed; they contain no credentials. Confirm before staging:

```bash
grep -rl "$(printf 'Bearer')" tests/fixtures/ || echo "no tokens in fixtures"
git add -A
git commit -m "Capture TMDB fixtures and derive response types from them"
git push origin main
```

---

### Task 3: The TMDB fetch client

**Files:**
- Create: `lib/tmdb/client.ts`
- Test: `tests/tmdb/client.test.ts`

**Interfaces:**
- Consumes: `TMDB_ACCESS_TOKEN`.
- Produces: `tmdbFetch<T>(path: string, options?: TmdbFetchOptions): Promise<T>` and `class TmdbError extends Error { status: number }` from `@/lib/tmdb/client`.
  `TmdbFetchOptions = { searchParams?: Record<string, string | number | undefined>; revalidate?: number; tags?: string[] }`

- [ ] **Step 1: Write the failing tests**

`tests/tmdb/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test tests/tmdb/client.test.ts`
Expected: FAIL — cannot resolve `@/lib/tmdb/client`.

- [ ] **Step 3: Implement the client**

`lib/tmdb/client.ts`:

```ts
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
```

Note: the URL assertions in the tests expect the params in insertion order. `URLSearchParams` preserves it, so `with_genres=28&page=1` is correct.

`server-only` will make this module unimportable from a client component — that is the point, and it is why the tests import it dynamically inside a node environment.

- [ ] **Step 4: Run the tests**

Run: `pnpm test tests/tmdb/client.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add server-only TMDB fetch client with typed error handling"
git push origin main
```

---

### Task 4: Image URL construction

**Files:**
- Create: `lib/tmdb/images.ts`
- Test: `tests/tmdb/images.test.ts`

**Interfaces:**
- Consumes: `tmdbFetch` from Task 3, `TmdbConfiguration` from Task 2.
- Produces: `getImageConfig(): Promise<TmdbConfiguration['images']>`, `buildImageUrl(base: string, size: string, path: string | null): string | null`, `pickSize(available: string[], target: number): string`, and `POSTER_SLOTS` / `BACKDROP_SLOTS` from `@/lib/tmdb/images`.

Sizes are read from `/configuration` at runtime, never hardcoded. `pickSize` selects the smallest available width at or above the slot's target, falling back to the largest non-`original` size when nothing is big enough.

- [ ] **Step 1: Write the failing tests**

`tests/tmdb/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildImageUrl, pickSize } from '@/lib/tmdb/images'

const POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']
const BASE = 'https://image.tmdb.org/t/p/'

describe('pickSize', () => {
  it('picks the smallest size at or above the target', () => {
    expect(pickSize(POSTER_SIZES, 342)).toBe('w342')
    expect(pickSize(POSTER_SIZES, 200)).toBe('w342')
    expect(pickSize(POSTER_SIZES, 92)).toBe('w92')
  })

  it('falls back to the largest concrete size when the target exceeds all of them', () => {
    expect(pickSize(POSTER_SIZES, 5000)).toBe('w780')
  })

  it('ignores the original entry when a concrete width fits', () => {
    expect(pickSize(POSTER_SIZES, 500)).toBe('w500')
  })
})

describe('buildImageUrl', () => {
  it('joins base, size and path', () => {
    expect(buildImageUrl(BASE, 'w342', '/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg')
  })

  it('returns null for a missing poster path', () => {
    expect(buildImageUrl(BASE, 'w342', null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test tests/tmdb/images.test.ts`
Expected: FAIL — cannot resolve `@/lib/tmdb/images`.

- [ ] **Step 3: Implement**

`lib/tmdb/images.ts`:

```ts
import { tmdbFetch } from './client'
import type { TmdbConfiguration } from './types'

export const POSTER_SLOTS = { card: 342, detail: 500 } as const
export const BACKDROP_SLOTS = { hero: 1280 } as const

export function pickSize(available: string[], target: number): string {
  const widths = available
    .filter((size) => size.startsWith('w'))
    .map((size) => ({ size, width: Number(size.slice(1)) }))
    .sort((a, b) => a.width - b.width)

  const fit = widths.find((candidate) => candidate.width >= target) ?? widths[widths.length - 1]
  return fit?.size ?? 'original'
}

export function buildImageUrl(base: string, size: string, path: string | null): string | null {
  return path ? `${base}${size}${path}` : null
}

export async function getImageConfig(): Promise<TmdbConfiguration['images']> {
  const config = await tmdbFetch<TmdbConfiguration>('/configuration', {
    revalidate: 60 * 60 * 24,
    tags: ['tmdb:configuration'],
  })
  return config.images
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test tests/tmdb/images.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add TMDB image URL construction driven by /configuration"
git push origin main
```

---

### Task 5: Endpoint wrappers and cache policy

**Files:**
- Create: `lib/tmdb/cache.ts`, `lib/tmdb/endpoints/lists.ts`, `lib/tmdb/endpoints/titles.ts`, `lib/tmdb/endpoints/search.ts`
- Test: `tests/tmdb/endpoints.test.ts`

**Interfaces:**
- Consumes: `tmdbFetch` (Task 3), all types (Task 2).
- Produces, from `@/lib/tmdb/endpoints/lists`: `getTrending()`, `getNowPlaying()`, `getTopRated()`, `getAiringToday()`, `getMovieGenres()`, `discoverByGenre(genreId: number)`.
  From `@/lib/tmdb/endpoints/titles`: `getMovieDetail(id: number)`, `getTvDetail(id: number)`, `getTitleDetail(mediaType: MediaType, id: number)`.
  From `@/lib/tmdb/endpoints/search`: `searchMulti(query: string)`.
  From `@/lib/tmdb/cache`: `REVALIDATE` and `tags`.

**Before writing `cache.ts`, read TMDB's current published rate-limit and caching guidance.** Do not assume a specific limit — CLAUDE.md forbids it. Record what the docs actually say in the commit message. The windows below are starting values to adjust against what you read.

- [ ] **Step 1: Write the cache policy**

`lib/tmdb/cache.ts`:

```ts
export const REVALIDATE = {
  configuration: 60 * 60 * 24,
  genres: 60 * 60 * 24,
  trending: 60 * 60,
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 5,
} as const

export const tags = {
  configuration: 'tmdb:configuration',
  genres: 'tmdb:genres',
  trending: 'tmdb:trending',
  list: (name: string) => `tmdb:list:${name}`,
  detail: (mediaType: string, id: number) => `tmdb:title:${mediaType}:${id}`,
  search: 'tmdb:search',
} as const
```

- [ ] **Step 2: Write the failing tests**

`tests/tmdb/endpoints.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm test tests/tmdb/endpoints.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the list endpoints**

`lib/tmdb/endpoints/lists.ts`:

```ts
import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { Genre, MovieListItem, PagedResponse, TrendingItem, TvListItem } from '../types'

export async function getTrending(): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<TrendingItem>>('/trending/all/week', {
    revalidate: REVALIDATE.trending,
    tags: [tags.trending],
  })
  return page.results
}

export async function getNowPlaying(): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/now_playing', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('now-playing')],
  })
  return page.results
}

export async function getTopRated(): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/movie/top_rated', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('top-rated')],
  })
  return page.results
}

export async function getAiringToday(): Promise<TvListItem[]> {
  const page = await tmdbFetch<PagedResponse<TvListItem>>('/tv/airing_today', {
    revalidate: REVALIDATE.list,
    tags: [tags.list('airing-today')],
  })
  return page.results
}

export async function getMovieGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<{ genres: Genre[] }>('/genre/movie/list', {
    revalidate: REVALIDATE.genres,
    tags: [tags.genres],
  })
  return response.genres
}

export async function discoverByGenre(genreId: number): Promise<MovieListItem[]> {
  const page = await tmdbFetch<PagedResponse<MovieListItem>>('/discover/movie', {
    searchParams: { with_genres: genreId, sort_by: 'popularity.desc' },
    revalidate: REVALIDATE.list,
    tags: [tags.list(`genre-${genreId}`)],
  })
  return page.results
}
```

- [ ] **Step 5: Implement the title endpoints**

`lib/tmdb/endpoints/titles.ts`:

```ts
import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { MediaType, MovieDetail, TvDetail } from '../types'

export function getMovieDetail(id: number): Promise<MovieDetail> {
  return tmdbFetch<MovieDetail>(`/movie/${id}`, {
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('movie', id)],
  })
}

export function getTvDetail(id: number): Promise<TvDetail> {
  return tmdbFetch<TvDetail>(`/tv/${id}`, {
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('tv', id)],
  })
}

export function getTitleDetail(mediaType: MediaType, id: number): Promise<MovieDetail | TvDetail> {
  return mediaType === 'movie' ? getMovieDetail(id) : getTvDetail(id)
}
```

- [ ] **Step 6: Implement search**

`lib/tmdb/endpoints/search.ts`:

```ts
import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { PagedResponse, SearchResultItem, TrendingItem } from '../types'

export async function searchMulti(query: string): Promise<TrendingItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const page = await tmdbFetch<PagedResponse<SearchResultItem>>('/search/multi', {
    searchParams: { query: trimmed },
    revalidate: REVALIDATE.search,
    tags: [tags.search],
  })

  return page.results.filter(
    (item): item is TrendingItem => item.media_type === 'movie' || item.media_type === 'tv',
  )
}
```

- [ ] **Step 7: Fold images.ts onto the shared cache constants**

Task 4 hardcoded the configuration revalidation window and tag because `cache.ts` did not exist yet. Now it does, so remove the duplication — in `lib/tmdb/images.ts`:

```ts
import { REVALIDATE, tags } from './cache'

export async function getImageConfig(): Promise<TmdbConfiguration['images']> {
  const config = await tmdbFetch<TmdbConfiguration>('/configuration', {
    revalidate: REVALIDATE.configuration,
    tags: [tags.configuration],
  })
  return config.images
}
```

The image tests from Task 4 must still pass unchanged — they exercise `pickSize` and `buildImageUrl`, neither of which this touches.

- [ ] **Step 8: Run the tests**

Run: `pnpm test tests/tmdb/endpoints.test.ts tests/tmdb/images.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 9: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add TMDB endpoint wrappers with per-family cache tags"
git push origin main
```

---

### Task 6: Database client and health route

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `app/api/health/route.ts`
- Test: `tests/db/client.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`, `DB_DRIVER`, `VERCEL`.
- Produces: `db` from `@/db/client`, and `resolveDriver(env): 'neon-http' | 'node-postgres'` exported from the same module for testing.

- [ ] **Step 1: Write the failing driver-selection tests**

`tests/db/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveDriver } from '@/db/client'

describe('resolveDriver', () => {
  it('honours an explicit DB_DRIVER over runtime inference', () => {
    expect(resolveDriver({ DB_DRIVER: 'node-postgres', VERCEL: '1' })).toBe('node-postgres')
    expect(resolveDriver({ DB_DRIVER: 'neon-http' })).toBe('neon-http')
  })

  it('defaults to neon-http on Vercel', () => {
    expect(resolveDriver({ VERCEL: '1' })).toBe('neon-http')
  })

  it('defaults to node-postgres off Vercel', () => {
    expect(resolveDriver({})).toBe('node-postgres')
  })

  it('rejects an unrecognised DB_DRIVER rather than silently guessing', () => {
    expect(() => resolveDriver({ DB_DRIVER: 'sqlite' })).toThrow(/DB_DRIVER/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/db/client.test.ts`
Expected: FAIL — cannot resolve `@/db/client`.

- [ ] **Step 3: Write the empty schema**

`db/schema.ts`:

```ts
export {}
```

The tables — Auth.js's `users`, `accounts`, `sessions`, and `watchlist_items` — are slice 2. This file exists so `db/client.ts` is typed against it from the start.

- [ ] **Step 4: Implement the client**

`db/client.ts`:

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type DriverName = 'neon-http' | 'node-postgres'

export function resolveDriver(env: Record<string, string | undefined>): DriverName {
  const explicit = env.DB_DRIVER
  if (explicit) {
    if (explicit !== 'neon-http' && explicit !== 'node-postgres') {
      throw new Error(`Unsupported DB_DRIVER: ${explicit}`)
    }
    return explicit
  }
  return env.VERCEL ? 'neon-http' : 'node-postgres'
}

function createDb(): NodePgDatabase<typeof schema> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  if (resolveDriver(process.env) === 'neon-http') {
    // Both drivers expose the same Drizzle query-builder surface; typing the export as the
    // node-postgres shape keeps a single type at every call site, which is what lets query
    // code stay driver-agnostic.
    return drizzleNeon(neon(url), { schema }) as unknown as NodePgDatabase<typeof schema>
  }

  return drizzlePg(new Pool({ connectionString: url }), { schema })
}

export const db = createDb()
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test tests/db/client.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
})
```

Do not run `db:generate` in this slice. There is no schema to migrate.

- [ ] **Step 7: Write the health route**

`app/api/health/route.ts`:

```ts
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 })
  }
}
```

The catch deliberately discards the error rather than returning it — a health endpoint is unauthenticated, and connection errors carry the database host and user.

- [ ] **Step 8: Verify against a real database**

Start a Postgres and point the app at it:

```bash
docker run -d --name movies-pg -e POSTGRES_PASSWORD=devpass -p 5433:5432 postgres:17
```

Add to `.env.local`:

```
DATABASE_URL=postgresql://postgres:devpass@localhost:5433/postgres
DB_DRIVER=node-postgres
```

Then:

```bash
pnpm dev &
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health
```

Expected: `200`. Then stop the database and confirm it degrades correctly:

```bash
docker stop movies-pg
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health
docker start movies-pg
```

Expected: `503`. Paste both codes. **A health route that has only ever been seen returning 200 is half-tested.**

- [ ] **Step 9: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add runtime-selected Drizzle client and database health route"
git push origin main
```

State plainly in the commit body that the `neon-http` branch is written but unverified until a Neon URL exists.

---

### Task 7: Layout, theme, and TMDB attribution

**Files:**
- Create: `app/globals.css` (modify), `app/layout.tsx` (modify), `components/site-footer.tsx`, `components/site-header.tsx`
- Test: `tests/attribution.test.ts`

**Interfaces:**
- Produces: `<SiteHeader />`, `<SiteFooter />` from `@/components/site-header` and `@/components/site-footer`.

**Before writing the footer, open TMDB's current terms of use and read the attribution requirement.** Use the wording it actually specifies. Do not write it from memory. Record the URL you read in the commit message.

- [ ] **Step 1: Set the dark base theme**

In `app/globals.css`, after the Tailwind import, set the page background and default text colour so the app is dark by default rather than relying on a system preference.

```css
:root {
  --background: #0b0b0f;
  --foreground: #f5f5f7;
  --muted: #9b9ba3;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 2: Write the footer with attribution**

`components/site-footer.tsx`. The logo is TMDB's official mark — download it from TMDB's branding page into `public/tmdb-logo.svg` as part of this step.

```tsx
import Image from 'next/image'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 px-6 py-8 text-sm text-[var(--muted)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <Image src="/tmdb-logo.svg" alt="The Movie Database" width={128} height={16} />
        <p>{/* exact wording from TMDB's terms of use — read it, do not recall it */}</p>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
    </footer>
  )
}
```

Replace the commented line with the attribution sentence the terms require, and delete the comment. The second paragraph is the not-endorsed statement; confirm its exact phrasing against the terms too.

- [ ] **Step 3: Write the header**

`components/site-header.tsx`:

```tsx
import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 py-4">
      <nav className="mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link href="/search" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Search
        </Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: Wire them into the root layout**

In `app/layout.tsx`, render `<SiteHeader />` above `{children}` and `<SiteFooter />` below, and set `metadata.title` to `My Movies`.

- [ ] **Step 5: Write the attribution test**

`tests/attribution.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('TMDB attribution', () => {
  it('states that the app is not endorsed or certified by TMDB', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toMatch(/not endorsed or certified by TMDB/)
  })

  it('renders the TMDB logo with an accessible name', () => {
    const footer = readFileSync('components/site-footer.tsx', 'utf8')
    expect(footer).toContain('/tmdb-logo.svg')
    expect(footer).toMatch(/alt="The Movie Database"/)
  })

  it('leaves no unresolved comment in the attribution copy', () => {
    expect(readFileSync('components/site-footer.tsx', 'utf8')).not.toContain('do not recall it')
  })
})
```

- [ ] **Step 6: Run and gate**

Run: `pnpm test tests/attribution.test.ts`
Expected: PASS, 3 tests. The third fails until Step 2's placeholder comment is genuinely replaced.

- [ ] **Step 7: Commit and push**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add dark layout shell and TMDB attribution footer"
git push origin main
```

---

### Task 8: Poster card and row carousel

**Files:**
- Create: `components/poster-card.tsx`, `components/row.tsx`, `components/row-scroller.tsx`, `components/row-skeleton.tsx`, `lib/media.ts`
- Test: `tests/media.test.ts`

**Interfaces:**
- Consumes: `buildImageUrl`, `pickSize`, `POSTER_SLOTS`, `getImageConfig` (Task 4); types (Task 2).
- Produces: `toCardItem(item: TrendingItem | MovieListItem | TvListItem, fallbackMediaType: MediaType): CardItem` from `@/lib/media`, where `CardItem = { id: number; title: string; posterPath: string | null; mediaType: MediaType }`; `<PosterCard />`, `<Row />`, `<RowSkeleton />`.

`toCardItem` is the single place the `title` / `name` divergence between movie and TV payloads is resolved. Every row and search result goes through it.

- [ ] **Step 1: Write the failing normaliser tests**

`tests/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toCardItem } from '@/lib/media'

describe('toCardItem', () => {
  it('reads title from a movie payload', () => {
    const card = toCardItem({ id: 1, title: 'Inception', poster_path: '/a.jpg' } as never, 'movie')
    expect(card).toEqual({ id: 1, title: 'Inception', posterPath: '/a.jpg', mediaType: 'movie' })
  })

  it('reads name from a tv payload', () => {
    const card = toCardItem({ id: 2, name: 'Breaking Bad', poster_path: '/b.jpg' } as never, 'tv')
    expect(card.title).toBe('Breaking Bad')
    expect(card.mediaType).toBe('tv')
  })

  it('prefers the payload media_type over the fallback argument', () => {
    const card = toCardItem(
      { id: 3, name: 'Show', poster_path: null, media_type: 'tv' } as never,
      'movie',
    )
    expect(card.mediaType).toBe('tv')
  })

  it('carries a null poster path through rather than inventing one', () => {
    const card = toCardItem({ id: 4, title: 'X', poster_path: null } as never, 'movie')
    expect(card.posterPath).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/media.test.ts`
Expected: FAIL — cannot resolve `@/lib/media`.

- [ ] **Step 3: Implement the normaliser**

`lib/media.ts`:

```ts
import type { MediaType, MovieListItem, TrendingItem, TvListItem } from './tmdb/types'

export interface CardItem {
  id: number
  title: string
  posterPath: string | null
  mediaType: MediaType
}

type AnyListItem = (TrendingItem | MovieListItem | TvListItem) & {
  title?: string
  name?: string
  media_type?: MediaType
}

export function toCardItem(item: AnyListItem, fallbackMediaType: MediaType): CardItem {
  return {
    id: item.id,
    title: item.title ?? item.name ?? 'Untitled',
    posterPath: item.poster_path,
    mediaType: item.media_type ?? fallbackMediaType,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test tests/media.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the poster card**

`components/poster-card.tsx` — a server component.

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { buildImageUrl, POSTER_SLOTS, pickSize } from '@/lib/tmdb/images'
import type { CardItem } from '@/lib/media'

interface PosterCardProps {
  item: CardItem
  imageBase: string
  posterSizes: string[]
  priority?: boolean
  variant?: 'row' | 'grid'
}

export function PosterCard({
  item,
  imageBase,
  posterSizes,
  priority = false,
  variant = 'row',
}: PosterCardProps) {
  const src = buildImageUrl(imageBase, pickSize(posterSizes, POSTER_SLOTS.card), item.posterPath)
  const sizing = variant === 'row' ? 'w-[160px] shrink-0 snap-start' : 'w-full'

  return (
    <Link
      href={`/title/${item.mediaType}/${item.id}`}
      className={`group block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${sizing}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/5">
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            sizes={variant === 'row' ? '160px' : '(max-width: 640px) 45vw, 180px'}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center p-2 text-center text-xs text-[var(--muted)]">
            {item.title}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)] group-hover:text-[var(--foreground)]">
        {item.title}
      </p>
    </Link>
  )
}
```

The link wraps the whole card, so its accessible name is the title text — no extra `aria-label` needed. When there is no poster, the title renders as text rather than an empty box.

- [ ] **Step 6: Write the client scroll controls**

`components/row-scroller.tsx`:

```tsx
'use client'

import { useRef, type ReactNode } from 'react'

export function RowScroller({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label={`Scroll ${label} left`}
        className="absolute left-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-r bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 md:block"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label={`Scroll ${label} right`}
        className="absolute right-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-l bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 md:block"
      >
        ›
      </button>
    </div>
  )
}
```

The arrows are an enhancement for pointer users. Keyboard users tab through the card links and the browser scrolls the track to follow focus — which is why the track is a plain scroll container and not a JS-driven widget. The arrows still take focus and carry a label naming their row.

- [ ] **Step 7: Write the row and its skeleton**

`components/row.tsx` — a server component:

```tsx
import { PosterCard } from './poster-card'
import { RowScroller } from './row-scroller'
import { getImageConfig } from '@/lib/tmdb/images'
import type { CardItem } from '@/lib/media'

export async function Row({ title, items }: { title: string; items: CardItem[] }) {
  if (items.length === 0) return null
  const images = await getImageConfig()

  return (
    <section className="mb-8" aria-labelledby={`row-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <h2
        id={`row-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="mb-3 px-6 text-lg font-semibold"
      >
        {title}
      </h2>
      <RowScroller label={title}>
        {items.map((item) => (
          <PosterCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            imageBase={images.secure_base_url}
            posterSizes={images.poster_sizes}
          />
        ))}
      </RowScroller>
    </section>
  )
}
```

`components/row-skeleton.tsx`:

```tsx
export function RowSkeleton({ title }: { title: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-6 text-lg font-semibold">{title}</h2>
      <div className="flex gap-3 overflow-hidden px-6 pb-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="w-[160px] shrink-0">
            <div className="aspect-[2/3] animate-pulse rounded-md bg-white/5" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </section>
  )
}
```

The skeleton mirrors the row's card width, aspect ratio, and title line, so nothing shifts when real data replaces it.

- [ ] **Step 8: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add poster card, scrollable row, and matching skeleton"
git push origin main
```

---

### Task 9: The home page

**Files:**
- Create: `app/page.tsx` (replace the scaffolded one), `components/hero.tsx`
- Modify: none

**Interfaces:**
- Consumes: all list endpoints (Task 5), `Row`, `RowSkeleton`, `toCardItem` (Task 8), image helpers (Task 4).
- Produces: the `/` route.

- [ ] **Step 1: Write the hero**

`components/hero.tsx`:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { BACKDROP_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/lib/tmdb/images'
import type { TrendingItem } from '@/lib/tmdb/types'
import { toCardItem } from '@/lib/media'

export async function Hero({ item }: { item: TrendingItem }) {
  const images = await getImageConfig()
  const card = toCardItem(item, 'movie')
  const backdrop = buildImageUrl(
    images.secure_base_url,
    pickSize(images.backdrop_sizes, BACKDROP_SLOTS.hero),
    item.backdrop_path,
  )

  return (
    <section className="relative mb-8 h-[60vh] min-h-[380px] w-full">
      {backdrop && (
        <Image src={backdrop} alt={card.title} fill priority sizes="100vw" className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/40 to-transparent" />
      <div className="absolute bottom-10 left-6 max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight">{card.title}</h1>
        <p className="mt-3 line-clamp-3 text-[var(--muted)]">{item.overview}</p>
        <Link
          href={`/title/${card.mediaType}/${card.id}`}
          className="mt-5 inline-block rounded bg-white px-5 py-2 font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          More info
        </Link>
      </div>
    </section>
  )
}
```

The hero backdrop is the page's largest contentful paint, so it takes `priority` while every other image stays lazy.

- [ ] **Step 2: Write the home page**

`app/page.tsx`:

```tsx
import { Suspense } from 'react'
import { Hero } from '@/components/hero'
import { Row } from '@/components/row'
import { RowSkeleton } from '@/components/row-skeleton'
import { toCardItem } from '@/lib/media'
import {
  discoverByGenre,
  getAiringToday,
  getMovieGenres,
  getNowPlaying,
  getTopRated,
  getTrending,
} from '@/lib/tmdb/endpoints/lists'

async function TrendingRow() {
  const items = await getTrending()
  return <Row title="Trending this week" items={items.map((item) => toCardItem(item, 'movie'))} />
}

async function NowPlayingRow() {
  const items = await getNowPlaying()
  return <Row title="Now playing" items={items.map((item) => toCardItem(item, 'movie'))} />
}

async function TopRatedRow() {
  const items = await getTopRated()
  return <Row title="Top rated" items={items.map((item) => toCardItem(item, 'movie'))} />
}

async function AiringTodayRow() {
  const items = await getAiringToday()
  return <Row title="Airing today" items={items.map((item) => toCardItem(item, 'tv'))} />
}

async function GenreRow({ id, name }: { id: number; name: string }) {
  const items = await discoverByGenre(id)
  return <Row title={name} items={items.map((item) => toCardItem(item, 'movie'))} />
}

async function GenreRows() {
  const genres = await getMovieGenres()
  return (
    <>
      {genres.slice(0, 4).map((genre) => (
        <Suspense key={genre.id} fallback={<RowSkeleton title={genre.name} />}>
          <GenreRow id={genre.id} name={genre.name} />
        </Suspense>
      ))}
    </>
  )
}

async function HomeHero() {
  const [first] = await getTrending()
  return first ? <Hero item={first} /> : null
}

export default function HomePage() {
  return (
    <main>
      <Suspense fallback={<div className="mb-8 h-[60vh] min-h-[380px] animate-pulse bg-white/5" />}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Trending this week" />}>
        <TrendingRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Now playing" />}>
        <NowPlayingRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Top rated" />}>
        <TopRatedRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Airing today" />}>
        <AiringTodayRow />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="By genre" />}>
        <GenreRows />
      </Suspense>
    </main>
  )
}
```

Each row is its own Suspense boundary, so one slow endpoint delays one row rather than the page. `getTrending` is called by both the hero and the trending row; Next's fetch cache deduplicates them within a request, so this is one TMDB call, not two.

- [ ] **Step 3: Exercise it**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000 | grep -c 'image.tmdb.org'
```

Expected: a non-zero count, proving real posters rendered. Then open `http://localhost:3000` in a browser and confirm: the hero shows a real backdrop and title, all rows populate, and no row renders an empty track.

- [ ] **Step 4: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add home page with hero and per-row streaming"
git push origin main
```

---

### Task 10: Title detail page

**Files:**
- Create: `app/title/[mediaType]/[id]/page.tsx`, `app/title/[mediaType]/[id]/loading.tsx`, `lib/route-params.ts`
- Test: `tests/route-params.test.ts`

**Interfaces:**
- Consumes: `getTitleDetail` (Task 5), image helpers (Task 4).
- Produces: `parseMediaType(value: string): MediaType | null` from `@/lib/route-params`; the `/title/[mediaType]/[id]` route.

- [ ] **Step 1: Write the failing validation tests**

`tests/route-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'

describe('parseMediaType', () => {
  it('accepts the two supported media types', () => {
    expect(parseMediaType('movie')).toBe('movie')
    expect(parseMediaType('tv')).toBe('tv')
  })

  it('rejects anything else', () => {
    expect(parseMediaType('person')).toBeNull()
    expect(parseMediaType('MOVIE')).toBeNull()
    expect(parseMediaType('')).toBeNull()
  })
})

describe('parseTmdbId', () => {
  it('accepts a positive integer', () => {
    expect(parseTmdbId('27205')).toBe(27205)
  })

  it('rejects non-numeric, negative, and float ids', () => {
    expect(parseTmdbId('abc')).toBeNull()
    expect(parseTmdbId('-1')).toBeNull()
    expect(parseTmdbId('1.5')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/route-params.test.ts`
Expected: FAIL — cannot resolve `@/lib/route-params`.

- [ ] **Step 3: Implement**

`lib/route-params.ts`:

```ts
import type { MediaType } from './tmdb/types'

export function parseMediaType(value: string): MediaType | null {
  return value === 'movie' || value === 'tv' ? value : null
}

export function parseTmdbId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test tests/route-params.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the detail page**

`app/title/[mediaType]/[id]/page.tsx`. Params are async in Next 16 — they must be awaited.

```tsx
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTitleDetail } from '@/lib/tmdb/endpoints/titles'
import { BACKDROP_SLOTS, POSTER_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/lib/tmdb/images'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'
import { TmdbError } from '@/lib/tmdb/client'

export default async function TitlePage({
  params,
}: {
  params: Promise<{ mediaType: string; id: string }>
}) {
  const { mediaType: rawMediaType, id: rawId } = await params
  const mediaType = parseMediaType(rawMediaType)
  const id = parseTmdbId(rawId)
  if (!mediaType || !id) notFound()

  const detail = await getTitleDetail(mediaType, id).catch((error) => {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  })

  const images = await getImageConfig()
  const title = 'title' in detail ? detail.title : detail.name
  const released = 'release_date' in detail ? detail.release_date : detail.first_air_date
  const poster = buildImageUrl(
    images.secure_base_url,
    pickSize(images.poster_sizes, POSTER_SLOTS.detail),
    detail.poster_path,
  )
  const backdrop = buildImageUrl(
    images.secure_base_url,
    pickSize(images.backdrop_sizes, BACKDROP_SLOTS.hero),
    detail.backdrop_path,
  )

  return (
    <main>
      <div className="relative h-[45vh] min-h-[280px] w-full">
        {backdrop && (
          <Image src={backdrop} alt={title} fill priority sizes="100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
      </div>

      <div className="mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
        {poster && (
          <Image
            src={poster}
            alt={title}
            width={220}
            height={330}
            className="w-[220px] shrink-0 rounded-md shadow-2xl"
          />
        )}
        <div className="pt-4">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {released?.slice(0, 4)} · {detail.vote_average.toFixed(1)} / 10
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {detail.genres.map((genre) => (
              <li key={genre.id} className="rounded-full border border-white/15 px-3 py-1 text-xs">
                {genre.name}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl leading-relaxed">{detail.overview}</p>
        </div>
      </div>
    </main>
  )
}
```

If Step 3 of Task 2 showed different field names on the detail payloads, use the captured names here.

- [ ] **Step 6: Write the loading skeleton**

`app/title/[mediaType]/[id]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main>
      <div className="h-[45vh] min-h-[280px] w-full animate-pulse bg-white/5" />
      <div className="mx-auto -mt-24 flex max-w-5xl gap-8 px-6">
        <div className="h-[330px] w-[220px] shrink-0 animate-pulse rounded-md bg-white/10" />
        <div className="flex-1 space-y-3 pt-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
          <div className="h-20 w-full animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Exercise all four paths**

```bash
pnpm dev &
sleep 5
for path in /title/movie/27205 /title/tv/1396 /title/person/1 /title/movie/abc; do
  echo -n "$path -> "
  curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000$path"
done
```

Expected: `200`, `200`, `404`, `404`. Paste the output. Then load the two 200s in a browser and confirm the poster, title, year, rating, genres, and overview all render.

- [ ] **Step 8: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add title detail page with validated route params"
git push origin main
```

---

### Task 11: Search

**Files:**
- Create: `app/search/page.tsx`, `app/search/loading.tsx`, `components/search-input.tsx`
- Test: none beyond what Task 5 covers for `searchMulti`

**Interfaces:**
- Consumes: `searchMulti` (Task 5), `toCardItem` (Task 8), `PosterCard` (Task 8), image helpers (Task 4).
- Produces: the `/search` route.

- [ ] **Step 1: Write the client input**

`components/search-input.tsx`. It owns the text field and pushes debounced updates into the URL; it never fetches.

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const initial = useRef(true)

  useEffect(() => {
    if (initial.current) {
      initial.current = false
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
      router.replace(params.toString() ? `/search?${params}` : '/search')
    }, 300)
    return () => clearTimeout(timer)
  }, [value, router])

  return (
    <label className="mx-auto mt-8 block max-w-2xl px-6">
      <span className="mb-2 block text-sm text-[var(--muted)]">Search movies and TV</span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search for a title"
        autoComplete="off"
        className="w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus-visible:border-white/50"
      />
    </label>
  )
}
```

`router.replace` rather than `push`, so typing eight characters does not leave eight history entries. The `initial` ref stops the first render from immediately rewriting the URL it just read. The visible `<span>` is the input's accessible name via the wrapping `<label>`.

- [ ] **Step 2: Write the search page**

`app/search/page.tsx`:

```tsx
import { Suspense } from 'react'
import { PosterCard } from '@/components/poster-card'
import { SearchInput } from '@/components/search-input'
import { toCardItem } from '@/lib/media'
import { searchMulti } from '@/lib/tmdb/endpoints/search'
import { getImageConfig } from '@/lib/tmdb/images'

async function Results({ query }: { query: string }) {
  if (!query.trim()) {
    return <p className="mx-auto max-w-2xl px-6 py-10 text-[var(--muted)]">Start typing to search.</p>
  }

  const [items, images] = await Promise.all([searchMulti(query), getImageConfig()])

  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-2xl px-6 py-10 text-[var(--muted)]">
        No movies or TV shows match “{query}”.
      </p>
    )
  }

  return (
    <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item) => (
        <li key={`${item.media_type}-${item.id}`}>
          <PosterCard
            item={toCardItem(item, item.media_type)}
            imageBase={images.secure_base_url}
            posterSizes={images.poster_sizes}
            variant="grid"
          />
        </li>
      ))}
    </ul>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams

  return (
    <main>
      <Suspense>
        <SearchInput />
      </Suspense>
      <Suspense key={q} fallback={<ResultsSkeleton />}>
        <Results query={q} />
      </Suspense>
    </main>
  )
}

function ResultsSkeleton() {
  return (
    <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <li key={index}>
          <div className="aspect-[2/3] animate-pulse rounded-md bg-white/5" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/5" />
        </li>
      ))}
    </ul>
  )
}
```

`<Suspense key={q}>` remounts the boundary on each new query, so the skeleton reappears between searches instead of the previous results sitting stale. `SearchInput` is wrapped in its own Suspense because `useSearchParams` requires it.

- [ ] **Step 3: Add the route-level skeleton**

`app/search/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main>
      <div className="mx-auto mt-8 max-w-2xl px-6">
        <div className="h-14 w-full animate-pulse rounded-md bg-white/5" />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Exercise it**

```bash
pnpm dev &
sleep 5
curl -s 'http://localhost:3000/search?q=matrix' | grep -c 'image.tmdb.org'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/search'
```

Expected: a non-zero poster count for the query, and `200` for the empty state. In a browser: type into the box and confirm the URL updates once you stop typing, results replace themselves, the back button returns to the previous query, and a reload of `/search?q=matrix` renders those results server-side.

- [ ] **Step 5: Gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add URL-driven debounced search"
git push origin main
```

---

### Task 12: Docker image and compose

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`

**Interfaces:**
- Consumes: the built application; `/api/health` from Task 6.
- Produces: a `movies-app` image that runs the whole app from `docker run` alone.

- [ ] **Step 1: Write .dockerignore**

```
node_modules
.next
.git
.env*
docs
tests
scripts
Dockerfile
docker-compose.yml
.dockerignore
README.md
```

- [ ] **Step 2: Write the Dockerfile**

```dockerfile
FROM node:24-slim AS deps
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
```

`HOSTNAME=0.0.0.0` is not optional — the standalone server binds localhost otherwise and the container refuses external connections. The runtime stage copies only `standalone`, `static`, and `public`; no source, no build-stage `node_modules`.

- [ ] **Step 3: Write docker-compose.yml**

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: movies
    ports:
      - '5433:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      retries: 10

  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://postgres:devpass@db:5432/movies
      DB_DRIVER: node-postgres
      TMDB_ACCESS_TOKEN: ${TMDB_ACCESS_TOKEN}
      AUTH_URL: http://localhost:3000
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

The token comes from the environment, never baked into the image.

- [ ] **Step 4: Build the image**

Task 6 left a `movies-pg` container bound to host port 5433, which is the port the compose stack below also binds. Remove it first or compose will fail to start:

```bash
docker rm -f movies-pg 2>/dev/null || true
docker build -t movies-app .
```

Expected: a successful build. Paste the final lines.

- [ ] **Step 5: Verify no secrets made it in**

```bash
docker run --rm --entrypoint sh movies-app -c 'ls -a /app | grep -i env || echo "no env files in image"'
docker run --rm --entrypoint sh movies-app -c 'grep -rl "api.themoviedb.org" /app/.next/standalone 2>/dev/null | head -3; echo "---"; test -d /app/node_modules/.bin && echo "WARNING: build node_modules present" || echo "no build node_modules"'
```

Expected: `no env files in image`. Confirm the actual token string does not appear anywhere in the image:

```bash
set -a; . ./.env.local; set +a
docker run --rm --entrypoint sh movies-app -c "grep -rl '${TMDB_ACCESS_TOKEN}' /app 2>/dev/null || echo 'token absent from image'"
```

Expected: `token absent from image`.

- [ ] **Step 6: Run the container and serve a request**

```bash
docker compose up -d --build
sleep 15
curl -s -o /dev/null -w 'health: %{http_code}\n' http://localhost:3000/api/health
curl -s -o /dev/null -w 'home:   %{http_code}\n' http://localhost:3000/
curl -s http://localhost:3000/ | grep -c 'image.tmdb.org'
docker compose ps
```

Expected: `health: 200`, `home: 200`, a non-zero poster count, and the app container reporting healthy. Paste all of it. A Dockerfile that has not been built and run is unverified.

- [ ] **Step 7: Confirm the healthcheck reports unhealthy on a database outage**

```bash
docker compose stop db
sleep 40
docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)"
docker compose start db
```

Expected: `unhealthy`. This is the assertion that the health route is wired to the database rather than merely to the process.

- [ ] **Step 8: Tear down and commit**

```bash
docker compose down
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add multi-stage Docker image, healthcheck, and compose stack"
git push origin main
```

---

### Task 13: Slice close-out

**Files:**
- Modify: `README.md`
- Create: none

- [ ] **Step 1: Write the README**

Cover only what a reader needs to run it: prerequisites, `.env.local` setup pointing at `.env.example`, `pnpm install && pnpm dev`, the Docker path, and the fact that migrations are a separate step. State what is verified and what is not.

- [ ] **Step 2: Run the full gate one final time**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Paste all four results.

- [ ] **Step 3: Write the verification report**

State plainly, in the commit body and to the human:

- which routes were loaded and rendered real TMDB data
- the health route's 200 and its 503
- the image build, the container serving `/`, and the unhealthy transition
- **that the `neon-http` branch of `db/client.ts` is written but unverified**, because no Neon `DATABASE_URL` existed during this slice, and that confirming it is the first task of the deploy step

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "Document setup and record slice 1 verification results"
git push origin main
```

---

## Deferred to later slices

- Auth.js sessions; `users`, `accounts`, `sessions`, `watchlist_items`; the optimistic watchlist toggle — slice 2.
- Cache-tag revalidation surfaces, a full accessibility audit, CI — slice 3.
- Verifying the `neon-http` driver branch — first task of the deploy step, once Neon exists.
