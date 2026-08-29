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

Migrations are never run on container start — concurrent containers would race — so they stay a separate step against `DATABASE_URL_UNPOOLED`:

```bash
pnpm db:migrate
```

## Deploying

Two targets, both first-class.

**Vercel.** The project builds from `main` on push. Postgres comes from the Neon marketplace integration, which injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` — the names the app already reads. The variables you add by hand are `TMDB_ACCESS_TOKEN`, `AUTH_SECRET`, and the four provider variables: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. See [docs/oauth-setup.md](docs/oauth-setup.md) for how the OAuth apps behind those provider variables were registered.

`next.config.ts` sets `output: 'standalone'` everywhere except on Vercel, which traces its own output; leaving `standalone` on there fails Vercel's post-build hook with a missing `next-server.js.nft.json`.

**Container.** See below — one image, any Postgres.

## Docker

The image is one self-contained artifact: an env file and a reachable Postgres are enough to get a working instance. No sidecar, no build step at container start, no reverse proxy. Nothing is baked in — no token, no database URL, no `.env`.

The env file needs `AUTH_SECRET` and the four provider variables (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) for sign-in to work, plus `AUTH_URL` — Vercel infers that one, but the container needs it set explicitly. See [docs/oauth-setup.md](docs/oauth-setup.md) for where the provider values come from.

```bash
docker build -t movies-app .
docker run --rm -p 3000:3000 --env-file .env.local movies-app
```

It runs as the `node` user, respects `PORT` and `HOSTNAME` (defaults `3000` and `0.0.0.0`), and carries a `HEALTHCHECK` that hits `/api/health` — so a container whose database has gone away reports `unhealthy` rather than merely "up".

For local work, `docker-compose.yml` brings up the app together with a Postgres 17. It is a convenience, not the deployment unit:

```bash
set -a; . ./.env.local; set +a   # compose reads TMDB_ACCESS_TOKEN from the environment
docker compose up -d --build
```

Compose fails fast when `TMDB_ACCESS_TOKEN` is unset rather than serving an empty catalogue that looks fine. That guard also blocks `ps`, `logs`, `stop` and `down`, so any placeholder unblocks teardown if you no longer have the value at hand: `TMDB_ACCESS_TOKEN=x docker compose down -v`.

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

`pnpm test` is hermetic and makes no network or database calls. `pnpm test:db` runs the watchlist repository against the compose Postgres, applying the migrations first. It truncates `users`, `accounts`, `sessions` and `watchlist_items` in whatever database `DATABASE_URL` points at, so if that is the same database your dev server is signed in against, running it ends that session. Start that database with:

```bash
set -a; . ./.env.local; set +a
docker compose up -d db
```

Compose interpolates the whole file, so the `app` service's token guard blocks every subcommand until the env file is sourced — see the comment on that guard in [`docker-compose.yml`](./docker-compose.yml).

No test in `pnpm test` makes a network call — the TMDB response types are derived from real payloads captured into `tests/fixtures/tmdb/`. To re-capture them (needs `jq` and a working token):

```bash
./scripts/capture-tmdb-fixtures.sh
```

## Caching and rate limits

Catalogue data changes slowly, so responses are cached through Next's fetch cache with per-endpoint revalidation and cache tags — 24h for configuration, genres and title detail, 6h for lists, 1h for trending, 5m for search. A cold home page costs about ten TMDB requests; the next request costs none.

The TMDB client also respects a `429` with a bounded, jittered retry that honours `Retry-After`.

## Not built yet

- **Sign-in and the watchlist.** The schema, the first migration and the watchlist query layer are in place, and `pnpm test:db` exercises the queries against a real Postgres. There is no authentication and no UI, so nothing has yet signed a user in or written a row through the application. The GitHub and Google OAuth apps are registered and their credentials are in place — see [docs/oauth-setup.md](docs/oauth-setup.md) — but no code reads them yet.
- **Error boundaries.** A TMDB failure currently reaches Next's default error page.
- **Cache-tag revalidation and CI.** Responses carry cache tags, but nothing revalidates them yet, and there is no pipeline running the gate on push.

## What is verified, and what is not

Verified by running it, against a real TMDB token and a real Postgres:

- `/`, `/title/movie/:id`, `/title/tv/:id` and `/search?q=` render live TMDB data; a malformed id returns a real 404.
- `/api/health` returns `200` against a reachable database and `503` when it is not.
- The image builds, and the container serves those routes. Stopping Postgres under a running container flips it to `unhealthy` and the route to `503`; starting Postgres again returns it to `healthy`.
- The built image carries no `.env` file, no build-stage `node_modules`, and no copy of the TMDB token.
- Both driver branches have now opened a real connection: `node-postgres` against the compose Postgres, and `neon-http` against Neon from a Vercel deployment.

Still unverified: nothing in the read path. Authentication and the watchlist do not exist yet, so nothing has exercised a write.

## Attribution

This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
