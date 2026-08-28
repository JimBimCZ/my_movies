# my_movies

A personal streaming catalogue. It pulls movie and TV data from [TMDB](https://www.themoviedb.org/) and presents it in a Netflix-style browsing UI — hero banner, horizontally scrolling rows, detail pages, and search.

## What works today

| Route | What it does |
|---|---|
| `/` | Hero banner, then eight rows: Trending, Now playing, Top rated, Airing today, and four genre rows |
| `/title/movie/:id`, `/title/tv/:id` | Title detail — backdrop, poster, overview, genres, rating. Malformed URLs return a real 404 |
| `/search?q=` | URL-driven search with a debounced input; the query lives in the URL, so results are linkable and the back button works |
| `/api/health` | Database reachability check — `200` when reachable, `503` when not |

Rows scroll with the keyboard as well as the mouse, posters lazy-load below the fold, loading states are skeletons that match the final layout, and the whole thing honours `prefers-reduced-motion`.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS · Drizzle ORM · Neon Postgres or plain Postgres · Vitest

## Getting started

You need **Node 24** and **pnpm 11**, and a TMDB API read access token.

**1. Get a TMDB token.** Create an account, then go to [Settings → API](https://www.themoviedb.org/settings/api) and copy the **API Read Access Token** (the long JWT-looking one, not the shorter v3 API key).

**2. Install and configure.**

```bash
pnpm install
cp .env.example .env.local
```

Put the token in `.env.local`:

```
TMDB_ACCESS_TOKEN=<your read access token>
```

That is the only variable you need to browse. `.env.local` is gitignored — keep it that way.

**3. Run it.**

```bash
pnpm dev
```

Then open http://localhost:3000.

### About the database

You do **not** need Postgres to browse. Every page above works with just the TMDB token; only `/api/health` touches the database, and it returns `503` without one — which is correct behaviour, not a broken setup.

Set `DATABASE_URL` when you want the health check to pass:

```
DATABASE_URL=postgres://user:password@host:5432/dbname
DATABASE_URL_UNPOOLED=   # direct connection, migrations only
DB_DRIVER=               # 'neon-http' | 'node-postgres'; inferred by runtime if unset
```

The driver is chosen once, in `server/db/client.ts`: the Neon serverless driver over HTTP on Vercel, a pooled TCP connection everywhere else. Nothing above that file knows which is in use.

There are no tables yet — `server/db/schema.ts` is deliberately empty. Users, sessions and the watchlist arrive with authentication.

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm start        # serve a production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # unit tests (vitest, no network)

pnpm db:generate  # generate a migration from schema changes
pnpm db:migrate   # apply migrations
pnpm db:studio    # inspect the database
```

`pnpm build`, `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass on `main`.

## Project layout

The tree separates backend from frontend explicitly:

```
app/            routes only — page.tsx, layout.tsx, loading.tsx, route.ts
components/     frontend — React components, server and client
server/         backend — server-only, never reaches the client bundle
  tmdb/         TMDB access: client, cache policy, image URLs, endpoint wrappers
  db/           Drizzle: driver selection, schema
lib/            pure shared helpers — no I/O, safe on either side
tests/          vitest; fixtures captured from real TMDB responses
```

The TMDB token is server-only. Everything under `server/` that holds a secret or opens a connection imports `server-only`, so a client component reaching it is a build error rather than a leak.

See [`CLAUDE.md`](./CLAUDE.md) for the full conventions.

## Testing

```bash
pnpm test
```

No test makes a network call — the TMDB response types are derived from real payloads captured into `tests/fixtures/tmdb/`. To re-capture them (needs `jq` and a working token):

```bash
./scripts/capture-tmdb-fixtures.sh
```

## Caching and rate limits

Catalogue data changes slowly, so responses are cached through Next's fetch cache with per-endpoint revalidation and cache tags — 24h for configuration, genres and title detail, 6h for lists, 1h for trending, 5m for search. A cold home page costs about ten TMDB requests; the next request costs none.

The TMDB client also respects a `429` with a bounded, jittered retry that honours `Retry-After`.

## Not built yet

- **Sign-in and the watchlist.** No authentication, no `watchlist_items` table.
- **Docker.** There is no `Dockerfile` or `docker-compose.yml` in the repo yet; deploying to a container is the next piece of work.
- **Error boundaries.** A TMDB failure currently reaches Next's default error page.

## Attribution

This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
