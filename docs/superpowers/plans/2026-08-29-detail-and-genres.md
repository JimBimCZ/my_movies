# Slice 4 — Rich Detail Page and Genre Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two visual defects on the title detail page, fill that page out with credits, a trailer and an image carousel from TMDB, and add genre navigation from the header.

**Architecture:** One TMDB request per detail page using `append_to_response=credits,videos,images`, mapped to a view model by a pure `lib/` module and rendered by server components that reuse the existing `RowScroller`. Genre navigation merges TMDB's two disjoint genre lists by name into one list, served from a `/genre/[slug]` route and a header disclosure menu.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-29-detail-and-genres-slice-design.md`

## Global Constraints

- **No new dependencies.** CLAUDE.md forbids introducing a library without asking. Everything here uses what is already installed.
- **Import across layers with the `@/` alias** (`@/server/tmdb/types`, `@/components/row`). Relative imports only between siblings in one layer.
- **`'use client'` components must never import from `server/`.** Only `components/trailer-player.tsx` and `components/genres-menu.tsx` are client components; both take plain data as props.
- **`lib/` does no I/O and reads no environment variables.** Importing a *type* from `server/` is fine; types are erased.
- **No unnecessary comments.** No comments restating what the code does, no section banners, no `// TODO`. Keep a comment only when it explains something the code cannot.
- **Tests are Vitest, environment `node`.** There is no jsdom and no testing-library in this repo. Component behaviour is asserted by reading the component's source text — see `tests/site-header.test.ts` and `tests/loading-skeletons.test.ts`. Follow that pattern; do not add a DOM testing library.
- **Fixtures are captured from the live API**, never hand-written. Trimming an array to keep the file small is fine; inventing a field is not.
- **`pnpm build`, `pnpm lint`, `pnpm typecheck` and `pnpm test` must all pass** before a slice is called done, with output shown.
- **Never print `TMDB_ACCESS_TOKEN`.** Load it with `set -a && . ./.env.local && set +a` and reference `$TMDB_ACCESS_TOKEN`; never `echo` it.
- **Commit message style:** state what changed and why, not a summary of the diff. End every commit message with the two trailers used in this repo:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
  ```

## Branches

Three branches, three PRs, in this order. Each is cut from `main` after the previous merges.

| Tasks | Branch | Deliverable |
|---|---|---|
| 1–2 | `slice-4-ui-fixes` (already exists, holds the spec commit) | The two visual defects |
| 3–9 | `slice-4-detail` | Credits, trailer, images, and the page that renders them |
| 10–15 | `slice-4-genres` | Merged genre list, header menu, `/genre/[slug]` |

---

# Slice A — UI fixes (branch `slice-4-ui-fixes`)

### Task 1: Stop the backdrop painting over the detail content

The backdrop container at `app/title/[mediaType]/[id]/page.tsx:63` is `relative`; the content container at line 70 is static with `-mt-24`. Positioned elements with `z-index: auto` paint after non-positioned block descendants regardless of DOM order, so the backdrop covers the top of the poster and the genre pills.

**Files:**
- Modify: `app/title/[mediaType]/[id]/page.tsx:70`
- Test: `tests/title-page-layout.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Later tasks edit the same file.

- [ ] **Step 1: Write the failing test**

Create `tests/title-page-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/title/[mediaType]/[id]/page.tsx', 'utf8')

describe('title detail layout', () => {
  // The backdrop container is `relative`, so it paints after any static sibling that
  // follows it. Without its own stacking level the content pulled up by -mt-24 is
  // painted over rather than overlapping.
  it('raises the content container above the backdrop it overlaps', () => {
    const code = page()
    expect(code).toMatch(/-mt-24[^"]*/)
    const contentClass = code.match(/className="([^"]*-mt-24[^"]*)"/)?.[1] ?? ''
    expect(contentClass).toContain('relative')
    expect(contentClass).toMatch(/\bz-10\b/)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/title-page-layout.test.ts`
Expected: FAIL — the `-mt-24` class list contains neither `relative` nor `z-10`.

- [ ] **Step 3: Add the stacking level**

In `app/title/[mediaType]/[id]/page.tsx`, change line 70 from:

```tsx
      <div className="mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
```

to:

```tsx
      <div className="relative z-10 mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run tests/title-page-layout.test.ts`
Expected: PASS

- [ ] **Step 5: Verify in a browser — this is a visual defect, and a passing test does not prove it is gone**

Start the dev server in the background: `pnpm dev`

Using the chrome-devtools MCP tools, navigate to `http://localhost:3000/title/movie/27205` and take a screenshot. Confirm by eye that the full poster is visible and the genre pills are not clipped by the backdrop. Paste or describe the screenshot in your report.

- [ ] **Step 6: Commit**

```bash
git add app/title/\[mediaType\]/\[id\]/page.tsx tests/title-page-layout.test.ts
git commit -m "$(cat <<'EOF'
Give the detail content its own stacking level

The backdrop container is positioned, so it painted over the static content
container that -mt-24 pulls up beneath it, clipping the poster and the genre
pills. Ordering in the DOM does not settle paint order between a positioned
and a non-positioned sibling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 2: Make the header readable over a bright backdrop

**Files:**
- Modify: `components/site-header.tsx:9,14,20,32,41`
- Test: `tests/site-header.test.ts:1-25` (add cases)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Task 14 adds the genres menu to this same file.

- [ ] **Step 1: Write the failing test**

Append to the `describe('site header', ...)` block in `tests/site-header.test.ts`:

```ts
  it('scrims deeply enough to carry the nav over a bright backdrop', () => {
    const code = header()
    expect(code).toContain('from-black/90')
    expect(code).toContain('via-black/60')
  })

  it('does not put nav links on the muted colour', () => {
    // --muted is #9b9ba3. Over a bright backdrop with only a partial scrim it does not
    // reach 4.5:1, and every link in the header sat on it.
    const code = header()
    const linkClasses = [...code.matchAll(/className="([^"]*)"/g)].map((match) => match[1]!)
    const navClasses = linkClasses.filter((value) => value.includes('text-sm'))
    expect(navClasses.length).toBeGreaterThan(0)
    for (const value of navClasses) {
      expect(value).not.toContain('text-[var(--muted)]')
    }
  })
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/site-header.test.ts`
Expected: FAIL on both new cases — the scrim is `from-black/80 to-transparent` and the nav links are `text-[var(--muted)]`.

- [ ] **Step 3: Deepen the scrim and lift the link colour**

Replace the whole of `components/site-header.tsx` with:

```tsx
import Link from 'next/link'
import { signOutAction } from '@/server/auth/actions'
import { auth } from '@/server/auth/config'

export async function SiteHeader() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-6 pb-8 pt-4">
      <nav className="mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link
          href="/search"
          className="py-1 text-sm text-white/90 hover:text-white"
        >
          Search
        </Link>
        {session ? (
          <Link
            href="/watchlist"
            className="py-1 text-sm text-white/90 hover:text-white"
          >
            Watchlist
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session ? (
            <>
              <span className="text-white/70">
                {session.user?.name ?? session.user?.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded py-1 text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded py-1 text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
```

The `pb-8` extends the scrim past the nav so it fades out over the image rather than ending at the text baseline.

The links use `text-white/90` rather than an opacity modifier on `--foreground`. Tailwind builds an opacity modifier with `color-mix`, and mixing against a CSS custom property is the fragile case; `white` is a plain colour and needs no such treatment. The difference is invisible — `--foreground` is `#f5f5f7`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/site-header.test.ts`
Expected: PASS, including the four pre-existing cases.

- [ ] **Step 5: Measure the contrast in a browser — do not assert a contrast ratio you have not measured**

With `pnpm dev` running, use the chrome-devtools MCP tools to navigate to `http://localhost:3000/title/movie/27205` and take a screenshot. Then run `mcp__plugin_chrome-devtools-mcp_chrome-devtools__lighthouse_audit` with the accessibility category, or evaluate the computed colours of the "Search" link and the pixel behind it, and confirm the contrast ratio is at least 4.5:1. Report the measured number.

If it falls short, deepen the scrim further (`from-black`, `via-black/70`) rather than enlarging the text; report the value you landed on.

- [ ] **Step 6: Run the full check suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: all four pass. Paste the output.

- [ ] **Step 7: Commit and open the PR**

```bash
git add components/site-header.tsx tests/site-header.test.ts
git commit -m "$(cat <<'EOF'
Carry the header nav over a bright backdrop

The scrim faded to transparent within the header's own height and every nav
link sat on --muted, so over a detail page backdrop the links fell below 4.5:1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
git push
gh pr create --title "Fix the detail page stacking and the header contrast" --body "$(cat <<'EOF'
The backdrop container on the title detail page is positioned, so it painted
over the content that -mt-24 pulls up beneath it. The header scrim faded out
within its own height and the nav links sat on --muted, so they were
unreadable over a bright backdrop.

Also records the slice 4 design spec.

Verified: build, lint, typecheck and tests pass; both fixes confirmed in a
browser against /title/movie/27205, with the header contrast measured.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

# Slice B — Rich detail page (branch `slice-4-detail`)

Cut the branch once slice A merges:

```bash
git checkout main && git pull --ff-only && git checkout -b slice-4-detail
```

### Task 3: Fetch credits, videos and images in the detail request

**Files:**
- Modify: `server/tmdb/types.ts`
- Modify: `server/tmdb/endpoints/titles.ts`
- Replace: `tests/fixtures/tmdb/movie-detail.json`, `tests/fixtures/tmdb/tv-detail.json`
- Test: `tests/tmdb/endpoints.test.ts:125-159` (modify), `tests/tmdb/types.test.ts` (add cases)

**Interfaces:**
- Consumes: `tmdbFetch`, `REVALIDATE`, `tags` from `server/tmdb/{client,cache}`.
- Produces:
  - `CastMember`, `CrewMember`, `Credits`, `Video`, `ImageAsset`, `TitleImages`, `ProductionCompany`, `Network`, `Creator`, `AppendedTitleData`, `MovieDetailFull`, `TvDetailFull` from `@/server/tmdb/types`
  - `TitleDetail` from `@/server/tmdb/endpoints/titles`, now `(MovieDetailFull & { media_type: 'movie' }) | (TvDetailFull & { media_type: 'tv' })`

- [ ] **Step 1: Recapture both fixtures from the live API**

Run this exactly. It appends the three sub-resources and trims the long arrays so the fixtures stay reviewable; it prints no token.

```bash
set -a && . ./.env.local >/dev/null 2>&1 && set +a
for pair in "movie 27205 movie-detail" "tv 1396 tv-detail"; do
  set -- $pair
  curl -s -H "Authorization: Bearer $TMDB_ACCESS_TOKEN" \
    "https://api.themoviedb.org/3/$1/$2?append_to_response=credits,videos,images&include_image_language=en,null" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['credits']['cast'] = d['credits']['cast'][:12]
keep = {'Director', 'Screenplay', 'Producer', 'Original Music Composer', 'Director of Photography', 'Executive Producer'}
d['credits']['crew'] = [c for c in d['credits']['crew'] if c['job'] in keep][:12]
d['videos']['results'] = d['videos']['results'][:8]
for k in ('backdrops', 'posters', 'logos'):
    d['images'][k] = d['images'][k][:6]
json.dump(d, open('tests/fixtures/tmdb/$3.json', 'w'), indent=2)
"
done
python3 -c "
import json
for n in ('movie-detail', 'tv-detail'):
    d = json.load(open(f'tests/fixtures/tmdb/{n}.json'))
    print(n, 'credits' in d, 'videos' in d, 'images' in d,
          'cast', len(d['credits']['cast']), 'videos', len(d['videos']['results']),
          'backdrops', len(d['images']['backdrops']))
"
```

Expected output confirms `movie-detail` has 12 cast, 8 videos, 6 backdrops, and `tv-detail` has 8 cast and **0 videos** — that zero is the real response and is the reason the trailer section must be optional.

- [ ] **Step 2: Write the failing tests**

In `tests/tmdb/endpoints.test.ts`, replace the two cases in `describe('title endpoints', ...)` with:

```ts
  it('getTitleDetail appends credits, videos and images to the movie request', async () => {
    const fetchMock = respondWith(fixture('movie-detail'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTitleDetail } = await import('@/server/tmdb/endpoints/titles')

    const detail = await getTitleDetail('movie', 27205)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/movie/27205')
    expect(url).toContain('append_to_response=credits%2Cvideos%2Cimages')
    expect(url).toContain('include_image_language=en%2Cnull')
    expect(init.next.tags).toContain('tmdb:title:movie:27205')
    expect(init.next.revalidate).toBe(REVALIDATE.detail)
    expect(detail.media_type).toBe('movie')
    expect(detail.credits.cast.length).toBeGreaterThan(0)
    expect(detail.images.backdrops.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('getTitleDetail makes the same single appended request for tv', async () => {
    const fetchMock = respondWith(fixture('tv-detail'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTitleDetail } = await import('@/server/tmdb/endpoints/titles')

    const detail = await getTitleDetail('tv', 1396)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('/tv/1396')
    expect(url).toContain('append_to_response=credits%2Cvideos%2Cimages')
    expect(detail.media_type).toBe('tv')
    expect(detail).toEqual({ ...fixture('tv-detail'), media_type: 'tv' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

In `tests/tmdb/types.test.ts`, add these cases inside `describe('captured TMDB payloads', ...)`:

```ts
  it('appended credits carry a cast ordered from the top billing', () => {
    const detail = load('movie-detail') as MovieDetailFull
    expect(detail.credits.cast[0]!.order).toBe(0)
    expect(typeof detail.credits.cast[0]!.character).toBe('string')
    expect(isStringOrNull(detail.credits.cast[0]!.profile_path)).toBe(true)
    expect(detail.credits.crew.some((member) => member.job === 'Director')).toBe(true)
  })

  it('tv credits name no Director; the creator lives on created_by', () => {
    const detail = load('tv-detail') as TvDetailFull
    expect(detail.credits.crew.some((member) => member.job === 'Director')).toBe(false)
    expect(detail.created_by.length).toBeGreaterThan(0)
    expect(typeof detail.created_by[0]!.name).toBe('string')
  })

  it('a real tv payload can carry no videos and no episode runtime at all', () => {
    const detail = load('tv-detail') as TvDetailFull
    expect(detail.videos.results).toEqual([])
    expect(detail.episode_run_time).toEqual([])
  })

  it('appended images expose voted backdrops', () => {
    const detail = load('movie-detail') as MovieDetailFull
    expect(detail.images.backdrops.length).toBeGreaterThan(0)
    for (const asset of detail.images.backdrops) {
      expect(typeof asset.file_path).toBe('string')
      expect(typeof asset.vote_average).toBe('number')
      expect(typeof asset.vote_count).toBe('number')
    }
  })
```

Add `MovieDetailFull` and `TvDetailFull` to the type import list at the top of that file.

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm vitest run tests/tmdb`
Expected: FAIL — `MovieDetailFull` is not exported, and the request URL carries no `append_to_response`.

- [ ] **Step 4: Add the types**

Append to `server/tmdb/types.ts`:

```ts
export interface CastMember {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
  character: string
  credit_id: string
  order: number
}

export interface CrewMember {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
  credit_id: string
  department: string
  job: string
}

export interface Credits {
  cast: CastMember[]
  crew: CrewMember[]
}

export interface Video {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string
  name: string
  official: boolean
  published_at: string
  site: string
  size: number
  type: string
}

export interface ImageAsset {
  aspect_ratio: number
  file_path: string
  height: number
  iso_639_1: string | null
  vote_average: number
  vote_count: number
  width: number
}

export interface TitleImages {
  backdrops: ImageAsset[]
  logos: ImageAsset[]
  posters: ImageAsset[]
}

export interface AppendedTitleData {
  credits: Credits
  videos: { results: Video[] }
  images: TitleImages
}

export type MovieDetailFull = MovieDetail & AppendedTitleData
export type TvDetailFull = TvDetail & AppendedTitleData
```

Also add these interfaces to the same file and the listed fields to the two existing detail interfaces:

```ts
export interface ProductionCompany {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

export interface Network {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

export interface Creator {
  credit_id: string
  gender: number
  id: number
  name: string
  original_name: string
  profile_path: string | null
}
```

Add to `MovieDetail`: `budget: number`, `revenue: number`, `production_companies: ProductionCompany[]`.
Add to `TvDetail`: `created_by: Creator[]`, `networks: Network[]`.

- [ ] **Step 5: Append the sub-resources to the request**

Replace `server/tmdb/endpoints/titles.ts` with:

```ts
import { tmdbFetch } from '../client'
import { REVALIDATE, tags } from '../cache'
import type { MediaType, MovieDetailFull, TvDetailFull } from '../types'

// One request instead of four. `include_image_language=en,null` keeps English and
// textless artwork; without it TMDB returns every localisation of every poster.
const APPENDED = {
  append_to_response: 'credits,videos,images',
  include_image_language: 'en,null',
} as const

export function getMovieDetail(id: number): Promise<MovieDetailFull> {
  return tmdbFetch<MovieDetailFull>(`/movie/${id}`, {
    searchParams: APPENDED,
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('movie', id)],
  })
}

export function getTvDetail(id: number): Promise<TvDetailFull> {
  return tmdbFetch<TvDetailFull>(`/tv/${id}`, {
    searchParams: APPENDED,
    revalidate: REVALIDATE.detail,
    tags: [tags.detail('tv', id)],
  })
}

export type TitleDetail =
  | (MovieDetailFull & { media_type: 'movie' })
  | (TvDetailFull & { media_type: 'tv' })

export async function getTitleDetail(mediaType: MediaType, id: number): Promise<TitleDetail> {
  return mediaType === 'movie'
    ? { ...(await getMovieDetail(id)), media_type: 'movie' }
    : { ...(await getTvDetail(id)), media_type: 'tv' }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/tmdb && pnpm typecheck`
Expected: PASS. If `typecheck` complains that a declared field is missing from the fixture-typed cast, re-check the field name against the recaptured fixture rather than loosening the type.

- [ ] **Step 7: Commit**

```bash
git add server/tmdb/types.ts server/tmdb/endpoints/titles.ts tests/fixtures/tmdb tests/tmdb
git commit -m "$(cat <<'EOF'
Fetch credits, videos and images with the title detail

append_to_response returns all three inline, so a detail page costs one TMDB
request rather than four, under the tag it already had. The recaptured tv
fixture has zero videos and an empty episode_run_time, which is what Breaking
Bad actually returns and what the rendering has to survive.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 4: The pure view model

**Files:**
- Create: `lib/title-detail.ts`
- Test: `tests/title-detail.test.ts` (create)

**Interfaces:**
- Consumes: `TitleDetail` from `@/server/tmdb/endpoints/titles`; `CastMember`, `ImageAsset`, `TitleImages`, `Video`, `Credits` from `@/server/tmdb/types`.
- Produces, from `@/lib/title-detail`:
  - `interface TitleFact { label: string; value: string }`
  - `formatRuntime(minutes: number): string`
  - `toTitleFacts(detail: TitleDetail): TitleFact[]`
  - `pickTrailer(videos: Video[]): Video | null`
  - `pickCast(credits: Credits, limit: number): CastMember[]`
  - `pickBackdrops(images: TitleImages, limit: number): ImageAsset[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/title-detail.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  formatRuntime,
  pickBackdrops,
  pickCast,
  pickTrailer,
  toTitleFacts,
} from '@/lib/title-detail'
import type { TitleDetail } from '@/server/tmdb/endpoints/titles'
import type { Video } from '@/server/tmdb/types'

const detail = (name: string, mediaType: 'movie' | 'tv') =>
  ({
    ...JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8')),
    media_type: mediaType,
  }) as TitleDetail

const movie = () => detail('movie-detail', 'movie')
const tv = () => detail('tv-detail', 'tv')

const video = (overrides: Partial<Video>): Video => ({
  id: 'x',
  iso_639_1: 'en',
  iso_3166_1: 'US',
  key: 'k',
  name: 'n',
  official: true,
  published_at: '2020-01-01T00:00:00.000Z',
  site: 'YouTube',
  size: 1080,
  type: 'Trailer',
  ...overrides,
})

describe('formatRuntime', () => {
  it('splits minutes into hours and minutes', () => {
    expect(formatRuntime(148)).toBe('2h 28m')
  })

  it('drops the hour part below an hour', () => {
    expect(formatRuntime(45)).toBe('45m')
  })

  it('drops the minute part on a whole hour', () => {
    expect(formatRuntime(120)).toBe('2h')
  })
})

describe('toTitleFacts', () => {
  it('names the director from the movie crew', () => {
    const facts = toTitleFacts(movie())
    expect(facts).toContainEqual({ label: 'Director', value: 'Christopher Nolan' })
  })

  it('formats the movie release date and runtime', () => {
    const facts = toTitleFacts(movie())
    expect(facts).toContainEqual({ label: 'Released', value: 'July 15, 2010' })
    expect(facts).toContainEqual({ label: 'Runtime', value: '2h 28m' })
  })

  it('names the creator for tv, where the crew has no Director', () => {
    const facts = toTitleFacts(tv())
    expect(facts).toContainEqual({ label: 'Creator', value: 'Vince Gilligan' })
    expect(facts.map((fact) => fact.label)).not.toContain('Director')
  })

  it('counts seasons and episodes for tv instead of a runtime', () => {
    const facts = toTitleFacts(tv())
    expect(facts).toContainEqual({ label: 'Seasons', value: '5 seasons · 62 episodes' })
    expect(facts.map((fact) => fact.label)).not.toContain('Runtime')
  })

  it('omits a fact rather than emitting an empty value', () => {
    const bare = { ...movie(), runtime: 0, status: '', production_companies: [] }
    const labels = toTitleFacts(bare as TitleDetail).map((fact) => fact.label)
    expect(labels).not.toContain('Runtime')
    expect(labels).not.toContain('Status')
    expect(labels).not.toContain('Studio')
  })
})

describe('pickTrailer', () => {
  it('prefers the newest official YouTube trailer', () => {
    const chosen = pickTrailer([
      video({ key: 'old', published_at: '2010-01-01T00:00:00.000Z' }),
      video({ key: 'new', published_at: '2022-01-01T00:00:00.000Z' }),
    ])
    expect(chosen?.key).toBe('new')
  })

  it('ignores clips and featurettes', () => {
    const chosen = pickTrailer([
      video({ key: 'clip', type: 'Clip', published_at: '2024-01-01T00:00:00.000Z' }),
      video({ key: 'trailer', type: 'Trailer' }),
    ])
    expect(chosen?.key).toBe('trailer')
  })

  it('falls back to a teaser when there is no trailer', () => {
    expect(pickTrailer([video({ key: 't', type: 'Teaser' })])?.key).toBe('t')
  })

  it('prefers an official trailer over an unofficial one', () => {
    const chosen = pickTrailer([
      video({ key: 'fan', official: false, published_at: '2024-01-01T00:00:00.000Z' }),
      video({ key: 'official', official: true, published_at: '2010-01-01T00:00:00.000Z' }),
    ])
    expect(chosen?.key).toBe('official')
  })

  it('ignores anything not hosted on YouTube', () => {
    expect(pickTrailer([video({ site: 'Vimeo' })])).toBeNull()
  })

  it('returns null for a title with no videos at all', () => {
    expect(pickTrailer(tv().videos.results)).toBeNull()
  })
})

describe('pickCast', () => {
  it('takes the top billing in order', () => {
    const cast = pickCast(movie().credits, 3)
    expect(cast).toHaveLength(3)
    expect(cast[0]!.order).toBe(0)
    expect(cast[0]!.name).toBe('Leonardo DiCaprio')
  })

  it('returns everything available when the limit exceeds the cast', () => {
    expect(pickCast(tv().credits, 100)).toHaveLength(tv().credits.cast.length)
  })
})

describe('pickBackdrops', () => {
  it('puts the best-voted backdrop first and honours the limit', () => {
    const picked = pickBackdrops(movie().images, 3)
    expect(picked).toHaveLength(3)
    expect(picked[0]!.vote_average).toBeGreaterThanOrEqual(picked[1]!.vote_average)
    expect(picked[1]!.vote_average).toBeGreaterThanOrEqual(picked[2]!.vote_average)
  })

  it('does not mutate the payload it was handed', () => {
    const images = movie().images
    const before = images.backdrops.map((asset) => asset.file_path)
    pickBackdrops(images, 3)
    expect(images.backdrops.map((asset) => asset.file_path)).toEqual(before)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/title-detail.test.ts`
Expected: FAIL — `@/lib/title-detail` does not exist.

- [ ] **Step 3: Write the module**

Create `lib/title-detail.ts`:

```ts
import type { TitleDetail } from '@/server/tmdb/endpoints/titles'
import type { CastMember, Credits, ImageAsset, TitleImages, Video } from '@/server/tmdb/types'

export interface TitleFact {
  label: string
  value: string
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

// TMDB dates are plain YYYY-MM-DD. Parsing one as a bare Date makes it local
// midnight, which lands on the previous day west of UTC, so both the parse and
// the format are pinned to UTC.
function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function toTitleFacts(detail: TitleDetail): TitleFact[] {
  const facts: TitleFact[] = []

  if (detail.media_type === 'movie') {
    const directors = detail.credits.crew.filter((member) => member.job === 'Director')
    if (directors.length > 0) {
      facts.push({ label: 'Director', value: directors.map((member) => member.name).join(', ') })
    }
    if (detail.release_date) facts.push({ label: 'Released', value: formatDate(detail.release_date) })
    if (detail.runtime > 0) facts.push({ label: 'Runtime', value: formatRuntime(detail.runtime) })
  } else {
    if (detail.created_by.length > 0) {
      facts.push({ label: 'Creator', value: detail.created_by.map((person) => person.name).join(', ') })
    }
    if (detail.first_air_date) {
      facts.push({ label: 'First aired', value: formatDate(detail.first_air_date) })
    }
    if (detail.number_of_seasons > 0) {
      const seasons = plural(detail.number_of_seasons, 'season')
      const episodes = detail.number_of_episodes
      facts.push({
        label: 'Seasons',
        value: episodes ? `${seasons} · ${plural(episodes, 'episode')}` : seasons,
      })
    }
  }

  if (detail.vote_count > 0) {
    facts.push({
      label: 'Rating',
      value: `${detail.vote_average.toFixed(1)} / 10 · ${plural(detail.vote_count, 'vote')}`,
    })
  }
  if (detail.status) facts.push({ label: 'Status', value: detail.status })

  const studio =
    detail.media_type === 'movie' ? detail.production_companies[0]?.name : detail.networks[0]?.name
  if (studio) {
    facts.push({ label: detail.media_type === 'movie' ? 'Studio' : 'Network', value: studio })
  }

  return facts.filter((fact) => fact.value !== '')
}

const TRAILER_RANK = ['Trailer', 'Teaser']

export function pickTrailer(videos: Video[]): Video | null {
  const youtube = videos.filter((item) => item.site === 'YouTube')
  for (const type of TRAILER_RANK) {
    for (const official of [true, false]) {
      const matches = youtube
        .filter((item) => item.type === type && item.official === official)
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
      if (matches[0]) return matches[0]
    }
  }
  return null
}

export function pickCast(credits: Credits, limit: number): CastMember[] {
  return [...credits.cast].sort((a, b) => a.order - b.order).slice(0, limit)
}

export function pickBackdrops(images: TitleImages, limit: number): ImageAsset[] {
  return [...images.backdrops]
    .sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count)
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/title-detail.test.ts`
Expected: PASS, all 17 cases.

If `toTitleFacts` fails on the exact release date string, print the fixture's `release_date` before changing the expectation — a mismatch means the timezone pinning is wrong, not that the expected string is.

- [ ] **Step 5: Commit**

```bash
git add lib/title-detail.ts tests/title-detail.test.ts
git commit -m "$(cat <<'EOF'
Map an appended title payload to a renderable view model

Movies and TV name their author, their length and their studio in different
fields, and either can be missing any of them. Keeping the branching in one
pure module means it is tested against the captured payloads rather than
discovered in a component.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 5: Render the facts, tagline and overview

**Files:**
- Create: `components/title-facts.tsx`
- Modify: `app/title/[mediaType]/[id]/page.tsx`
- Test: `tests/title-page-layout.test.ts` (add cases)

**Interfaces:**
- Consumes: `TitleFact`, `toTitleFacts` from `@/lib/title-detail`.
- Produces: `TitleFacts({ facts }: { facts: TitleFact[] })` from `@/components/title-facts`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/title-page-layout.test.ts`:

```ts
const facts = () => readFileSync('components/title-facts.tsx', 'utf8')

describe('title facts', () => {
  it('renders facts as a definition list, not a paragraph', () => {
    const code = facts()
    expect(code).toContain('<dl')
    expect(code).toContain('<dt')
    expect(code).toContain('<dd')
  })

  it('renders nothing when there are no facts to show', () => {
    expect(facts()).toMatch(/facts\.length === 0/)
  })

  it('is a server component', () => {
    expect(facts()).not.toMatch(/["']use client["']/)
  })
})

describe('title detail page', () => {
  it('builds its facts from the view model rather than inline in the page', () => {
    const code = page()
    expect(code).toContain("from '@/lib/title-detail'")
    expect(code).toContain('toTitleFacts(detail)')
    expect(code).toContain('<TitleFacts')
  })

  it('shows the tagline only when the payload has one', () => {
    expect(page()).toMatch(/detail\.tagline &&/)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/title-page-layout.test.ts`
Expected: FAIL — `components/title-facts.tsx` does not exist.

- [ ] **Step 3: Write the component**

Create `components/title-facts.tsx`:

```tsx
import type { TitleFact } from '@/lib/title-detail'

export function TitleFacts({ facts }: { facts: TitleFact[] }) {
  if (facts.length === 0) return null

  return (
    <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="flex gap-2">
          <dt className="shrink-0 text-[var(--muted)]">{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
```

- [ ] **Step 4: Wire it into the page**

In `app/title/[mediaType]/[id]/page.tsx`, add the imports:

```tsx
import { TitleFacts } from '@/components/title-facts'
import { toTitleFacts } from '@/lib/title-detail'
```

Add after the `backdrop` const:

```tsx
  const facts = toTitleFacts(detail)
```

Replace the block from the `<p className="mt-1 ...">` year/rating line through the overview paragraph with:

```tsx
          <ul className="mt-3 flex flex-wrap gap-2">
            {detail.genres.map((genre) => (
              <li key={genre.id} className="rounded-full border border-white/15 px-3 py-1 text-xs">
                {genre.name}
              </li>
            ))}
          </ul>
          <TitleFacts facts={facts} />
          {detail.tagline && (
            <p className="mt-5 text-lg italic text-[var(--muted)]">{detail.tagline}</p>
          )}
          <p className="mt-3 max-w-2xl leading-relaxed">{detail.overview}</p>
```

Delete the now-unused `releaseYear` and `releaseDate` consts — the facts list carries the date. Leave the `<h1>` as it is.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/title-page-layout.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS. `lint` catches any const left unused.

- [ ] **Step 6: Commit**

```bash
git add components/title-facts.tsx app/title/\[mediaType\]/\[id\]/page.tsx tests/title-page-layout.test.ts
git commit -m "$(cat <<'EOF'
Show the director, dates, length and studio on the detail page

The page carried a year and a rating; everything else TMDB knows about a title
was already in the payload and unrendered.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 6: The cast row

**Files:**
- Create: `components/cast-row.tsx`
- Modify: `server/tmdb/images.ts:5-6`
- Modify: `app/title/[mediaType]/[id]/page.tsx`
- Test: `tests/tmdb/images.test.ts` (add case), `tests/title-page-layout.test.ts` (add cases)

**Interfaces:**
- Consumes: `pickCast` from `@/lib/title-detail`; `RowScroller` from `@/components/row-scroller`; `buildImageUrl`, `pickSize`, `getImageConfig` from `@/server/tmdb/images`.
- Produces: `PROFILE_SLOTS` from `@/server/tmdb/images`; `CastRow({ cast }: { cast: CastMember[] })` from `@/components/cast-row`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/tmdb/images.test.ts`:

```ts
  it('picks a profile size for the cast card slot', async () => {
    const { PROFILE_SLOTS, pickSize } = await import('@/server/tmdb/images')
    const config = JSON.parse(readFileSync('tests/fixtures/tmdb/configuration.json', 'utf8'))
    expect(pickSize(config.images.profile_sizes, PROFILE_SLOTS.card)).toBe('w185')
  })
```

If `tests/tmdb/images.test.ts` does not already import `readFileSync`, add `import { readFileSync } from 'node:fs'` at the top.

Add to `tests/title-page-layout.test.ts`:

```ts
const castRow = () => readFileSync('components/cast-row.tsx', 'utf8')

describe('cast row', () => {
  it('is a server component that reuses the shared scroller', () => {
    const code = castRow()
    expect(code).not.toMatch(/["']use client["']/)
    expect(code).toContain('RowScroller')
  })

  it('names both the actor and the character', () => {
    const code = castRow()
    expect(code).toContain('member.name')
    expect(code).toContain('member.character')
  })

  it('gives every profile image alt text naming the actor', () => {
    expect(castRow()).toMatch(/alt=\{member\.name\}/)
  })

  it('renders nothing for a title with no cast', () => {
    expect(castRow()).toMatch(/cast\.length === 0/)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/tmdb/images.test.ts tests/title-page-layout.test.ts`
Expected: FAIL — `PROFILE_SLOTS` is not exported and `components/cast-row.tsx` does not exist.

- [ ] **Step 3: Add the profile slot**

In `server/tmdb/images.ts`, change:

```ts
export const POSTER_SLOTS = { card: 342, detail: 500 } as const
export const BACKDROP_SLOTS = { hero: 1280 } as const
```

to:

```ts
export const POSTER_SLOTS = { card: 342, detail: 500 } as const
export const BACKDROP_SLOTS = { hero: 1280, still: 780 } as const
export const PROFILE_SLOTS = { card: 185 } as const
```

- [ ] **Step 4: Write the component**

Create `components/cast-row.tsx`:

```tsx
import Image from 'next/image'
import { RowScroller } from './row-scroller'
import { buildImageUrl, getImageConfig, PROFILE_SLOTS, pickSize } from '@/server/tmdb/images'
import type { CastMember } from '@/server/tmdb/types'

export async function CastRow({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null
  const images = await getImageConfig()
  const size = pickSize(images.profile_sizes, PROFILE_SLOTS.card)

  return (
    <section className="mb-8" aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-3 px-6 text-lg font-semibold">
        Cast
      </h2>
      <RowScroller label="Cast">
        {cast.map((member) => {
          const profile = buildImageUrl(images.secure_base_url, size, member.profile_path)
          return (
            <div key={member.credit_id} className="w-[140px] shrink-0 snap-start">
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/5">
                {profile && (
                  <Image
                    src={profile}
                    alt={member.name}
                    fill
                    sizes="140px"
                    loading="lazy"
                    className="object-cover"
                  />
                )}
              </div>
              <p className="mt-2 text-sm leading-5">{member.name}</p>
              <p className="text-xs leading-5 text-[var(--muted)]">{member.character}</p>
            </div>
          )
        })}
      </RowScroller>
    </section>
  )
}
```

- [ ] **Step 5: Wire it into the page**

In `app/title/[mediaType]/[id]/page.tsx` add:

```tsx
import { CastRow } from '@/components/cast-row'
import { pickCast, toTitleFacts } from '@/lib/title-detail'
```

Add a constant near the top of the file, above `generateMetadata`:

```tsx
const CAST_LIMIT = 10
```

and render it after the closing `</div>` of the poster/details block, still inside `<main>`:

```tsx
      <div className="mt-12">
        <CastRow cast={pickCast(detail.credits, CAST_LIMIT)} />
      </div>
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/cast-row.tsx server/tmdb/images.ts app/title/\[mediaType\]/\[id\]/page.tsx tests
git commit -m "$(cat <<'EOF'
Show the top-billed cast on the detail page

Reuses RowScroller with server-rendered cards passed through as children, so
the profile images stay out of the client bundle.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 7: The trailer

**Files:**
- Create: `components/trailer-player.tsx`
- Modify: `app/title/[mediaType]/[id]/page.tsx`
- Test: `tests/trailer-player.test.ts` (create)

**Interfaces:**
- Consumes: `pickTrailer` from `@/lib/title-detail`; `BACKDROP_SLOTS`, `buildImageUrl`, `pickSize` from `@/server/tmdb/images` (called in the page, not in the client component).
- Produces: `TrailerPlayer({ youtubeKey, title, thumbnail }: { youtubeKey: string; title: string; thumbnail: string | null })` from `@/components/trailer-player`.

- [ ] **Step 1: Write the failing tests**

Create `tests/trailer-player.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const player = () => readFileSync('components/trailer-player.tsx', 'utf8')
const page = () => readFileSync('app/title/[mediaType]/[id]/page.tsx', 'utf8')

describe('trailer player', () => {
  it('is a client component, because the play state is interaction', () => {
    expect(player()).toMatch(/^'use client'/)
  })

  it('never imports from server/, which server-only would turn into a build error', () => {
    expect(player()).not.toContain("from '@/server/")
  })

  it('mounts the iframe only after the play state is set', () => {
    const code = player()
    expect(code).toContain('useState')
    expect(code).toMatch(/playing \?|playing &&/)
  })

  it('embeds through the no-cookie host', () => {
    expect(player()).toContain('youtube-nocookie.com/embed/')
    expect(player()).not.toContain('www.youtube.com/embed/')
  })

  it('gives the iframe and the play button accessible names', () => {
    const code = player()
    expect(code).toMatch(/title=\{`\$\{title\} trailer`\}/)
    expect(code).toMatch(/Play trailer/)
  })
})

describe('title detail page trailer section', () => {
  it('renders the section only when a trailer was found', () => {
    const code = page()
    expect(code).toContain('pickTrailer(detail.videos.results)')
    expect(code).toMatch(/trailer &&/)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/trailer-player.test.ts`
Expected: FAIL — `components/trailer-player.tsx` does not exist.

- [ ] **Step 3: Write the component**

Create `components/trailer-player.tsx`:

```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'

export function TrailerPlayer({
  youtubeKey,
  title,
  thumbnail,
}: {
  youtubeKey: string
  title: string
  thumbnail: string | null
}) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-white/5">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1`}
          title={`${title} trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {thumbnail && (
            <Image src={thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/25">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-black">
              ▶
            </span>
          </span>
          <span className="sr-only">Play trailer for {title}</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the page**

In `app/title/[mediaType]/[id]/page.tsx`, extend the imports:

```tsx
import { TrailerPlayer } from '@/components/trailer-player'
import { pickCast, pickTrailer, toTitleFacts } from '@/lib/title-detail'
```

Add after the `facts` const:

```tsx
  const trailer = pickTrailer(detail.videos.results)
  const still = buildImageUrl(
    images.secure_base_url,
    pickSize(images.backdrop_sizes, BACKDROP_SLOTS.still),
    detail.backdrop_path,
  )
```

and render it above the cast section:

```tsx
      {trailer && (
        <section className="mx-auto mt-12 max-w-3xl px-6" aria-labelledby="trailer-heading">
          <h2 id="trailer-heading" className="mb-3 text-lg font-semibold">
            Trailer
          </h2>
          <TrailerPlayer youtubeKey={trailer.key} title={title} thumbnail={still} />
        </section>
      )}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 6: Verify playback in a browser — a source assertion does not prove a video plays**

With `pnpm dev` running, use the chrome-devtools MCP tools to open `http://localhost:3000/title/movie/27205`, click the play button, and confirm the iframe appears and the trailer plays. Then check `list_network_requests` and confirm no request to `youtube.com` or `youtube-nocookie.com` was made *before* the click. Report both.

Also open `http://localhost:3000/title/tv/1396` and confirm the page renders with **no** trailer section — that show has zero videos.

- [ ] **Step 7: Commit**

```bash
git add components/trailer-player.tsx app/title/\[mediaType\]/\[id\]/page.tsx tests/trailer-player.test.ts
git commit -m "$(cat <<'EOF'
Play the trailer on click rather than loading YouTube on view

The embed is deferred behind a thumbnail so a detail view costs no third-party
script and sets no third-party cookie for a video most visitors never play.
Titles with no video render no section at all.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 8: The image carousel

**Files:**
- Create: `components/backdrop-carousel.tsx`
- Modify: `app/title/[mediaType]/[id]/page.tsx`
- Test: `tests/title-page-layout.test.ts` (add cases)

**Interfaces:**
- Consumes: `pickBackdrops` from `@/lib/title-detail`; `RowScroller`; `BACKDROP_SLOTS`, `buildImageUrl`, `getImageConfig`, `pickSize` from `@/server/tmdb/images`.
- Produces: `BackdropCarousel({ images, title }: { images: ImageAsset[]; title: string })` from `@/components/backdrop-carousel`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/title-page-layout.test.ts`:

```ts
const carousel = () => readFileSync('components/backdrop-carousel.tsx', 'utf8')

describe('backdrop carousel', () => {
  it('is a server component reusing the shared scroller', () => {
    const code = carousel()
    expect(code).not.toMatch(/["']use client["']/)
    expect(code).toContain('RowScroller')
  })

  it('renders nothing when the title has no extra images', () => {
    expect(carousel()).toMatch(/images\.length === 0/)
  })

  it('lazily loads the stills, which are all below the fold', () => {
    expect(carousel()).toContain("loading=\"lazy\"")
  })

  it('marks the stills decorative rather than inventing alt text per frame', () => {
    // A still has no caption in the payload; an invented one is worse than none,
    // and the section heading already names the title.
    expect(carousel()).toMatch(/alt=""/)
  })
})

describe('title detail page images section', () => {
  it('caps how many stills it asks for', () => {
    const code = page()
    expect(code).toContain('BACKDROP_LIMIT')
    expect(code).toContain('pickBackdrops(detail.images, BACKDROP_LIMIT)')
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/title-page-layout.test.ts`
Expected: FAIL — `components/backdrop-carousel.tsx` does not exist.

- [ ] **Step 3: Write the component**

Create `components/backdrop-carousel.tsx`:

```tsx
import Image from 'next/image'
import { RowScroller } from './row-scroller'
import { BACKDROP_SLOTS, buildImageUrl, getImageConfig, pickSize } from '@/server/tmdb/images'
import type { ImageAsset } from '@/server/tmdb/types'

export async function BackdropCarousel({ images, title }: { images: ImageAsset[]; title: string }) {
  if (images.length === 0) return null
  const config = await getImageConfig()
  const size = pickSize(config.backdrop_sizes, BACKDROP_SLOTS.still)

  return (
    <section className="mb-8" aria-labelledby="images-heading">
      <h2 id="images-heading" className="mb-3 px-6 text-lg font-semibold">
        Images from {title}
      </h2>
      <RowScroller label={`Images from ${title}`}>
        {images.map((asset) => {
          const src = buildImageUrl(config.secure_base_url, size, asset.file_path)
          if (!src) return null
          return (
            <div
              key={asset.file_path}
              className="relative aspect-video w-[280px] shrink-0 snap-start overflow-hidden rounded-md bg-white/5"
            >
              <Image src={src} alt="" fill sizes="280px" loading="lazy" className="object-cover" />
            </div>
          )
        })}
      </RowScroller>
    </section>
  )
}
```

`getImageConfig()` returns the `images` sub-object of `/configuration`, not the whole payload, so the sizes are read off `config` directly — there is no `config.images`.

- [ ] **Step 4: Wire it into the page**

In `app/title/[mediaType]/[id]/page.tsx`:

```tsx
import { BackdropCarousel } from '@/components/backdrop-carousel'
import { pickBackdrops, pickCast, pickTrailer, toTitleFacts } from '@/lib/title-detail'
```

Add next to `CAST_LIMIT`:

```tsx
const BACKDROP_LIMIT = 12
```

and render it after the cast section:

```tsx
      <div className="mt-4">
        <BackdropCarousel images={pickBackdrops(detail.images, BACKDROP_LIMIT)} title={title} />
      </div>
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/backdrop-carousel.tsx app/title/\[mediaType\]/\[id\]/page.tsx tests/title-page-layout.test.ts
git commit -m "$(cat <<'EOF'
Show the best-voted stills as a scrollable strip

TMDB returns dozens of backdrops per title; the highest-voted twelve are worth
showing and the rest are noise.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 9: Match the loading skeleton to the fuller page, then verify the slice

**Files:**
- Modify: `app/title/[mediaType]/[id]/loading.tsx`
- Test: `tests/loading-skeletons.test.ts` (add cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing importable.

- [ ] **Step 1: Read the current skeleton**

Run: `cat 'app/title/[mediaType]/[id]/loading.tsx'`

It was written in slice 3 to match the old, shorter page. Note its existing structure and class names before changing anything.

- [ ] **Step 2: Write the failing tests**

Add to `tests/loading-skeletons.test.ts`:

```ts
const titleLoading = () => readFileSync('app/title/[mediaType]/[id]/loading.tsx', 'utf8')

describe('title detail skeleton', () => {
  it('reserves the facts block the page now renders', () => {
    expect(titleLoading()).toContain('animate-pulse')
    expect(titleLoading()).toMatch(/grid|sm:grid-cols-2/)
  })

  it('reserves a row below the fold for the cast', () => {
    // Without it the page grows by a full row height when the data lands and
    // everything below jumps.
    expect(titleLoading()).toContain('RowSkeleton')
  })
})
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm vitest run tests/loading-skeletons.test.ts`
Expected: FAIL — the skeleton has neither a facts grid nor a `RowSkeleton`.

- [ ] **Step 4: Extend the skeleton**

Replace `app/title/[mediaType]/[id]/loading.tsx` with:

```tsx
import { RowSkeleton } from '@/components/row-skeleton'

export default function Loading() {
  return (
    <main>
      <div className="h-[45vh] min-h-[280px] w-full animate-pulse bg-white/5" />
      <div className="relative z-10 mx-auto -mt-24 flex max-w-5xl flex-col gap-8 px-6 md:flex-row">
        <div className="h-[330px] w-[220px] shrink-0 animate-pulse rounded-md bg-white/10" />
        <div className="flex-1 space-y-3 pt-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="grid gap-x-8 gap-y-2 pt-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-5 w-40 animate-pulse rounded bg-white/5" />
            ))}
          </div>
          <div className="h-6 w-1/2 animate-pulse rounded bg-white/5" />
          <div className="h-20 w-full animate-pulse rounded bg-white/5" />
        </div>
      </div>
      <div className="mt-12">
        <RowSkeleton title="Cast" />
      </div>
    </main>
  )
}
```

The `relative z-10 mx-auto -mt-24 flex max-w-5xl ...` classes are copied from the real page so the swap shifts nothing. The `h-4 w-32` bar that stood in for the old year-and-rating line is gone: the facts grid replaced that line.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/loading-skeletons.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full check suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: all four pass. Paste the output.

- [ ] **Step 7: Verify both media types in a browser**

With `pnpm dev` running, screenshot all three and report what you see:
- `http://localhost:3000/title/movie/27205` — facts, tagline, trailer, cast, stills
- `http://localhost:3000/title/tv/1396` — creator and seasons instead of director and runtime, **no** trailer section
- `http://localhost:3000/title/movie/999999999` — still 404s

- [ ] **Step 8: Commit and open the PR**

```bash
git add app/title/\[mediaType\]/\[id\]/loading.tsx tests/loading-skeletons.test.ts
git commit -m "$(cat <<'EOF'
Grow the detail skeleton to match the fuller page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
git push -u origin slice-4-detail
gh pr create --title "Fill out the title detail page from TMDB credits, videos and images" --body "$(cat <<'EOF'
append_to_response=credits,videos,images returns all three inline, so a detail
page still costs one TMDB request. The page gains a director or creator, dates,
length, rating, status and studio; a click-to-play trailer; the top ten cast;
and the twelve best-voted stills.

Movies and TV name these things in different fields and either can be missing
any of them, so the branching lives in one pure lib module tested against both
captured payloads. Breaking Bad genuinely returns zero videos and an empty
episode_run_time; both are covered.

Verified: build, lint, typecheck and tests pass; /title/movie/27205 and
/title/tv/1396 checked in a browser, including that no YouTube request is made
before the play button is clicked.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

# Slice C — Genre navigation (branch `slice-4-genres`)

Cut the branch once slice B merges:

```bash
git checkout main && git pull --ff-only && git checkout -b slice-4-genres
```

### Task 10: Merge the two genre lists by name

**Files:**
- Create: `lib/genres.ts`
- Test: `tests/genres.test.ts` (create)

**Interfaces:**
- Consumes: `Genre` from `@/server/tmdb/types`.
- Produces, from `@/lib/genres`:
  - `interface MergedGenre { slug: string; name: string; movieId?: number; tvId?: number }`
  - `slugify(name: string): string`
  - `mergeGenres(movieGenres: Genre[], tvGenres: Genre[]): MergedGenre[]`

- [ ] **Step 1: Capture the TV genre fixture**

```bash
set -a && . ./.env.local >/dev/null 2>&1 && set +a
curl -s -H "Authorization: Bearer $TMDB_ACCESS_TOKEN" \
  "https://api.themoviedb.org/3/genre/tv/list" \
  | python3 -m json.tool > tests/fixtures/tmdb/genres-tv.json
python3 -c "
import json
d = json.load(open('tests/fixtures/tmdb/genres-tv.json'))
print(len(d['genres']), [g['name'] for g in d['genres']])
"
```

Expected: 16 genres, including "Action & Adventure" and "Sci-Fi & Fantasy" and **not** "Action" or "Science Fiction".

- [ ] **Step 2: Write the failing tests**

Create `tests/genres.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mergeGenres, slugify } from '@/lib/genres'
import type { Genre } from '@/server/tmdb/types'

const list = (name: string): Genre[] =>
  JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, 'utf8')).genres

const movieGenres = () => list('genres-movie')
const tvGenres = () => list('genres-tv')

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Science Fiction')).toBe('science-fiction')
    expect(slugify('TV Movie')).toBe('tv-movie')
  })

  it('spells out the ampersand rather than dropping it', () => {
    // Dropping it would collapse "Action & Adventure" and "Action Adventure"
    // onto one slug, and "Sci-Fi & Fantasy" reads as nonsense without it.
    expect(slugify('Action & Adventure')).toBe('action-and-adventure')
    expect(slugify('Sci-Fi & Fantasy')).toBe('sci-fi-and-fantasy')
    expect(slugify('War & Politics')).toBe('war-and-politics')
  })
})

describe('mergeGenres', () => {
  it('carries both ids for a name that exists on both sides', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const drama = merged.find((genre) => genre.slug === 'drama')
    expect(drama).toEqual({ slug: 'drama', name: 'Drama', movieId: 18, tvId: 18 })
  })

  it('carries only a movie id for a movie-only genre', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const history = merged.find((genre) => genre.slug === 'history')
    expect(history?.movieId).toBe(36)
    expect(history?.tvId).toBeUndefined()
  })

  it('carries only a tv id for a tv-only genre', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const reality = merged.find((genre) => genre.slug === 'reality')
    expect(reality?.tvId).toBe(10764)
    expect(reality?.movieId).toBeUndefined()
  })

  it('keeps Action and Action & Adventure apart, because TMDB does', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    const action = merged.find((genre) => genre.slug === 'action')
    const actionAdventure = merged.find((genre) => genre.slug === 'action-and-adventure')
    expect(action).toEqual({ slug: 'action', name: 'Action', movieId: 28 })
    expect(actionAdventure).toEqual({
      slug: 'action-and-adventure',
      name: 'Action & Adventure',
      tvId: 10759,
    })
  })

  it('produces the union of both lists, deduplicated by name', () => {
    const merged = mergeGenres(movieGenres(), tvGenres())
    expect(merged).toHaveLength(27)
    expect(new Set(merged.map((genre) => genre.slug)).size).toBe(27)
  })

  it('sorts alphabetically by name', () => {
    const names = mergeGenres(movieGenres(), tvGenres()).map((genre) => genre.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('never produces an entry with neither id', () => {
    for (const genre of mergeGenres(movieGenres(), tvGenres())) {
      expect(genre.movieId ?? genre.tvId).toBeDefined()
    }
  })
})
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm vitest run tests/genres.test.ts`
Expected: FAIL — `@/lib/genres` does not exist.

- [ ] **Step 4: Write the module**

Create `lib/genres.ts`:

```ts
import type { Genre } from '@/server/tmdb/types'

export interface MergedGenre {
  slug: string
  name: string
  movieId?: number
  tvId?: number
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// TMDB's movie and TV genre lists are disjoint ID spaces: Action is 28 for movies
// and has no TV counterpart, while TV has Action & Adventure at 10759. The eight
// names that appear on both sides do share an ID, which is what makes keying the
// merge on the name safe.
export function mergeGenres(movieGenres: Genre[], tvGenres: Genre[]): MergedGenre[] {
  const merged = new Map<string, MergedGenre>()

  const add = (genre: Genre, key: 'movieId' | 'tvId') => {
    const slug = slugify(genre.name)
    const existing = merged.get(slug) ?? { slug, name: genre.name }
    merged.set(slug, { ...existing, [key]: genre.id })
  }

  for (const genre of movieGenres) add(genre, 'movieId')
  for (const genre of tvGenres) add(genre, 'tvId')

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/genres.test.ts`
Expected: PASS, all 9 cases. The union length of 27 is the assertion most likely to catch a slugify bug — if it comes out lower, two distinct names collapsed onto one slug.

- [ ] **Step 6: Commit**

```bash
git add lib/genres.ts tests/genres.test.ts tests/fixtures/tmdb/genres-tv.json
git commit -m "$(cat <<'EOF'
Merge TMDB's two disjoint genre lists into one

Movies and TV do not share a genre ID space, and only eight of the 35 names
appear on both sides. Keying on the name gives one list of 27 that can address
either side, without a synonym table TMDB could invalidate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 11: TV genre and TV discover endpoints, with a purgeable tag

**Files:**
- Modify: `server/tmdb/cache.ts:12,29`
- Modify: `server/tmdb/endpoints/lists.ts`
- Create: `tests/fixtures/tmdb/discover-tv.json`
- Test: `tests/tmdb/cache.test.ts` (add cases), `tests/tmdb/endpoints.test.ts` (add cases)

**Interfaces:**
- Consumes: `tmdbFetch`, `REVALIDATE`, `tags`.
- Produces, from `@/server/tmdb/endpoints/lists`: `getTvGenres(): Promise<Genre[]>`, `discoverTvByGenre(genreId: number): Promise<TrendingItem[]>`. `ListName` in `@/server/tmdb/cache` gains `` `tv-genre-${number}` ``.

- [ ] **Step 1: Capture the discover/tv fixture**

```bash
set -a && . ./.env.local >/dev/null 2>&1 && set +a
curl -s -H "Authorization: Bearer $TMDB_ACCESS_TOKEN" \
  "https://api.themoviedb.org/3/discover/tv?with_genres=10765&sort_by=popularity.desc" \
  | python3 -m json.tool > tests/fixtures/tmdb/discover-tv.json
python3 -c "
import json
d = json.load(open('tests/fixtures/tmdb/discover-tv.json'))
print(len(d['results']), sorted(d['results'][0].keys()))
"
```

Expected: 20 results whose keys match `TvListItem` — `name`, `first_air_date`, `genre_ids`, no `title`.

- [ ] **Step 2: Write the failing tests**

Add to `tests/tmdb/cache.test.ts`, inside `describe('isKnownTag', ...)`:

```ts
  it('accepts the tv genre list tag', () => {
    expect(isKnownTag(tags.list('tv-genre-10765'))).toBe(true)
  })

  it('still rejects a malformed tv genre tag', () => {
    expect(isKnownTag('tmdb:list:tv-genre-')).toBe(false)
    expect(isKnownTag('tmdb:list:tv-genre-abc')).toBe(false)
  })
```

Add to `tests/tmdb/endpoints.test.ts`, inside `describe('list endpoints', ...)`:

```ts
  it('getTvGenres reads the tv list and shares the genres tag', async () => {
    const fetchMock = respondWith(fixture('genres-tv'))
    vi.stubGlobal('fetch', fetchMock)
    const { getTvGenres } = await import('@/server/tmdb/endpoints/lists')

    const genres = await getTvGenres()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/genre/tv/list')
    expect(init.next.tags).toContain(tags.genres)
    expect(init.next.revalidate).toBe(REVALIDATE.genres)
    expect(genres.some((genre) => genre.name === 'Action & Adventure')).toBe(true)
  })

  it('discoverTvByGenre filters on the tv genre and tags its own list', async () => {
    const fetchMock = respondWith(fixture('discover-tv'))
    vi.stubGlobal('fetch', fetchMock)
    const { discoverTvByGenre } = await import('@/server/tmdb/endpoints/lists')

    const results = await discoverTvByGenre(10765)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/discover/tv')
    expect(url).toContain('with_genres=10765')
    expect(init.next.tags).toContain(tags.list('tv-genre-10765'))
    expect(results[0]!.media_type).toBe('tv')
    expect(results[0]).toHaveProperty('name')
  })
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm vitest run tests/tmdb`
Expected: FAIL — `getTvGenres` is not exported and `isKnownTag` rejects `tmdb:list:tv-genre-10765`.

- [ ] **Step 4: Extend the tag vocabulary**

In `server/tmdb/cache.ts`, change:

```ts
type ListName = 'now-playing' | 'top-rated' | 'airing-today' | `genre-${number}`
```

to:

```ts
type ListName =
  | 'now-playing'
  | 'top-rated'
  | 'airing-today'
  | `genre-${number}`
  | `tv-genre-${number}`
```

and change:

```ts
const LIST_TAG = /^tmdb:list:(?:now-playing|top-rated|airing-today|genre-\d+)$/
```

to:

```ts
const LIST_TAG = /^tmdb:list:(?:now-playing|top-rated|airing-today|genre-\d+|tv-genre-\d+)$/
```

Leave the comment above `isKnownTag` in place — it explains exactly why these two lines must move together.

- [ ] **Step 5: Add the two endpoints**

Append to `server/tmdb/endpoints/lists.ts`:

```ts
export async function getTvGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<{ genres: Genre[] }>('/genre/tv/list', {
    revalidate: REVALIDATE.genres,
    tags: [tags.genres],
  })
  return response.genres
}

export async function discoverTvByGenre(genreId: number): Promise<TrendingItem[]> {
  const page = await tmdbFetch<PagedResponse<TvListItem>>('/discover/tv', {
    searchParams: { with_genres: genreId, sort_by: 'popularity.desc' },
    revalidate: REVALIDATE.list,
    tags: [tags.list(`tv-genre-${genreId}`)],
  })
  return page.results.map((item) => ({ ...item, media_type: 'tv' as const }))
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/tmdb && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/tmdb/cache.ts server/tmdb/endpoints/lists.ts tests/tmdb tests/fixtures/tmdb/discover-tv.json
git commit -m "$(cat <<'EOF'
Add the tv genre and tv discover endpoints

The new tv-genre list tag is added to isKnownTag in the same change, because a
tag the validator does not recognise cannot be purged through /api/revalidate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 12: Serve the merged list

**Files:**
- Create: `server/tmdb/endpoints/genres.ts`
- Test: `tests/tmdb/endpoints.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `getMovieGenres`, `getTvGenres` from `./lists`; `mergeGenres`, `MergedGenre` from `@/lib/genres`.
- Produces: `getMergedGenres(): Promise<MergedGenre[]>` and `findGenreBySlug(slug: string): Promise<MergedGenre | null>` from `@/server/tmdb/endpoints/genres`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/tmdb/endpoints.test.ts`:

```ts
describe('merged genres', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TMDB_ACCESS_TOKEN = 'test-token'
  })
  afterEach(() => vi.unstubAllGlobals())

  const respondPerUrl = () =>
    vi.fn().mockImplementation((url: string) => {
      const body = url.includes('/genre/tv/list') ? fixture('genres-tv') : fixture('genres-movie')
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })

  it('reads both lists and returns their union', async () => {
    vi.stubGlobal('fetch', respondPerUrl())
    const { getMergedGenres } = await import('@/server/tmdb/endpoints/genres')

    const merged = await getMergedGenres()

    expect(merged).toHaveLength(27)
    expect(merged.find((genre) => genre.slug === 'drama')).toEqual({
      slug: 'drama',
      name: 'Drama',
      movieId: 18,
      tvId: 18,
    })
  })

  it('finds a genre by slug', async () => {
    vi.stubGlobal('fetch', respondPerUrl())
    const { findGenreBySlug } = await import('@/server/tmdb/endpoints/genres')

    expect((await findGenreBySlug('sci-fi-and-fantasy'))?.tvId).toBe(10765)
  })

  it('returns null for a slug TMDB does not have', async () => {
    vi.stubGlobal('fetch', respondPerUrl())
    const { findGenreBySlug } = await import('@/server/tmdb/endpoints/genres')

    expect(await findGenreBySlug('not-a-genre')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/tmdb/endpoints.test.ts`
Expected: FAIL — `@/server/tmdb/endpoints/genres` does not exist.

- [ ] **Step 3: Write the module**

Create `server/tmdb/endpoints/genres.ts`:

```ts
import { getMovieGenres, getTvGenres } from './lists'
import { mergeGenres, type MergedGenre } from '@/lib/genres'

export async function getMergedGenres(): Promise<MergedGenre[]> {
  const [movies, tv] = await Promise.all([getMovieGenres(), getTvGenres()])
  return mergeGenres(movies, tv)
}

export async function findGenreBySlug(slug: string): Promise<MergedGenre | null> {
  const merged = await getMergedGenres()
  return merged.find((genre) => genre.slug === slug) ?? null
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/tmdb/endpoints.test.ts && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/tmdb/endpoints/genres.ts tests/tmdb/endpoints.test.ts
git commit -m "$(cat <<'EOF'
Serve one merged genre list from both TMDB lists

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 13: The genre page

**Files:**
- Create: `app/genre/[slug]/page.tsx`
- Create: `app/genre/[slug]/loading.tsx`
- Test: `tests/genre-page.test.ts` (create)

**Interfaces:**
- Consumes: `findGenreBySlug` from `@/server/tmdb/endpoints/genres`; `discoverByGenre`, `discoverTvByGenre` from `@/server/tmdb/endpoints/lists`; `Row`, `RowSkeleton`, `toCardItem`.
- Produces: the route `/genre/[slug]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/genre-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/genre/[slug]/page.tsx', 'utf8')

describe('genre page', () => {
  it('404s on a slug TMDB does not know', () => {
    const code = page()
    expect(code).toContain('findGenreBySlug')
    expect(code).toContain('notFound()')
  })

  it('renders a movie row and a tv row from their own endpoints', () => {
    const code = page()
    expect(code).toContain('discoverByGenre')
    expect(code).toContain('discoverTvByGenre')
  })

  it('renders each row only when that side has an id', () => {
    // Ten of the 27 merged genres exist on one side only; rendering an empty
    // row for the other side would be a heading over nothing.
    const code = page()
    expect(code).toMatch(/genre\.movieId (!==|&&)/)
    expect(code).toMatch(/genre\.tvId (!==|&&)/)
  })

  it('suspends each row separately so one slow list does not hold the other', () => {
    const code = page()
    expect(code).toContain('<Suspense')
    expect(code).toContain('RowSkeleton')
  })

  it('names the genre in the page metadata', () => {
    expect(page()).toContain('generateMetadata')
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/genre-page.test.ts`
Expected: FAIL — the route does not exist.

- [ ] **Step 3: Write the page**

Create `app/genre/[slug]/page.tsx`:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Row } from '@/components/row'
import { RowSkeleton } from '@/components/row-skeleton'
import { toCardItem } from '@/lib/media'
import { discoverByGenre, discoverTvByGenre } from '@/server/tmdb/endpoints/lists'
import { findGenreBySlug } from '@/server/tmdb/endpoints/genres'

export async function generateMetadata({
  params,
}: PageProps<'/genre/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const genre = await findGenreBySlug(slug)
  if (!genre) notFound()

  return { title: genre.name, description: `${genre.name} movies and TV shows.` }
}

async function MovieRow({ genreId }: { genreId: number }) {
  const items = await discoverByGenre(genreId)
  return <Row title="Movies" items={items.map((item) => toCardItem(item))} priorityCount={4} />
}

async function SeriesRow({ genreId }: { genreId: number }) {
  const items = await discoverTvByGenre(genreId)
  return <Row title="Series" items={items.map((item) => toCardItem(item))} />
}

export default async function GenrePage({ params }: PageProps<'/genre/[slug]'>) {
  const { slug } = await params
  const genre = await findGenreBySlug(slug)
  if (!genre) notFound()

  return (
    <main className="pt-8">
      <h1 className="mb-6 px-6 text-3xl font-bold tracking-tight">{genre.name}</h1>
      {genre.movieId !== undefined && (
        <Suspense fallback={<RowSkeleton title="Movies" />}>
          <MovieRow genreId={genre.movieId} />
        </Suspense>
      )}
      {genre.tvId !== undefined && (
        <Suspense fallback={<RowSkeleton title="Series" />}>
          <SeriesRow genreId={genre.tvId} />
        </Suspense>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Write the loading state**

Create `app/genre/[slug]/loading.tsx`:

```tsx
import { RowSkeleton } from '@/components/row-skeleton'

export default function Loading() {
  return (
    <main className="pt-8">
      <div className="mb-6 ml-6 h-9 w-56 animate-pulse rounded bg-white/10" />
      <RowSkeleton title="Movies" />
      <RowSkeleton title="Series" />
    </main>
  )
}
```

The `h-9` matches the rendered height of the page's `text-3xl` heading, and `mb-6 ml-6` mirrors its `mb-6 px-6`, so the heading does not jump when the genre name resolves.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/genre-page.test.ts && pnpm typecheck`
Expected: PASS. `typecheck` runs `next typegen` first, which generates `PageProps<'/genre/[slug]'>`; if it reports that type as unknown, the route file was not saved at the path above.

- [ ] **Step 6: Commit**

```bash
git add app/genre tests/genre-page.test.ts
git commit -m "$(cat <<'EOF'
Add a genre page with a movie row and a series row

Each row suspends on its own, and a genre that exists on only one side renders
only that row rather than a heading over an empty strip.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 14: The header menu

**Files:**
- Create: `components/genres-menu.tsx`
- Modify: `components/site-header.tsx`
- Test: `tests/genres-menu.test.ts` (create), `tests/site-header.test.ts` (add case)

**Interfaces:**
- Consumes: `MergedGenre` from `@/lib/genres`; `getMergedGenres` from `@/server/tmdb/endpoints/genres` (called in `SiteHeader`, not in the client component).
- Produces: `GenresMenu({ genres }: { genres: MergedGenre[] })` from `@/components/genres-menu`.

- [ ] **Step 1: Write the failing tests**

Create `tests/genres-menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const menu = () => readFileSync('components/genres-menu.tsx', 'utf8')

describe('genres menu', () => {
  it('never imports from server/, which server-only would turn into a build error', () => {
    expect(menu()).not.toContain("from '@/server/")
  })

  it('opens on hover and on click, not on hover alone', () => {
    // A hover-only menu is unreachable by keyboard and unusable on touch.
    const code = menu()
    expect(code).toContain('onMouseEnter')
    expect(code).toContain('onClick')
  })

  it('announces its state to assistive technology', () => {
    const code = menu()
    expect(code).toContain('aria-expanded')
    expect(code).toContain('aria-controls')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    const code = menu()
    expect(code).toContain("'Escape'")
    expect(code).toMatch(/\.focus\(\)/)
  })

  it('closes when focus leaves the menu entirely', () => {
    expect(menu()).toContain('relatedTarget')
  })

  it('hides the panel from the tree when closed, rather than only visually', () => {
    expect(menu()).toMatch(/hidden=\{!open\}/)
  })

  it('scrolls rather than growing past the viewport', () => {
    const code = menu()
    expect(code).toContain('overflow-y-auto')
    expect(code).toMatch(/max-h-/)
  })

  it('links each genre to its own page', () => {
    expect(menu()).toMatch(/href=\{`\/genre\/\$\{genre\.slug\}`\}/)
  })
})
```

Add to `tests/site-header.test.ts`:

```ts
  it('fetches the merged genre list on the server and hands it to the menu', () => {
    const code = header()
    expect(code).toContain("from '@/server/tmdb/endpoints/genres'")
    expect(code).toContain('await getMergedGenres()')
    expect(code).toMatch(/<GenresMenu genres=\{genres\} \/>/)
  })
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run tests/genres-menu.test.ts tests/site-header.test.ts`
Expected: FAIL — `components/genres-menu.tsx` does not exist.

- [ ] **Step 3: Write the menu**

Create `components/genres-menu.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { MergedGenre } from '@/lib/genres'

export function GenresMenu({ genres }: { genres: MergedGenre[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="rounded py-1 text-sm text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Genres
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-30 max-h-[70vh] w-[min(90vw,34rem)] overflow-y-auto rounded-md border border-white/10 bg-[var(--background)] p-4 shadow-2xl"
      >
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {genres.map((genre) => (
            <li key={genre.slug}>
              <Link
                href={`/genre/${genre.slug}`}
                onClick={() => setOpen(false)}
                className="block rounded py-1 text-sm text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {genre.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the header**

In `components/site-header.tsx`, add the imports:

```tsx
import { GenresMenu } from '@/components/genres-menu'
import { getMergedGenres } from '@/server/tmdb/endpoints/genres'
```

Change the opening of the function to fetch both in parallel:

```tsx
export async function SiteHeader() {
  const [session, genres] = await Promise.all([auth(), getMergedGenres()])
```

and insert `<GenresMenu genres={genres} />` immediately after the Search link.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS, including the pre-existing site-header cases.

- [ ] **Step 6: Commit**

```bash
git add components/genres-menu.tsx components/site-header.tsx tests/genres-menu.test.ts tests/site-header.test.ts
git commit -m "$(cat <<'EOF'
Reach every genre from the header

A disclosure rather than a hover-only dropdown: hover opens it for a mouse,
click or Enter opens it for everything else, and Escape closes it and returns
focus to the trigger. The list is fetched on the server and handed down as
plain data, so the client component never touches server/.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```

---

### Task 15: Verify the slice end to end

**Files:** none modified unless a defect turns up.

- [ ] **Step 1: Run the full check suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: all four pass. Paste the output.

- [ ] **Step 2: Exercise the menu by keyboard in a browser**

With `pnpm dev` running, use the chrome-devtools MCP tools on `http://localhost:3000`:
- Tab to the Genres button, press Enter, confirm the panel opens and `aria-expanded` becomes `true`.
- Tab into the panel, confirm the focus ring is visible on the genre links.
- Press Escape, confirm the panel closes and focus is back on the Genres button.
- Hover the button with the mouse and confirm it opens without a click.
- Confirm the panel scrolls rather than running off the viewport, with all 27 genres reachable.

Report each result.

- [ ] **Step 3: Exercise the genre pages**

- `http://localhost:3000/genre/drama` — both a Movies row and a Series row.
- `http://localhost:3000/genre/history` — Movies row only (movie-only genre).
- `http://localhost:3000/genre/reality` — Series row only (TV-only genre).
- `http://localhost:3000/genre/not-a-genre` — 404.

Screenshot the first three and report.

- [ ] **Step 4: Confirm the new cache tag is purgeable**

With `REVALIDATE_SECRET` set in `.env.local`:

```bash
set -a && . ./.env.local >/dev/null 2>&1 && set +a
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/revalidate \
  -H "content-type: application/json" \
  -H "authorization: Bearer $REVALIDATE_SECRET" \
  -d '{"tag":"tmdb:list:tv-genre-10765"}'
```

Expected: `200`. If it returns 400, `isKnownTag` was not extended. Check the auth header name against `app/api/revalidate/route.ts` before concluding anything — read the route, do not guess its contract.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin slice-4-genres
gh pr create --title "Reach every genre from the header" --body "$(cat <<'EOF'
TMDB's movie and TV genre lists are disjoint ID spaces — Action is 28 for
movies and has no TV counterpart, while TV has Action & Adventure at 10759 —
and only eight of the 35 names appear on both sides. Merging on the name gives
one list of 27 that can address either side.

The header carries a Genres disclosure that opens on hover, click or Enter and
closes on Escape. /genre/[slug] renders a Movies row and a Series row, each
suspending on its own, and omits the row for a side the genre does not exist on.

The new tv-genre cache tag is added to isKnownTag in the same change, so it can
be purged through /api/revalidate.

Verified: build, lint, typecheck and tests pass; the menu exercised by keyboard
and mouse in a browser; drama, history, reality and an unknown slug all checked;
the new tag purges with a 200.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UZxNoazJQJ8M74TZqM2HgY
EOF
)"
```
