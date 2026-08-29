# Slice 2 — Auth.js sessions and the watchlist write path

Date: 2026-08-29
Status: approved, not yet implemented

## Context

Slice 1 delivered the TMDB read path and the deployment substrate: `server/db/client.ts`,
`/api/health`, a Docker image, and a live Vercel deployment. Both driver branches —
`neon-http` on Vercel, `node-postgres` in the container — have opened a real connection.

Neither has ever written a row. `server/db/schema.ts` is `export {}`, and
`server/db/migrations/` does not exist. This slice brings the first migration, the first
write, and the first authenticated request.

Scope: Auth.js sessions over GitHub and Google, the `users`/`accounts`/`sessions`/
`watchlist_items` schema, a `/watchlist` page, and an optimistic toggle on the title
detail page. Cache-tag revalidation surfaces, the accessibility audit, skeleton
refinement, and CI remain in slice 3.

## Decisions

Resolved with the human before design. The rationale is recorded so a later reader does
not reopen a settled question.

### Both GitHub and Google, with account linking left off

Two providers ship together. GitHub needs **two** OAuth apps — its form takes a single
authorization callback URL — so local and production credentials are separate; Google's
form accepts a list of redirect URIs, so one client covers both origins.

Auth.js refuses by default to attach a second provider to an existing user with the same
email, redirecting with `OAuthAccountNotLinked`. `allowDangerousEmailAccountLinking`
opts out of that, and the name is honest: it means trusting each provider's claim that
the user owns the address. It stays **off**. `/signin` renders that specific error as
readable text instead. Turning it on later is a one-line change.

Consequence accepted: **OAuth sign-in cannot complete on a Vercel preview deployment.**
Preview URLs are generated per deployment and neither provider will redirect to an
unregistered URL. Previews are for reviewing rendering; sign-in is verified locally, in
the container, and on production.

### Database sessions, not JWT

`session: { strategy: 'database' }`. CLAUDE.md names `sessions` as a table we own, and a
database-backed session means `session.user.id` is a row that exists rather than a claim
in a cookie — which matters because every watchlist query is scoped by that id.

The cost is one session `SELECT` per request that calls `auth()`, which under `neon-http`
is an HTTP round trip. Accepted; if it shows up in slice 3's measurements, it is
revisited then, not pre-optimised now.

### The adapter is constructed lazily

`NextAuth(() => ({ adapter: DrizzleAdapter(getDb()), ... }))`, using Auth.js's documented
lazy-initialization form.

`getDb()` is lazy for a specific reason recorded in `server/db/client.ts`: `next build`
evaluates route modules during page-data collection, so constructing a client at module
load fails any build without `DATABASE_URL` — including the Docker build stage. Passing
`DrizzleAdapter(getDb())` at module scope would re-break exactly that, and the failure
would appear in the container build rather than locally.

### Idempotent add without a transaction

`Db` is typed as `NodePgDatabase` minus `transaction`, because `neon-http` has no
transaction support. Adding an existing item is therefore
`insert(...).onConflictDoNothing()` against `UNIQUE (user_id, tmdb_id, media_type)` — one
statement, no read-then-write race, and no API the container path has but Vercel lacks.

### The snapshot is built on the server

The toggle sends only `tmdbId` and `mediaType`. The action fetches title and poster path
from TMDB itself rather than accepting them from the client.

A server action is reachable by direct POST, not only through our UI. Taking the
denormalised snapshot from the request body would let a hand-crafted call write arbitrary
strings into the database. The detail response is already cached, so re-reading it costs
effectively nothing.

### Route protection is per-page, not `proxy.ts`

Next 16 renamed middleware to Proxy, and its own documentation says Proxy "should not be
used as a full session management or authorization solution". `/watchlist` calls `auth()`
and redirects; the server action re-checks the session independently, because neither
check can rely on the other having run.

### Layout-level `auth()` makes every route dynamic

`SiteHeader` lives in the root layout and will call `auth()`, so every route renders at
request time. `/` is already request-time and the detail page needs the session for the
toggle, so the practical loss is small — but it is an app-wide change in rendering
behaviour, not a local one. A `<Suspense>` boundary around the session-dependent part of
the header would preserve a static shell; that is a slice 3 measurement, not a
speculative addition now.

## Schema

Five tables in `server/db/schema.ts`, generating the repository's first migration.

```
users             id (text, uuid default), name, email (unique), email_verified, image
accounts          user_id → users.id cascade, type, provider, provider_account_id,
                  refresh_token, access_token, expires_at, token_type, scope,
                  id_token, session_state
                  PK (provider, provider_account_id)
sessions          session_token PK, user_id → users.id cascade, expires
verification_tokens  identifier, token, expires — PK (identifier, token)
watchlist_items   id (text, uuid default) PK, user_id → users.id cascade,
                  tmdb_id (integer), media_type, title, poster_path (nullable),
                  added_at (timestamptz, default now())
                  UNIQUE (user_id, tmdb_id, media_type)
```

`verification_tokens` is unused by GitHub and Google. It is included pending verification
that `DrizzleAdapter`'s custom-schema argument treats it as optional; if it does, the
table is dropped from the migration before the migration is generated.

`media_type` is `text().$type<MediaType>()` reusing the union in `server/tmdb/types.ts`,
not a `pgEnum` — a Postgres enum turns any future value into an `ALTER TYPE` migration,
and the unique constraint provides the integrity that matters.

Column names are snake_case. The adapter addresses columns through the Drizzle object's
TypeScript properties, so SQL naming remains ours — **this must be verified against the
adapter source before the migration is generated**, because getting it wrong is a silent
runtime failure rather than a type error.

Migrations are generated with `pnpm db:generate` and applied by hand to local Postgres and
to Neon via `DATABASE_URL_UNPOOLED`. Never at container start; never hand-edited.

## Layout

CLAUDE.md scopes `server/db/` to "driver selection, schema, migrations", so watchlist
queries do not belong there, and `app/` is routes-only, so the server action does not sit
beside the page that calls it.

```
server/auth/config.ts          server-only; exports handlers, auth, signIn, signOut
server/watchlist/queries.ts    listForUser (added_at desc), isInWatchlist,
                               addToWatchlist, removeFromWatchlist
server/watchlist/actions.ts    'use server'; toggleWatchlist
app/api/auth/[...nextauth]/route.ts   re-exports handlers
app/signin/page.tsx            two provider forms; renders OAuthAccountNotLinked readably
app/watchlist/page.tsx         auth-gated grid built from the stored snapshot
components/watchlist-button.tsx    'use client'; optimistic toggle
components/site-header.tsx     gains session state and a Watchlist link
```

Every query function takes `userId` as its first argument and filters on it. None reads
the session itself, so a call site that forgets is a missing argument rather than a
silent trust of a request body.

`/signin`'s `callbackUrl` is validated as a same-origin relative path before use; an
unvalidated one is an open redirect.

No `SessionProvider` and no import of `next-auth/react`. Nothing client-side reads the
session, so that package never enters the browser bundle.

## The toggle

`toggleWatchlist({ tmdbId, mediaType })` returns
`{ ok: true; inWatchlist: boolean } | { ok: false; message: string }`. It authenticates,
validates that `tmdbId` is a positive integer and `mediaType` is `'movie' | 'tv'`, writes,
then revalidates `/watchlist` and the title path.

It returns a result rather than throwing. Next's documentation is explicit that a throw
inside a `useTransition` reaches the nearest error boundary — which would blank the detail
page on a failed toggle.

The button uses `useOptimistic` plus `useTransition`. The label flips on the click frame;
when the transition ends the value reverts to the server-rendered prop, and that reversion
is the rollback CLAUDE.md requires. A failed result renders a message in a `role="status"`
region beside the button. The accessible name carries the state ("Add to watchlist" /
"Remove from watchlist") rather than pairing a static label with `aria-pressed`.

Signed out, the component renders a link to `/signin?callbackUrl=…` and holds no
optimistic state, because there is nothing yet to flip.

## Verification

Unit tests, no database: payload validation, the signed-out link target, media-type
parsing.

Repository tests run against a **real Postgres** — the one `docker-compose.yml` already
provides on port 5433 — behind a separate `pnpm test:db` script, so `pnpm test` stays
hermetic. Three properties: adding twice leaves one row, removal is scoped to the owner,
and one user's query never returns another's. Mocking Drizzle would prove nothing about
the unique constraint, which is the part that can actually be wrong.

Manual verification, which is what the definition of done demands:

1. Sign in locally with **both** providers; add and remove; show the actual rows.
2. Rebuild the image and repeat against compose Postgres — proves the `node-postgres`
   write path.
3. After merge, repeat on production — proves the `neon-http` write path.

The first real sign-in also settles something that could not be verified during setup:
GitHub defers redirect-URI validation until after login, so the GitHub callback URL is
unproven until a human completes a sign-in.

## Blocs

Three branches off `main`, three PRs, each merged before the next branches:

1. Schema, first migration, `server/watchlist/queries.ts`, repository tests.
2. Auth.js wiring, `/signin`, header session state.
3. The toggle, `/watchlist`, and close-out verification across both drivers.

## Out of scope

Account deletion, watchlist sorting or filtering, sharing, and per-item notes. The privacy
policy shipped separately in PR #6 and states that removing an item deletes the record;
account deletion is described there as a contact request, which remains true after this
slice.
