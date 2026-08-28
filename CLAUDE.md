# CLAUDE.md

Guidance for AI agents working in this repository.

## Project

A personal streaming-catalogue app. It pulls movie and TV data from the TMDB API and presents it in a Netflix-style browsing UI: hero banner, horizontally scrolling rows (Trending, Now Playing, Top Rated, Airing Today, by genre), detail pages, and search. Signed-in users can add titles to a watchlist that persists in our own database.

TMDB is the source of catalogue data. Our database stores only users, watchlist entries, and cached TMDB responses — never a mirror of TMDB's catalogue.

## Stack

- Next.js (App Router) + TypeScript, using `output: 'standalone'`
- Two deployment targets, both first-class: Vercel, and a single self-contained Docker image
- Tailwind CSS for styling
- Neon Postgres. The driver is runtime-dependent: `@neondatabase/serverless` over HTTP on Vercel, `pg` over pooled TCP in the container. The container path uses `pg` so the image also runs against a plain Postgres, which the Neon HTTP and WebSocket drivers cannot reach without a proxy sidecar.
- Drizzle ORM + Drizzle Kit for schema and migrations
- Auth.js (NextAuth) for sessions
- Vitest for unit tests

Do not introduce a new library, ORM, state manager, or UI kit without asking first. If a task seems to need one, say what it would solve and let the human decide.

## Project layout

The tree separates backend from frontend explicitly. Put new code in the layer it belongs to; do not reach across.

```
app/            routes only — page.tsx, layout.tsx, loading.tsx, route.ts
components/     frontend — React components
server/         backend — server-only, never reaches the client bundle
  tmdb/         TMDB API access: client, cache policy, image URLs, endpoint wrappers
  db/           Drizzle: driver selection, schema, migrations
lib/            pure shared helpers — no I/O, safe to import from either side
public/         static assets
scripts/        one-off developer scripts
tests/          vitest; tests/tmdb and tests/db cover server/tmdb and server/db
```

- `app/` holds routing and composition. A route file fetches through `server/` and renders `components/` — it does not contain fetch logic, SQL, or reusable markup.
- A module under `server/` that holds a secret or opens a connection imports `server-only` — `server/tmdb/client.ts` and `server/db/client.ts` do — so a client component that reaches it is a build error rather than a leaked token. That guard is the reason the directory exists; give any new such module the same import.
- `components/` holds both server and client components. A `'use client'` component must never import from `server/` — the `server-only` guard makes that a build error, which is the point. A server component in `components/` may import from `server/` freely.
- A client component that needs server-rendered content takes it as `children` (or props) rather than importing it: `RowScroller` is `'use client'`, but the `PosterCard`s inside it are server components passed through as children, so they never enter the client bundle. Reach for that shape before reaching for `'use client'` higher up the tree.
- `lib/` is for helpers that do no I/O and hold no secrets — view-model mapping, URL-segment parsing, formatting. That rule is what keeps it from becoming a catch-all: anything that fetches, queries, or reads an environment variable belongs under `server/`, and anything that renders belongs in `components/`. Importing a type from `server/` is fine; types are erased.
- Import across layers with the `@/` alias (`@/server/tmdb/endpoints/lists`, `@/components/row`), not relative paths. Relative imports are for siblings within one layer.

## Agent rules

### Prove before asserting

Never state that something works, exists, or is fixed unless you have evidence in this session. Evidence means: a command you ran and its output, a file you read, or a test that passed. Not memory, not inference, not "this should work".

Concretely:

- Before claiming an API endpoint exists or a response has a given shape, fetch it and show the actual JSON, or cite the TMDB docs page you read. TMDB field names and pagination behaviour differ between endpoints and between v3 and v4 — check the specific endpoint, do not generalise from another one.
- Before claiming a build passes, run the build and paste the result.
- Before claiming a query works, run it against a real database and show the rows.
- Before editing a file, read it. Do not patch from assumption about its contents.
- When you cannot verify something, say so explicitly: "I have not verified this" or "this is untested". An honest gap is more useful than a confident guess.
- If a verification fails, report the failure. Do not quietly retry with a different approach and present only the success.

Phrases to avoid unless backed by output in this session: "this should now work", "the endpoint returns", "I've fixed", "tests pass".

### No unnecessary comments

Write code that reads without narration.

- No comments restating what the code does (`// fetch the movie`, `// map over results`).
- No section-divider banners, no `// TODO` left behind unless the human asked for it, no commented-out code.
- No JSDoc on functions whose signature already says everything.
- Keep a comment only when it explains something the code cannot: a non-obvious TMDB quirk, a workaround for a specific bug with a link, a deliberate deviation from the obvious approach and why.

Same rule for commit messages and PR text: state what changed and why, skip the summary of the diff.

### General

- Match existing patterns in the file you are editing over your own preferences.
- Prefer small, reviewable changes. Do not refactor adjacent code that was not part of the task.
- Do not add dependencies, scripts, or config files as a side effect of an unrelated task.

## Commands

```
pnpm dev              # local dev server
pnpm build            # production build — run before claiming a change is done
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit
pnpm test             # unit tests
pnpm db:generate      # generate migration from schema changes
pnpm db:migrate       # apply migrations
pnpm db:studio        # inspect the database

docker build -t movies-app .
docker run --rm -p 3000:3000 --env-file .env.local movies-app
```

`pnpm build`, `pnpm lint` and `pnpm typecheck` must all pass before a change is considered complete.

## TMDB integration

- The API key/read token is server-only. It must never reach the client bundle: no `NEXT_PUBLIC_` prefix, no fetch to TMDB from a client component. All TMDB calls go through server components, route handlers, or server actions.
- All TMDB access goes through `server/tmdb/`. Do not scatter `fetch('https://api.themoviedb.org/...')` calls across components.
- Every endpoint wrapper has an explicit TypeScript response type derived from a real response, not guessed. When adding a new endpoint, fetch it once and base the type on the actual payload.
- Images come from TMDB's image CDN with an explicit size segment. Read `/configuration` for the current base URL and valid sizes rather than hardcoding from memory; pick the smallest size that looks right for the slot.
- Check current rate-limit and caching guidance in TMDB's docs before designing anything that fans out into many requests. Do not assume a specific limit.
- TMDB's terms require attribution. Section 3 of https://www.themoviedb.org/documentation/api/terms-of-use specifies the wording, verified 2026-08-28: "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." The footer carries that sentence with `application` chosen from the bracket, plus the TMDB logo. Re-read the terms before changing it — this is a quote, not a paraphrase, and earlier drafts of this file paraphrased it as "not endorsed or certified", which is not what TMDB requires.
- The same section requires that TMDB's logo be "less prominent than the logos or marks that primarily describe or identify Your Application". The TMDB mark therefore stays in the footer, below the "My Movies" wordmark in the header; do not promote it into the header or scale it past the wordmark.
- Cache aggressively. Catalogue data changes slowly; use Next's fetch cache with sensible revalidation and cache tags per endpoint family.

## Data layer

- Schema lives in `server/db/schema.ts`. Change the schema, generate a migration, apply it. Never hand-edit a generated migration file or run ad-hoc DDL against the database.
- Tables we own: users, accounts/sessions (Auth.js), `watchlist_items`.
- A watchlist item stores `user_id`, `tmdb_id`, `media_type` ('movie' | 'tv'), `added_at`, and a small denormalised snapshot (title, poster path) so the watchlist page renders without a TMDB round-trip per item. Treat the snapshot as a cache; TMDB is the source of truth.
- Unique constraint on `(user_id, tmdb_id, media_type)`. Adding an existing item is idempotent, not an error.
- Every watchlist query filters by the session user id. Never trust a user id from the request body or a query param.
- The driver is selected once, in `server/db/client.ts`, based on the runtime — not per call site. On Vercel, the Neon serverless driver over HTTP; in a long-running container, a pooled TCP connection. Everything above that file imports the same Drizzle instance and does not know which is in use.
- Never open a long-lived pool in a serverless function, and never open a fresh HTTP connection per query in the container path.
- Query code must stay driver-agnostic: no raw driver types in function signatures, no HTTP- or pool-specific behaviour leaking into repositories.

## UI conventions

The reference feel is Netflix: dark background, poster-forward, minimal chrome.

- Server components by default. `'use client'` only where interactivity genuinely requires it — carousel scroll state, watchlist toggle, search input.
- Row carousels are horizontally scrollable with keyboard and touch support, and lazily load posters below the fold.
- The watchlist toggle updates optimistically and rolls back on failure.
- Every interactive element is reachable by keyboard and has an accessible name. Posters have alt text with the title.
- Loading states are skeletons matching the final layout, not spinners.

## Docker

The image is a single artifact that runs the whole app: `docker run` with an env file and a reachable Postgres must be enough to get a working instance. No sidecar, no build step at container start, no external reverse proxy required.

- Multi-stage build: deps → build → runtime. The runtime stage copies only `.next/standalone`, `.next/static`, and `public`. No `node_modules` from the build stage, no source, no dev dependencies.
- Runs as a non-root user. `PORT` and `HOSTNAME` are respected; `HOSTNAME` must be `0.0.0.0` or the container will not accept external connections.
- All configuration comes from environment variables at container start. Nothing baked into the image — no secrets in build args, no `.env` file copied in, no `NEXT_PUBLIC_` value that differs between environments unless it is genuinely public and stable.
- `.dockerignore` excludes `node_modules`, `.next`, `.git`, and `.env*`. Verify secrets are absent from the built image rather than assuming.
- A `HEALTHCHECK` hits a `/api/health` route handler that checks database reachability and returns a non-200 when it fails.
- Migrations are not run automatically on container start. They are a separate step (`pnpm db:migrate`, or a one-shot run of the same image with an override) so that scaling to multiple containers cannot race.
- Anything that only works on Vercel is a bug. Do not use Vercel-specific runtime APIs, cron config, or edge-only features in application code paths. If a feature genuinely needs one, it goes behind an interface with a container-friendly implementation.
- `docker-compose.yml` exists for local work and brings up the app plus a local Postgres. It is a convenience, not the deployment unit.

When you change the Dockerfile, build the image and run it before saying it works. A Dockerfile that has not been built is unverified.

## Environment

```
TMDB_ACCESS_TOKEN       # server-only
DATABASE_URL            # Neon pooled connection string, or any Postgres URL in the container
DATABASE_URL_UNPOOLED   # direct connection, migrations only
DB_DRIVER               # 'neon-http' | 'node-postgres'; defaults by runtime, override to force
AUTH_SECRET
AUTH_URL                # required in the container; inferred on Vercel
PORT / HOSTNAME         # container only, defaults 3000 / 0.0.0.0
```

Local values live in `.env.local`, which is gitignored. Never commit real credentials, never print them in logs or terminal output, and never paste them into a file you create.

## Definition of done

A change is done when: the code is written, `pnpm build`, `pnpm lint` and `pnpm typecheck` pass with output you can show, the affected path has been exercised (test or manual run), and you have stated plainly which parts you verified and which you did not.

If the change touches the Dockerfile, the build pipeline, the database client, or anything runtime-dependent, it is done only once the image builds and the container starts and serves a request — verified, not assumed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
