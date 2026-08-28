# Slice 1 — TMDB browse path and deploy parity

Date: 2026-08-28
Status: approved, not yet implemented

## Context

The repository contains `CLAUDE.md`, a `LICENSE`, and nothing else. `CLAUDE.md`
describes a complete application: a TMDB-backed browsing UI, authenticated
watchlists in our own Postgres, and two first-class deploy targets.

That is more than one implementation plan can carry. It decomposes into three
slices, each with its own spec, plan, and implementation cycle:

1. **This slice.** The TMDB read path (home, detail, search) plus the deployment
   substrate: `server/db/client.ts`, `/api/health`, and a Docker image that has been
   built and run.
2. Auth.js sessions, the `users`/`accounts`/`sessions`/`watchlist_items` schema,
   and the optimistic watchlist toggle.
3. Polish: cache-tag revalidation surfaces, accessibility audit, skeleton
   refinement, CI.

Deployment substrate belongs in slice 1 rather than slice 3 for two reasons.
`CLAUDE.md` treats the Docker image as first-class and defines "done" for
runtime-dependent changes as an image that builds, starts, and serves a request;
deferring that defers the riskiest verification to the end. And the `HEALTHCHECK`
the Docker section requires depends on `/api/health`, which depends on
`server/db/client.ts`, so the database client cannot be postponed either.

## Decisions

Each of these was resolved with the human before design; the rationale is
recorded so a later reader does not reopen a settled question.

### One home with mixed rows

A single `/` carries the hero and all rows, drawn from both media types. Each
row is configured with its own endpoint and its own `media_type`. Detail pages
live at `/title/[mediaType]/[id]`.

The alternative — separate `/movies` and `/tv` sections — types more cleanly per
media type but needs two homes and more navigation chrome than the Netflix
reference feel wants. More importantly, mixed rows force `media_type` to be
explicit at every layer from day one, and slice 2's unique constraint is
`(user_id, tmdb_id, media_type)`. Retrofitting that discriminator later is where
the bugs would land.

### Search is URL-driven and debounced

`/search?q=...` is the source of truth. A small client component owns the input
and pushes debounced updates into the URL; the results list is a server
component reading `q` from `searchParams`.

This keeps results shareable and the back button correct, confines `'use client'`
to the input, and — decisively — keeps the TMDB call on the server. An overlay
fetching results client-side would need a route-handler proxy to avoid putting
the TMDB token anywhere near the browser, which is a worse shape for no gain.

### The database driver is chosen once, by runtime

`CLAUDE.md` originally named `@neondatabase/serverless` as *the* driver while
also requiring a pooled TCP connection in the container, tolerating "any Postgres
URL", and shipping a `docker-compose.yml` with a local Postgres. Those cannot all
hold with one driver: Drizzle's `neon-http` is HTTP-only and Neon-only, and the
`neon-serverless` WebSocket pool still needs a Neon endpoint or a `wsproxy`
sidecar, which the Docker section forbids.

`server/db/client.ts` therefore branches once, at module load, on the runtime:
`drizzle-orm/neon-http` on Vercel, `drizzle-orm/node-postgres` with a real `Pool`
in the container. This adds `pg` and `@types/pg`. `CLAUDE.md`'s Stack section has
been amended to say so.

Both branches are constructed against the same schema, so the exported `db` has
one type. No caller learns which driver is live, and no driver type appears in
any function signature.

### Vitest

`CLAUDE.md` requires `pnpm test` to pass but names no runner. Vitest is added as
a devDependency: native TypeScript and ESM, minimal configuration alongside Next.

## Toolchain

Verified present on the development machine: Node v24.19.0, Docker 29.6.2. pnpm
is **not** installed and will be enabled through `corepack`.

Next.js 16 (App Router), TypeScript in strict mode, Tailwind CSS,
`output: 'standalone'`.

Note for implementation: in Next 16 `revalidateTag` takes a profile argument —
`revalidateTag(tag, 'max')`. The single-argument form is deprecated and behaves
like `{ expire: 0 }`, blocking the next request until revalidation completes.

## Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/` | server | Hero plus rows |
| `/title/[mediaType]/[id]` | server | Detail page |
| `/search?q=` | server, client input | Search |
| `/api/health` | route handler | Liveness plus database reachability |

`mediaType` is parsed against the union `'movie' | 'tv'` at the route boundary.
Anything else calls `notFound()`. This is the only place the union is enforced,
and every downstream consumer — including slice 2's watchlist key — receives an
already-narrowed value.

## `server/tmdb/`

Every TMDB request in the application originates here. No component, page, or
handler outside this directory calls `fetch` against `api.themoviedb.org`.

- **`client.ts`** — a single `tmdbFetch<T>(path, { searchParams, revalidate, tags })`.
  It attaches the bearer token, builds the URL, applies cache options, and
  converts a non-OK response into a typed error rather than returning a partial
  body. The file carries `import 'server-only'` so that importing it from a
  client component fails the build instead of leaking the token into the bundle.
- **`endpoints/`** — one module per endpoint family, each exporting a wrapper
  with an explicit response type.
- **`types.ts`** — response types derived from real payloads, never guessed.
- **`images.ts`** — reads `/configuration` for the image CDN base URL and the
  valid size lists, and exposes helpers that map a UI slot to the smallest size
  that looks right for it. Sizes are not hardcoded from memory.

Endpoints in this slice: `/configuration`, `/trending/all/week`,
`/movie/now_playing`, `/movie/top_rated`, `/tv/airing_today`,
`/genre/movie/list`, `/discover/movie`, `/movie/{id}`, `/tv/{id}`,
`/search/multi`.

### Deriving the types

The first implementation task, before any type is written, is to call each
endpoint above once and save the JSON responses. Types are then written against
those saved payloads and the saved payloads become the test fixtures.

This is not optional care. `CLAUDE.md` records that TMDB's field names and
pagination behaviour differ between endpoints and between API versions, so a
type generalised from a neighbouring endpoint is a type that is probably wrong.
`/trending/all/week` in particular returns a mixed list whose items carry a
`media_type` discriminator that the single-type list endpoints do not, and the
detail endpoints are not simply the list item plus extra fields.

## Caching

Each endpoint family gets a cache tag and a revalidation window scaled to how
fast that data actually changes:

| Family | Tag | Volatility |
| --- | --- | --- |
| Configuration | `tmdb:configuration` | Lowest |
| Trending | `tmdb:trending` | Highest |
| Curated lists | `tmdb:list:<name>` | Low |
| Genres | `tmdb:genres` | Lowest |
| Title detail | `tmdb:title:<type>:<id>` | Low |
| Search | `tmdb:search` | Short window, keyed by query |

Search is cached with a short window rather than `no-store`: debounced typing
multiplies requests, and an uncached search box is the one surface in this slice
that could plausibly approach a rate limit.

The concrete second values are set during implementation, after reading TMDB's
current published rate-limit and caching guidance. They are not assumed here.
The home page fans out to roughly six requests, which is modest, but the limit
itself is checked rather than remembered.

## Data layer

`server/db/client.ts` selects the driver once and exposes it through `getDb()`, which builds the
instance on first call and memoises it.
Nothing above this file knows which driver is in use, and query code takes and
returns no driver-specific types.

The branch reads an explicit `DB_DRIVER` environment variable accepting
`neon-http` or `node-postgres`. When it is unset, the default is `neon-http` if
`process.env.VERCEL` is present and `node-postgres` otherwise. An explicit
variable rather than inference alone means the container can be pointed at Neon,
and a Vercel preview at a plain Postgres, without a code change — and it makes
the selection greppable instead of implicit. The branch is evaluated once, on the first
`getDb()` call rather than at module load, and memoised — never per call. Laziness is not a
style choice: `next build` evaluates route modules while collecting page data, so an instance
built at import time fails any build without `DATABASE_URL`, including the container image
build. An accessor is used rather than a lazy proxy: a proxy over a Drizzle instance needs
every trap to stay consistent, and a missing one poisons the shared singleton for the life of
the process.

`drizzle.config.ts` and `server/db/schema.ts` are created in this slice. `schema.ts`
starts with no table definitions: it exists so that `server/db/client.ts` can be typed
against it and so slice 2 adds tables to a file that is already wired up. The
application tables — Auth.js's `users`, `accounts`, `sessions`, and
`watchlist_items` — are slice 2's work, along with the first migration. No
migration is generated in this slice, because there is no schema to migrate.

`/api/health` executes `select 1` through the exported instance and returns a
non-200 status when that fails, so the container's `HEALTHCHECK` reports
unhealthy on a database outage rather than merely on a dead process.

Migrations never run at container start. They are a separate step, so scaling to
several containers cannot race.

## UI

Dark, poster-forward, minimal chrome. Server components throughout; `'use client'`
appears only on the search input and on the row's scroll controls.

**Rows** are a native horizontally-scrollable list with CSS scroll snapping,
which gives correct touch and trackpad behaviour without JavaScript. Arrow
buttons are layered on for pointer users. Keyboard navigation uses real focus
order into the row's links rather than a synthetic key handler, so tabbing
scrolls the row as a side effect of focus. Every control has an accessible name.

**Streaming.** Each row is its own Suspense boundary with a skeleton matching its
final layout, so a slow endpoint delays one row instead of the page. Loading
states are skeletons, never spinners.

**Posters** use `next/image` with an explicit TMDB size segment, lazy below the
fold, and `alt` set to the title.

**Footer** carries the TMDB attribution, the TMDB logo, and the statement that
the application is not endorsed or certified by TMDB. The exact wording is taken
from TMDB's current terms of use at implementation time, not written from
memory.

## Docker

Multi-stage: deps, build, runtime, on a `node:24` base. The runtime stage copies
`.next/standalone`, `.next/static`, and `public`, and nothing else — no source,
no build-stage `node_modules`, no dev dependencies. It runs as a non-root user,
honours `PORT` and `HOSTNAME`, and defaults `HOSTNAME` to `0.0.0.0`.

`.dockerignore` excludes `node_modules`, `.next`, `.git`, and `.env*`. That
exclusion is verified by inspecting the built image, not assumed.

`HEALTHCHECK` hits `/api/health`.

`docker-compose.yml` brings up the application plus a local Postgres for local
work. It is a convenience for development, not the deployment unit; the image
alone, given an env file and a reachable Postgres, is a working instance.

No application code path may depend on a Vercel-specific runtime API.

## Testing

Vitest, with no network access in any test. Fixtures are the payloads saved
while deriving the types.

Covered in this slice:

- `tmdbFetch` — URL and query-string construction, bearer header presence, cache
  options passed through, and the non-OK response path producing an error rather
  than a partial body.
- Response parsing for each endpoint wrapper against its saved fixture, including
  the mixed-media discriminator on the trending payload.
- The image URL builder — slot to size mapping, and behaviour when TMDB returns a
  null poster path.
- `mediaType` route-parameter validation, accepting `movie` and `tv` and
  rejecting everything else.

## Definition of done

This slice is complete when all of the following have been run and their output
shown:

1. `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
2. `/`, `/title/movie/<id>`, `/title/tv/<id>`, and `/search?q=` have each been
   loaded and render real TMDB data.
3. `docker build` succeeds, the container starts, `/api/health` returns 200
   against a real database, and the home page serves from the container.
4. The built image has been inspected and contains no `.env` file and no
   credentials.
5. Anything not verified is stated plainly as unverified.

### Which database, and when

`DATABASE_URL` for Neon arrives with the first Vercel deployment, which happens
after this slice. That does not block the data layer. The `docker-compose`
Postgres is a real database available locally today, and because the container
path speaks plain Postgres over TCP, every item above can be satisfied against
it without Neon existing.

The consequence is that the `node-postgres` branch of `server/db/client.ts` is verified
in this slice and the `neon-http` branch is not. The Neon branch ships written
but untested, recorded as such, and confirming it is the first task of the
deploy step rather than a loose end. This is the one deliberate verification gap
in the slice.

## Out of scope

Authentication, the watchlist and its tables, any user-owned data, and CI. Genre
rows use `/discover/movie` with a genre filter; personalised or recommendation
rows are not part of any slice yet.

## Risks

**Unverified at the time of writing:** every TMDB payload shape, TMDB's current
rate-limit guidance, the current image size lists, the exact attribution
wording, and the validity of the TMDB token itself. No TMDB endpoint has been called in the course of writing this design.
Each is listed above as a step that begins with reading the real response or the
real document, and none of it is recorded here as fact.

The residual risk is that a payload differs enough from expectation to change a
component's shape — most plausibly the trending endpoint's mixed-media items, or
a detail endpoint's nested objects. This is why type derivation is the first
implementation task rather than a step during UI work: the cost of being wrong is
lowest before components exist.
