# Auth and Watchlist Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Auth.js sign-in over GitHub and Google, the first database migration, and an optimistic watchlist toggle backed by our own Postgres.

**Architecture:** Auth.js v5 with the Drizzle adapter and database-backed sessions, constructed lazily so no database client is built at module load. Watchlist reads and writes live in `server/watchlist/`, driver-agnostic, every function scoped by `userId`. The toggle is a client component using `useOptimistic`; the mutation is a server action that re-authenticates, validates, and builds the stored snapshot from TMDB rather than from the request body.

**Tech Stack:** Next.js 16.3.3 (App Router), TypeScript strict, Auth.js (`next-auth@5.0.0-beta.32`), `@auth/drizzle-adapter@1.11.3`, Drizzle ORM 0.45 + Drizzle Kit 0.31, Postgres (Neon on Vercel, `pg` in the container), Tailwind CSS 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-29-auth-watchlist-slice-design.md`

## Global Constraints

- `next-auth` is pinned to `5.0.0-beta.32` and `@auth/drizzle-adapter` to `1.11.3`. Both are exact pins, no caret — v5 is a beta and a floating range can change behaviour between installs.
- Auth.js infers credentials from `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Providers take no arguments. A differently named variable is read by nothing and fails silently.
- `allowDangerousEmailAccountLinking` stays **off**. `OAuthAccountNotLinked` is rendered as readable text on `/signin`.
- Session strategy is `'database'`.
- No database client may be constructed at module load. `next build` evaluates route modules during page-data collection, and the Docker build stage has no `DATABASE_URL`. Use Auth.js's lazy form: `NextAuth(() => ({ ... }))`.
- `Db` is `NodePgDatabase` minus `transaction` — `neon-http` has no transactions. No call site may use one.
- Every watchlist query takes `userId` as its first parameter and filters on it. No function reads the session itself.
- Never trust a user id, title, or poster path from a request body. The server action takes only `tmdbId` and `mediaType` and fetches the snapshot from TMDB.
- Server actions are reachable by direct POST. Every action calls `auth()` itself, regardless of any page-level check.
- Modules under `server/` that hold a secret or open a connection import `server-only`.
- No `SessionProvider`, no import of `next-auth/react`. Nothing client-side reads the session.
- `app/` holds routes only — `page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts`. Server actions live under `server/`.
- Migrations are generated with `pnpm db:generate` and applied with `pnpm db:migrate`. Never hand-edit a generated migration; never run ad-hoc DDL; never migrate on container start.
- No comments that restate what the code does. No JSDoc where the signature suffices. No commented-out code, no leftover TODOs.
- Server components by default. `'use client'` only where interactivity requires it.
- Every interactive element is keyboard-reachable and has an accessible name.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` must all pass before a task is complete. `pnpm test:db` must also pass from Task 3 onward.
- Commit at the end of each task and push to the bloc's branch. Three blocs, three branches off `main`, three PRs, each merged before the next branches: `bloc-4-schema` (Tasks 1–3), `bloc-5-auth` (Tasks 4–6), `bloc-6-watchlist` (Tasks 7–10).

---

## Bloc 1 — Schema and repository (`bloc-4-schema`)

### Task 1: Install Auth.js and settle the adapter's schema contract

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `next-auth` and `@auth/drizzle-adapter` installed at pinned versions, and two answers Task 2 depends on — whether `verificationTokensTable` is optional, and whether the adapter addresses columns by TypeScript property name or SQL column name.

- [ ] **Step 1: Install both packages at exact versions**

```bash
pnpm add next-auth@5.0.0-beta.32 @auth/drizzle-adapter@1.11.3
```

- [ ] **Step 2: Confirm the versions are pinned, not ranged**

```bash
grep -E '"(next-auth|@auth/drizzle-adapter)"' package.json
```

Expected: `"next-auth": "5.0.0-beta.32"` and `"@auth/drizzle-adapter": "1.11.3"` — no `^`, no `~`. If pnpm added a caret, edit `package.json` to the exact version and re-run `pnpm install`.

- [ ] **Step 3: Answer question one — is `verificationTokensTable` optional?**

```bash
grep -rn "verificationTokensTable" node_modules/@auth/drizzle-adapter/lib/pg.d.ts
```

A `?:` on the property in the schema-argument type means optional. Record which you saw; Step 5 of Task 2 depends on it.

- [ ] **Step 4: Answer question two — property name or SQL name?**

```bash
grep -rnE "\.(providerAccountId|sessionToken|userId)\b" node_modules/@auth/drizzle-adapter/lib/pg.js | head -20
```

The adapter reading `accountsTable.providerAccountId` in JavaScript means it addresses the **Drizzle object's TypeScript property**, so SQL column names are ours to choose. If instead it builds raw SQL strings from column names, snake_case naming is unsafe and Task 2's schema must use the camelCase SQL names from the Auth.js reference schema.

This is the check the spec flags as a silent runtime failure if wrong. Do not skip it and do not infer the answer from the other adapter.

- [ ] **Step 5: Verify the install broke nothing**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Expected: all four pass. Nothing imports the new packages yet, so this is a guard against a peer-dependency conflict, not a feature test.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add Auth.js and the Drizzle adapter at pinned versions

next-auth v5 is a beta; a floating range can change behaviour between
installs, so both packages are pinned exactly."
```

---

### Task 2: Schema and the first migration

**Files:**
- Modify: `server/db/schema.ts`
- Create: `server/db/migrations/` (generated)
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `MediaType` from `@/server/tmdb/types`.
- Produces: exports `users`, `accounts`, `sessions`, `verificationTokens`, `watchlistItems` from `@/server/db/schema`. `watchlistItems` columns are `id`, `userId`, `tmdbId`, `mediaType`, `title`, `posterPath`, `addedAt`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { accounts, sessions, users, watchlistItems } from '@/server/db/schema'

describe('watchlist_items', () => {
  it('is uniquely keyed on the owner, the TMDB id, and the media type', () => {
    const config = getTableConfig(watchlistItems)
    const columns = config.uniqueConstraints.flatMap((c) => c.columns.map((col) => col.name))
    expect(new Set(columns)).toEqual(new Set(['user_id', 'tmdb_id', 'media_type']))
  })

  it('defaults added_at rather than trusting the caller', () => {
    const addedAt = getTableConfig(watchlistItems).columns.find((c) => c.name === 'added_at')
    expect(addedAt?.hasDefault).toBe(true)
  })

  it('allows a missing poster but never a missing title', () => {
    const columns = getTableConfig(watchlistItems).columns
    expect(columns.find((c) => c.name === 'poster_path')?.notNull).toBe(false)
    expect(columns.find((c) => c.name === 'title')?.notNull).toBe(true)
  })
})

describe('auth tables', () => {
  it('keys an account by provider and provider account id', () => {
    const pk = getTableConfig(accounts).primaryKeys[0]
    expect(pk.columns.map((c) => c.name).sort()).toEqual(['provider', 'provider_account_id'])
  })

  it('keys a session by its token', () => {
    const pk = getTableConfig(sessions).columns.find((c) => c.primary)
    expect(pk?.name).toBe('session_token')
  })

  it('makes a user email unique', () => {
    const config = getTableConfig(users)
    const email = config.columns.find((c) => c.name === 'email')
    const named = config.uniqueConstraints.some((c) => c.columns.some((col) => col.name === 'email'))
    expect(email?.isUnique === true || named).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/db/schema.test.ts
```

Expected: FAIL — `server/db/schema.ts` exports nothing.

- [ ] **Step 3: Write the schema**

Replace the contents of `server/db/schema.ts`:

```ts
import { integer, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'
import type { MediaType } from '@/server/tmdb/types'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
})

// The property names on this table are the adapter's API, not ours: it reads
// account.providerAccountId and account.refresh_token by those exact keys. Only the
// SQL column names in the strings are free to follow our snake_case convention.
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    mediaType: text('media_type').$type<MediaType>().notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    addedAt: timestamp('added_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.tmdbId, table.mediaType)],
)
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/db/schema.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Apply Task 1's findings**

If Task 1 Step 3 showed `verificationTokensTable` is **optional**, delete the `verificationTokens` export above — GitHub and Google never write to it, and an unused table is not worth a migration. Re-run Step 4; the tests do not reference it.

If Task 1 Step 4 showed the adapter builds SQL from column names rather than reading TypeScript properties, replace every snake_case string in `users`, `accounts` and `sessions` with the camelCase names from the Auth.js Postgres reference schema (`"userId"`, `"providerAccountId"`, `"sessionToken"`, `"emailVerified"`), leave `watchlist_items` snake_case, and update `tests/db/schema.test.ts` to expect the new names. Do not change both conventions on a hunch — change only what the check showed.

- [ ] **Step 6: Generate the migration**

```bash
pnpm db:generate
```

Expected: creates `server/db/migrations/0000_*.sql` plus a `meta/` directory. This is the repository's first migration.

- [ ] **Step 7: Read the generated SQL before trusting it**

```bash
cat server/db/migrations/0000_*.sql
```

Confirm: five (or four) `CREATE TABLE` statements, a `UNIQUE` constraint covering `user_id, tmdb_id, media_type`, and `ON DELETE cascade` on every `user_id` foreign key. Do not edit this file — if something is wrong, fix `schema.ts` and regenerate.

- [ ] **Step 8: Apply it to the local database**

```bash
docker compose up -d db
DATABASE_URL_UNPOOLED=postgresql://postgres:devpass@localhost:5433/movies pnpm db:migrate
```

- [ ] **Step 9: Show the tables actually exist**

```bash
docker compose exec -T db psql -U postgres -d movies -c '\dt'
docker compose exec -T db psql -U postgres -d movies -c '\d watchlist_items'
```

Expected: the tables are listed, and `watchlist_items` shows the unique constraint. Paste this output into the task's report — the definition of done requires rows and DDL you have seen, not assumed.

- [ ] **Step 10: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
git add server/db/schema.ts server/db/migrations tests/db/schema.test.ts
git commit -m "Add the auth and watchlist schema, and the first migration

The account table's property names are the adapter's API rather than ours;
only the SQL column names follow the repository's snake_case convention.
media_type is a text column typed by the existing MediaType union rather than
a pgEnum, so a new value never needs an ALTER TYPE."
```

---

### Task 3: The watchlist repository, tested against a real Postgres

**Files:**
- Create: `server/watchlist/queries.ts`
- Create: `vitest.db.config.ts`
- Create: `tests/db-integration/setup.ts`
- Create: `tests/db-integration/watchlist.test.ts`
- Modify: `vitest.config.ts`, `package.json`, `.env.example`, `README.md`

**Interfaces:**
- Consumes: `getDb` from `@/server/db/client`; `watchlistItems` from `@/server/db/schema`; `MediaType` from `@/server/tmdb/types`.
- Produces:
  - `interface WatchlistEntry { tmdbId: number; mediaType: MediaType; title: string; posterPath: string | null; addedAt: Date }`
  - `listForUser(userId: string): Promise<WatchlistEntry[]>` — newest first
  - `isInWatchlist(userId: string, tmdbId: number, mediaType: MediaType): Promise<boolean>`
  - `addToWatchlist(userId: string, entry: Omit<WatchlistEntry, 'addedAt'>): Promise<void>`
  - `removeFromWatchlist(userId: string, tmdbId: number, mediaType: MediaType): Promise<void>`

- [ ] **Step 1: Add the integration-test runner**

Create `vitest.db.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db-integration/**/*.test.ts'],
    globalSetup: ['tests/db-integration/setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
```

`fileParallelism: false` because every test file shares one database; parallel files would truncate each other's rows mid-test.

- [ ] **Step 2: Keep the hermetic suite hermetic**

Modify `vitest.config.ts` — its `include` of `tests/**/*.test.ts` would otherwise sweep up the integration tests and fail `pnpm test` on any machine without Postgres:

```ts
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/db-integration/**'],
  },
```

- [ ] **Step 3: Write the global setup**

Create `tests/db-integration/setup.ts`:

```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start the local database with `docker compose up -d db` ' +
        'and run `pnpm test:db`, which supplies it.',
    )
  }

  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './server/db/migrations' })
  } finally {
    await pool.end()
  }
}
```

Failing loudly on a missing variable is deliberate: a suite that silently skips when the database is absent reports green while proving nothing.

- [ ] **Step 4: Add the script**

In `package.json`, alongside `"test"`:

```json
    "test:db": "TEST_DATABASE_URL=postgresql://postgres:devpass@localhost:5433/movies DATABASE_URL=postgresql://postgres:devpass@localhost:5433/movies DB_DRIVER=node-postgres vitest run --config vitest.db.config.ts",
```

`DATABASE_URL` and `DB_DRIVER` are set because the repository under test calls `getDb()`, which reads them.

- [ ] **Step 5: Write the failing tests**

Create `tests/db-integration/watchlist.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users } from '@/server/db/schema'
import {
  addToWatchlist,
  isInWatchlist,
  listForUser,
  removeFromWatchlist,
} from '@/server/watchlist/queries'

const db = getDb()
const ALICE = 'user-alice'
const BOB = 'user-bob'

const INTERSTELLAR = { tmdbId: 157336, mediaType: 'movie' as const, title: 'Interstellar', posterPath: '/a.jpg' }
const SEVERANCE = { tmdbId: 95396, mediaType: 'tv' as const, title: 'Severance', posterPath: null }

beforeEach(async () => {
  await db.execute(sql`truncate table watchlist_items, users restart identity cascade`)
  await db.insert(users).values([
    { id: ALICE, name: 'Alice', email: 'alice@example.com' },
    { id: BOB, name: 'Bob', email: 'bob@example.com' },
  ])
})

afterAll(async () => {
  await db.execute(sql`truncate table watchlist_items, users restart identity cascade`)
})

describe('addToWatchlist', () => {
  it('stores the snapshot so the watchlist renders without TMDB', async () => {
    await addToWatchlist(ALICE, INTERSTELLAR)
    const rows = await listForUser(ALICE)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Interstellar')
    expect(rows[0].posterPath).toBe('/a.jpg')
    expect(rows[0].addedAt).toBeInstanceOf(Date)
  })

  it('is idempotent rather than an error', async () => {
    await addToWatchlist(ALICE, INTERSTELLAR)
    await addToWatchlist(ALICE, INTERSTELLAR)
    expect(await listForUser(ALICE)).toHaveLength(1)
  })

  it('treats the same TMDB id as distinct across media types', async () => {
    await addToWatchlist(ALICE, { ...INTERSTELLAR, mediaType: 'tv' })
    await addToWatchlist(ALICE, INTERSTELLAR)
    expect(await listForUser(ALICE)).toHaveLength(2)
  })

  it('accepts a missing poster', async () => {
    await addToWatchlist(ALICE, SEVERANCE)
    expect((await listForUser(ALICE))[0].posterPath).toBeNull()
  })
})

describe('listForUser', () => {
  it('returns newest first', async () => {
    await addToWatchlist(ALICE, INTERSTELLAR)
    await addToWatchlist(ALICE, SEVERANCE)
    const titles = (await listForUser(ALICE)).map((row) => row.title)
    expect(titles).toEqual(['Severance', 'Interstellar'])
  })

  it('never returns another user rows', async () => {
    await addToWatchlist(BOB, INTERSTELLAR)
    expect(await listForUser(ALICE)).toEqual([])
  })
})

describe('isInWatchlist', () => {
  it('answers per user, not globally', async () => {
    await addToWatchlist(BOB, INTERSTELLAR)
    expect(await isInWatchlist(BOB, 157336, 'movie')).toBe(true)
    expect(await isInWatchlist(ALICE, 157336, 'movie')).toBe(false)
  })
})

describe('removeFromWatchlist', () => {
  it('removes the caller own row', async () => {
    await addToWatchlist(ALICE, INTERSTELLAR)
    await removeFromWatchlist(ALICE, 157336, 'movie')
    expect(await listForUser(ALICE)).toEqual([])
  })

  it('cannot remove a row belonging to someone else', async () => {
    await addToWatchlist(BOB, INTERSTELLAR)
    await removeFromWatchlist(ALICE, 157336, 'movie')
    expect(await listForUser(BOB)).toHaveLength(1)
  })

  it('is silent when there is nothing to remove', async () => {
    await expect(removeFromWatchlist(ALICE, 999999, 'movie')).resolves.toBeUndefined()
  })
})
```

The last test in each of the final two blocks is the one that matters: ownership is enforced in the `where` clause, and a delete that matched nothing is not an error.

- [ ] **Step 6: Run them and watch them fail**

```bash
docker compose up -d db
pnpm test:db
```

Expected: FAIL — `@/server/watchlist/queries` does not exist.

- [ ] **Step 7: Write the repository**

Create `server/watchlist/queries.ts`:

```ts
import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { watchlistItems } from '@/server/db/schema'
import type { MediaType } from '@/server/tmdb/types'

export interface WatchlistEntry {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  addedAt: Date
}

function owns(userId: string, tmdbId: number, mediaType: MediaType) {
  return and(
    eq(watchlistItems.userId, userId),
    eq(watchlistItems.tmdbId, tmdbId),
    eq(watchlistItems.mediaType, mediaType),
  )
}

export async function listForUser(userId: string): Promise<WatchlistEntry[]> {
  return getDb()
    .select({
      tmdbId: watchlistItems.tmdbId,
      mediaType: watchlistItems.mediaType,
      title: watchlistItems.title,
      posterPath: watchlistItems.posterPath,
      addedAt: watchlistItems.addedAt,
    })
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.addedAt))
}

export async function isInWatchlist(
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
): Promise<boolean> {
  const rows = await getDb()
    .select({ tmdbId: watchlistItems.tmdbId })
    .from(watchlistItems)
    .where(owns(userId, tmdbId, mediaType))
    .limit(1)
  return rows.length > 0
}

export async function addToWatchlist(
  userId: string,
  entry: Omit<WatchlistEntry, 'addedAt'>,
): Promise<void> {
  await getDb()
    .insert(watchlistItems)
    .values({
      userId,
      tmdbId: entry.tmdbId,
      mediaType: entry.mediaType,
      title: entry.title,
      posterPath: entry.posterPath,
    })
    .onConflictDoNothing()
}

export async function removeFromWatchlist(
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
): Promise<void> {
  await getDb().delete(watchlistItems).where(owns(userId, tmdbId, mediaType))
}
```

`onConflictDoNothing()` is what makes a repeat add idempotent, and it is one statement — which matters because `Db` has no `transaction`.

- [ ] **Step 8: Run the tests and watch them pass**

```bash
pnpm test:db
```

Expected: PASS, 10 tests.

- [ ] **Step 9: Prove the rows are really in Postgres**

```bash
docker compose exec -T db psql -U postgres -d movies \
  -c "insert into users (id, name, email) values ('demo','Demo','demo@example.com') on conflict do nothing;" \
  -c "insert into watchlist_items (user_id, tmdb_id, media_type, title, poster_path) values ('demo', 157336, 'movie', 'Interstellar', '/a.jpg') on conflict do nothing;" \
  -c "insert into watchlist_items (user_id, tmdb_id, media_type, title, poster_path) values ('demo', 157336, 'movie', 'Interstellar', '/a.jpg') on conflict do nothing;" \
  -c "select user_id, tmdb_id, media_type, title from watchlist_items where user_id = 'demo';"
```

Expected: exactly one row, proving the unique constraint is enforced by the database and not merely by the query builder. Paste the output into the task report, then clean up:

```bash
docker compose exec -T db psql -U postgres -d movies -c "delete from users where id = 'demo';"
```

- [ ] **Step 10: Document the new script**

Add `TEST_DATABASE_URL` to `.env.example` with an empty value, and add a line to the README's Testing section:

```markdown
`pnpm test` is hermetic and makes no network or database calls. `pnpm test:db` runs the watchlist repository against the compose Postgres — start it first with `docker compose up -d db`.
```

- [ ] **Step 11: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add server/watchlist tests/db-integration vitest.config.ts vitest.db.config.ts package.json .env.example README.md
git commit -m "Add the watchlist repository, tested against a real Postgres

Ownership is enforced in the where clause of every query, so a wrong user id
returns nothing rather than someone else's rows. The idempotency and isolation
tests run against real Postgres because mocking Drizzle would prove nothing
about the unique constraint, which is the part that can actually be wrong."
```

- [ ] **Step 12: Open the bloc 1 pull request**

Push `bloc-4-schema` and open a PR covering Tasks 1–3. The body carries the verification record: the `\d watchlist_items` output, the 10 passing integration tests, and the duplicate-insert proof from Step 9.

---

## Bloc 2 — Auth.js wiring (`bloc-5-auth`)

### Task 4: Auth.js configuration and the route handler

**Files:**
- Create: `server/auth/config.ts`
- Create: `server/auth/actions.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Modify: `.env.example`
- Test: `tests/auth/config.test.ts`

**Interfaces:**
- Consumes: `getDb` from `@/server/db/client`; `users`, `accounts`, `sessions` from `@/server/db/schema`.
- Produces:
  - `@/server/auth/config` exports `handlers`, `auth`, `signIn`, `signOut`. `auth()` resolves to `Session | null`, and a session's `user.id` is a `users.id`.
  - `@/server/auth/actions` exports `signInWithProvider(provider: 'github' | 'google', callbackUrl: string): Promise<void>` and `signOutAction(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('auth config', () => {
  it('imports without a DATABASE_URL', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const mod = await import('@/server/auth/config')
      expect(typeof mod.auth).toBe('function')
      expect(typeof mod.signIn).toBe('function')
      expect(typeof mod.signOut).toBe('function')
      expect(mod.handlers).toHaveProperty('GET')
      expect(mod.handlers).toHaveProperty('POST')
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved
    }
  })
})
```

This is the regression guard for the constraint that matters most in this task: `next build` evaluates route modules during page-data collection, and the Docker build stage has no `DATABASE_URL`. A module-scope `DrizzleAdapter(getDb())` fails this test exactly as it would fail the container build.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/auth/config.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Check whether a session callback is needed**

```bash
grep -rn "id" node_modules/next-auth/lib/types.d.ts | grep -i "session\|user" | head -20
```

If `Session["user"]` already carries `id` under the database strategy, omit the `callbacks` block in Step 4. If it does not, keep it. Do not include a callback that only restates a default.

- [ ] **Step 4: Write the config**

Create `server/auth/config.ts`:

```ts
import 'server-only'
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { getDb } from '@/server/db/client'
import { accounts, sessions, users } from '@/server/db/schema'

// Lazy: next build evaluates route modules while collecting page data, so building the
// adapter at module scope would construct a database client during a build that has no
// DATABASE_URL — which is every Docker build stage.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  session: { strategy: 'database' },
  providers: [GitHub, Google],
  pages: { signIn: '/signin' },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
}))
```

If Task 1 Step 3 found `verificationTokensTable` to be required, add `verificationTokensTable: verificationTokens` to the adapter call and import it.

Providers are called without arguments on purpose: Auth.js infers `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the provider ids.

- [ ] **Step 5: Write the actions**

Create `server/auth/actions.ts`:

```ts
'use server'
import { signIn, signOut } from '@/server/auth/config'

export async function signInWithProvider(
  provider: 'github' | 'google',
  callbackUrl: string,
): Promise<void> {
  await signIn(provider, { redirectTo: callbackUrl })
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' })
}
```

- [ ] **Step 6: Write the route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/server/auth/config'

export const { GET, POST } = handlers
```

`config.ts` exports `handlers`, not `GET` and `POST`, so a bare `export { GET, POST } from '@/server/auth/config'` will not resolve.

- [ ] **Step 7: Run the test and watch it pass**

```bash
npx vitest run tests/auth/config.test.ts
```

Expected: PASS.

- [ ] **Step 8: Document the environment**

Add to `.env.example`, each with an empty value: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. `AUTH_SECRET` and `AUTH_URL` are already listed and now become live rather than aspirational.

- [ ] **Step 9: Prove the build survives without a database**

```bash
env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm build
```

Expected: PASS. This is the container build stage's exact condition; if it fails, the adapter is being constructed too early.

- [ ] **Step 10: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add server/auth app/api/auth tests/auth .env.example
git commit -m "Wire Auth.js with the Drizzle adapter and database sessions

The config is built lazily so no database client exists at module load: next
build evaluates route modules while collecting page data, and the Docker build
stage has no DATABASE_URL. A test imports the module with DATABASE_URL unset so
that regression fails in vitest rather than in a container build."
```

---

### Task 5: The sign-in page

**Files:**
- Create: `lib/callback-url.ts`
- Create: `app/signin/page.tsx`
- Test: `tests/callback-url.test.ts`

**Interfaces:**
- Consumes: `signInWithProvider` from `@/server/auth/actions`.
- Produces: `safeCallbackUrl(raw: string | string[] | undefined): string` in `@/lib/callback-url` — returns a same-origin relative path, defaulting to `'/'`.

- [ ] **Step 1: Write the failing test**

Create `tests/callback-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { safeCallbackUrl } from '@/lib/callback-url'

describe('safeCallbackUrl', () => {
  it('keeps a relative path', () => {
    expect(safeCallbackUrl('/title/movie/157336')).toBe('/title/movie/157336')
    expect(safeCallbackUrl('/watchlist')).toBe('/watchlist')
  })

  it('keeps a query string', () => {
    expect(safeCallbackUrl('/search?q=dune')).toBe('/search?q=dune')
  })

  it('rejects an absolute URL', () => {
    expect(safeCallbackUrl('https://evil.example/steal')).toBe('/')
    expect(safeCallbackUrl('http://evil.example')).toBe('/')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeCallbackUrl('//evil.example/steal')).toBe('/')
  })

  it('rejects a backslash-obscured host', () => {
    expect(safeCallbackUrl('/\\evil.example')).toBe('/')
  })

  it('falls back for anything missing or repeated', () => {
    expect(safeCallbackUrl(undefined)).toBe('/')
    expect(safeCallbackUrl('')).toBe('/')
    expect(safeCallbackUrl(['/a', '/b'])).toBe('/a')
    expect(safeCallbackUrl('watchlist')).toBe('/')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/callback-url.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `lib/callback-url.ts`:

```ts
export function safeCallbackUrl(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
```

An unvalidated `callbackUrl` is an open redirect: the second and third checks are what stop `//evil.example` and `/\evil.example`, both of which a browser resolves as another host despite the leading slash.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/callback-url.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the sign-in page**

Create `app/signin/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { safeCallbackUrl } from '@/lib/callback-url'
import { signInWithProvider } from '@/server/auth/actions'

export const metadata: Metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email address is already registered with a different sign-in provider. Use the one you signed in with the first time.',
  AccessDenied: 'That account is not permitted to sign in.',
}

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const { callbackUrl: rawCallback, error: rawError } = await searchParams
  const callbackUrl = safeCallbackUrl(rawCallback)
  const errorKey = Array.isArray(rawError) ? rawError[0] : rawError
  const message = errorKey ? (ERRORS[errorKey] ?? 'Sign-in failed. Please try again.') : null

  const withGitHub = signInWithProvider.bind(null, 'github', callbackUrl)
  const withGoogle = signInWithProvider.bind(null, 'google', callbackUrl)

  return (
    <main>
      <div className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to keep a watchlist. We store only what your provider tells us: your name,
          email address, and avatar.
        </p>

        {message ? (
          <p role="alert" className="mt-6 rounded-md bg-red-500/10 p-3 text-sm text-red-200">
            {message}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3">
          <form action={withGitHub}>
            <button
              type="submit"
              className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Continue with GitHub
            </button>
          </form>
          <form action={withGoogle}>
            <button
              type="submit"
              className="w-full rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
```

`OAuthAccountNotLinked` has explicit copy because account linking is deliberately off: a user who signed up with GitHub and then tries Google on the same address will land here, and the default error page explains nothing.

- [ ] **Step 6: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add lib/callback-url.ts app/signin tests/callback-url.test.ts
git commit -m "Add the sign-in page for both providers

callbackUrl is validated as a same-origin relative path before use; without
that check the parameter is an open redirect, and a leading slash is not
sufficient proof of one — //host and /\\host both resolve elsewhere."
```

---

### Task 6: Session state in the header

**Files:**
- Modify: `components/site-header.tsx`
- Test: `tests/site-header.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/server/auth/config`; `signOutAction` from `@/server/auth/actions`.
- Produces: a header that renders the user's name and a sign-out control when signed in, and a Sign in link otherwise.

- [ ] **Step 1: Write the failing test**

Create `tests/site-header.test.ts`, following the file-reading style already used by `tests/attribution.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const header = () => readFileSync('components/site-header.tsx', 'utf8')

describe('site header', () => {
  it('reads the session on the server', () => {
    expect(header()).toContain("from '@/server/auth/config'")
    expect(header()).toMatch(/await auth\(\)/)
  })

  it('is not a client component', () => {
    expect(header()).not.toContain("'use client'")
  })

  it('offers sign-in when signed out and sign-out when signed in', () => {
    expect(header()).toContain('/signin')
    expect(header()).toContain('signOutAction')
  })
})
```

The second assertion is the one worth keeping: a `'use client'` header could not call `auth()`, and reaching for `next-auth/react` to compensate would put the session in the browser bundle.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/site-header.test.ts
```

Expected: FAIL — the header imports neither.

- [ ] **Step 3: Rewrite the header**

Replace `components/site-header.tsx`:

```tsx
import Link from 'next/link'
import { signOutAction } from '@/server/auth/actions'
import { auth } from '@/server/auth/config'

export async function SiteHeader() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 py-4">
      <nav className="mx-auto flex max-w-7xl items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My Movies
        </Link>
        <Link href="/search" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Search
        </Link>
        {session ? (
          <Link
            href="/watchlist"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Watchlist
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session ? (
            <>
              <span className="text-[var(--muted)]">{session.user?.name ?? session.user?.email}</span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
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

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/site-header.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Sign in for real, with both providers**

```bash
docker compose up -d db
pnpm dev
```

Visit `http://localhost:3000`, sign in with GitHub, confirm the header shows your name, sign out, then sign in with Google. Then show the rows:

```bash
docker compose exec -T db psql -U postgres -d movies \
  -c "select u.email, a.provider from users u join accounts a on a.user_id = u.id;" \
  -c "select count(*) from sessions;"
```

Expected: one row per provider you used, and at least one session. Paste the output into the task report.

**This step is also what finally proves the GitHub callback URL**, which no probe could verify — GitHub defers redirect-URI validation until after login. If it is wrong, the failure appears here as a `redirect_uri` mismatch from GitHub.

If both providers were used with the same email address, expect `OAuthAccountNotLinked` on the second — that is the designed behaviour, and the sign-in page should now explain it in words.

- [ ] **Step 6: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add components/site-header.tsx tests/site-header.test.ts
git commit -m "Show session state in the header

The header stays a server component and reads the session directly; making it
a client component would mean next-auth/react and a session in the browser
bundle. Reading the session in the root layout makes every route render at
request time, which the spec records as accepted."
```

- [ ] **Step 7: Open the bloc 2 pull request**

Push `bloc-5-auth` and open a PR covering Tasks 4–6. The body carries the sign-in evidence from Task 6 Step 5 and the no-database build proof from Task 4 Step 9.

---

## Bloc 3 — The watchlist (`bloc-6-watchlist`)

### Task 7: The toggle server action

**Files:**
- Create: `lib/watchlist-input.ts`
- Create: `server/watchlist/actions.ts`
- Test: `tests/watchlist-input.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/server/auth/config`; `getTitleDetail` from `@/server/tmdb/endpoints/titles`; `addToWatchlist`, `isInWatchlist`, `removeFromWatchlist` from `@/server/watchlist/queries`.
- Produces:
  - `parseToggleInput(input: unknown): { tmdbId: number; mediaType: MediaType } | null` in `@/lib/watchlist-input`
  - `type ToggleResult = { ok: true; inWatchlist: boolean } | { ok: false; message: string }`
  - `toggleWatchlist(input: unknown): Promise<ToggleResult>` in `@/server/watchlist/actions`

- [ ] **Step 1: Write the failing test**

Create `tests/watchlist-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseToggleInput } from '@/lib/watchlist-input'

describe('parseToggleInput', () => {
  it('accepts a well-formed payload', () => {
    expect(parseToggleInput({ tmdbId: 157336, mediaType: 'movie' })).toEqual({
      tmdbId: 157336,
      mediaType: 'movie',
    })
    expect(parseToggleInput({ tmdbId: 95396, mediaType: 'tv' })).toEqual({
      tmdbId: 95396,
      mediaType: 'tv',
    })
  })

  it('rejects a media type outside the union', () => {
    expect(parseToggleInput({ tmdbId: 1, mediaType: 'person' })).toBeNull()
    expect(parseToggleInput({ tmdbId: 1, mediaType: '' })).toBeNull()
  })

  it('rejects an id that is not a positive integer', () => {
    expect(parseToggleInput({ tmdbId: 0, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: -5, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: 1.5, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: Number.NaN, mediaType: 'movie' })).toBeNull()
    expect(parseToggleInput({ tmdbId: '157336', mediaType: 'movie' })).toBeNull()
  })

  it('rejects anything that is not an object with both fields', () => {
    expect(parseToggleInput(null)).toBeNull()
    expect(parseToggleInput(undefined)).toBeNull()
    expect(parseToggleInput('157336')).toBeNull()
    expect(parseToggleInput({ tmdbId: 157336 })).toBeNull()
    expect(parseToggleInput({ mediaType: 'movie' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/watchlist-input.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the parser**

Create `lib/watchlist-input.ts`:

```ts
import type { MediaType } from '@/server/tmdb/types'

export function parseToggleInput(
  input: unknown,
): { tmdbId: number; mediaType: MediaType } | null {
  if (typeof input !== 'object' || input === null) return null

  const { tmdbId, mediaType } = input as { tmdbId?: unknown; mediaType?: unknown }
  if (typeof tmdbId !== 'number' || !Number.isInteger(tmdbId) || tmdbId <= 0) return null
  if (mediaType !== 'movie' && mediaType !== 'tv') return null

  return { tmdbId, mediaType }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/watchlist-input.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the action**

Create `server/watchlist/actions.ts`:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { parseToggleInput } from '@/lib/watchlist-input'
import { auth } from '@/server/auth/config'
import { getTitleDetail } from '@/server/tmdb/endpoints/titles'
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from '@/server/watchlist/queries'

export type ToggleResult = { ok: true; inWatchlist: boolean } | { ok: false; message: string }

export async function toggleWatchlist(input: unknown): Promise<ToggleResult> {
  const parsed = parseToggleInput(input)
  if (!parsed) return { ok: false, message: 'That title could not be identified.' }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false, message: 'Sign in to use your watchlist.' }

  const { tmdbId, mediaType } = parsed
  let nowInWatchlist: boolean

  try {
    if (await isInWatchlist(userId, tmdbId, mediaType)) {
      await removeFromWatchlist(userId, tmdbId, mediaType)
      nowInWatchlist = false
    } else {
      const detail = await getTitleDetail(mediaType, tmdbId)
      await addToWatchlist(userId, {
        tmdbId,
        mediaType,
        title: detail.media_type === 'movie' ? detail.title : detail.name,
        posterPath: detail.poster_path,
      })
      nowInWatchlist = true
    }
  } catch (error) {
    console.error('watchlist toggle failed:', error)
    return { ok: false, message: 'Could not update your watchlist. Try again.' }
  }

  revalidatePath('/watchlist')
  revalidatePath(`/title/${mediaType}/${tmdbId}`)
  return { ok: true, inWatchlist: nowInWatchlist }
}
```

Three things this shape buys, none of them incidental:

The action re-reads the session itself rather than trusting the page that rendered the button — a server action is reachable by direct POST.

The title and poster come from `getTitleDetail`, not from the caller, so a hand-crafted request cannot write arbitrary strings into the database. The detail response is already cached, so this is not an extra round trip in practice.

It returns a result instead of throwing. A throw inside the client's `useTransition` would reach the nearest error boundary and blank the detail page.

- [ ] **Step 6: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add lib/watchlist-input.ts server/watchlist/actions.ts tests/watchlist-input.test.ts
git commit -m "Add the watchlist toggle action

The action authenticates independently of any page-level check, because a
server action is reachable by direct POST, and it builds the stored snapshot
from TMDB rather than from the request body so a hand-crafted call cannot
write arbitrary strings."
```

---

### Task 8: The optimistic toggle button

**Files:**
- Create: `components/watchlist-button.tsx`
- Modify: `app/title/[mediaType]/[id]/page.tsx`
- Test: `tests/watchlist-button.test.ts`

**Interfaces:**
- Consumes: `toggleWatchlist`, `ToggleResult` from `@/server/watchlist/actions`; `MediaType` from `@/server/tmdb/types`.
- Produces: `<WatchlistButton tmdbId mediaType inWatchlist signedIn returnTo />` from `@/components/watchlist-button`.

- [ ] **Step 1: Write the failing test**

Create `tests/watchlist-button.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = () => readFileSync('components/watchlist-button.tsx', 'utf8')

describe('watchlist button', () => {
  it('is a client component using optimistic state inside a transition', () => {
    const code = source()
    expect(code.startsWith("'use client'")).toBe(true)
    expect(code).toContain('useOptimistic')
    expect(code).toContain('startTransition')
  })

  it('sends only the id and media type, never the snapshot', () => {
    const code = source()
    expect(code).toContain('toggleWatchlist({ tmdbId, mediaType })')
    expect(code).not.toContain('posterPath')
    expect(code).not.toContain('title:')
  })

  it('surfaces a failed toggle in a live region rather than throwing', () => {
    const code = source()
    expect(code).toContain('role="status"')
    expect(code).toContain('result.ok')
  })

  it('links to sign-in instead of toggling when signed out', () => {
    expect(source()).toContain('/signin?callbackUrl=')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/watchlist-button.test.ts
```

Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the component**

Create `components/watchlist-button.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { toggleWatchlist } from '@/server/watchlist/actions'
import type { MediaType } from '@/server/tmdb/types'

interface WatchlistButtonProps {
  tmdbId: number
  mediaType: MediaType
  inWatchlist: boolean
  signedIn: boolean
  returnTo: string
}

export function WatchlistButton({
  tmdbId,
  mediaType,
  inWatchlist,
  signedIn,
  returnTo,
}: WatchlistButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(inWatchlist)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(returnTo)}`}
        className="inline-flex rounded-md border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Sign in to add to your watchlist
      </Link>
    )
  }

  function handleClick() {
    setError(null)
    startTransition(async () => {
      setOptimistic(!optimistic)
      const result = await toggleWatchlist({ tmdbId, mediaType })
      if (!result.ok) setError(result.message)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex w-fit rounded-md border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {optimistic ? 'Remove from watchlist' : 'Add to watchlist'}
      </button>
      <p role="status" className="text-sm text-red-300 empty:hidden">
        {error}
      </p>
    </div>
  )
}
```

The label carries the state, so no `aria-pressed` — one mechanism announcing the change, not two. When the transition ends, `optimistic` reverts to the freshly server-rendered `inWatchlist` prop; that reversion is the rollback, and the `role="status"` region is what tells the user why.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/watchlist-button.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into the detail page**

In `app/title/[mediaType]/[id]/page.tsx`, add to the imports:

```ts
import { WatchlistButton } from '@/components/watchlist-button'
import { auth } from '@/server/auth/config'
import { isInWatchlist } from '@/server/watchlist/queries'
```

Inside `TitlePage`, after `const images = await getImageConfig()`:

```ts
  const session = await auth()
  const userId = session?.user?.id
  const inWatchlist = userId ? await isInWatchlist(userId, id, mediaType) : false
```

Then render the control below the title's metadata, inside the existing text column:

```tsx
        <WatchlistButton
          tmdbId={id}
          mediaType={mediaType}
          inWatchlist={inWatchlist}
          signedIn={Boolean(userId)}
          returnTo={`/title/${mediaType}/${id}`}
        />
```

- [ ] **Step 6: Exercise it in the browser**

```bash
docker compose up -d db
pnpm dev
```

Signed out, open a title page: the control is a link to sign-in. Sign in, reload, and click Add — the label must flip **before** the request finishes. Reload to confirm it persisted, click Remove, reload again. Then:

```bash
docker compose exec -T db psql -U postgres -d movies \
  -c "select user_id, tmdb_id, media_type, title, added_at from watchlist_items;"
```

Paste the rows into the task report.

- [ ] **Step 7: Watch the rollback happen**

Stop the database under the running dev server and click the toggle:

```bash
docker compose stop db
```

Expected: the label flips optimistically, then reverts, and the `role="status"` region shows "Could not update your watchlist. Try again." The page must not be replaced by an error boundary — if it is, the action is throwing where it should return `{ ok: false }`. Restart with `docker compose start db`.

- [ ] **Step 8: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add components/watchlist-button.tsx 'app/title/[mediaType]/[id]/page.tsx' tests/watchlist-button.test.ts
git commit -m "Add the optimistic watchlist toggle to the detail page

The optimistic value reverts when the transition ends, which is the rollback;
the action returns a result rather than throwing so a failure lands in a live
region instead of the nearest error boundary."
```

---

### Task 9: The watchlist page

**Files:**
- Create: `app/watchlist/page.tsx`
- Create: `app/watchlist/loading.tsx`
- Test: `tests/watchlist-page.test.ts`

**Interfaces:**
- Consumes: `auth`; `listForUser`; `getImageConfig` from `@/server/tmdb/images`; `PosterCard`; `WatchlistButton`.
- Produces: `/watchlist`, rendering the stored snapshot with no TMDB request per item.

- [ ] **Step 1: Write the failing test**

Create `tests/watchlist-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = () => readFileSync('app/watchlist/page.tsx', 'utf8')

describe('watchlist page', () => {
  it('redirects a signed-out visitor to sign-in and back', () => {
    const code = page()
    expect(code).toContain('await auth()')
    expect(code).toContain("redirect('/signin?callbackUrl=%2Fwatchlist')")
  })

  it('scopes the query to the session user', () => {
    expect(page()).toContain('listForUser(session.user.id)')
  })

  it('renders from the stored snapshot, not per-item TMDB calls', () => {
    const code = page()
    expect(code).not.toContain('getTitleDetail')
  })
})
```

The third assertion is the one that protects the design: the denormalised snapshot exists precisely so this page does not fan out into one TMDB request per row.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/watchlist-page.test.ts
```

Expected: FAIL — the page does not exist.

- [ ] **Step 3: Write the page**

Create `app/watchlist/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PosterCard } from '@/components/poster-card'
import { WatchlistButton } from '@/components/watchlist-button'
import { auth } from '@/server/auth/config'
import { getImageConfig } from '@/server/tmdb/images'
import { listForUser } from '@/server/watchlist/queries'

export const metadata: Metadata = { title: 'Watchlist' }

export default async function WatchlistPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin?callbackUrl=%2Fwatchlist')

  const [items, images] = await Promise.all([listForUser(session.user.id), getImageConfig()])

  return (
    <main>
      <h1 className="mx-auto max-w-7xl px-6 pt-8 text-2xl font-bold tracking-tight">Watchlist</h1>

      {items.length === 0 ? (
        <p className="mx-auto max-w-7xl px-6 py-10 text-[var(--muted)]">
          Nothing saved yet.{' '}
          <Link href="/" className="underline hover:text-[var(--foreground)]">
            Browse something to add
          </Link>
          .
        </p>
      ) : (
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {items.map((item) => (
            <li key={`${item.mediaType}-${item.tmdbId}`} className="flex flex-col gap-2">
              <PosterCard
                item={{
                  id: item.tmdbId,
                  title: item.title,
                  posterPath: item.posterPath,
                  mediaType: item.mediaType,
                }}
                imageBase={images.secure_base_url}
                posterSizes={images.poster_sizes}
                variant="grid"
              />
              <WatchlistButton
                tmdbId={item.tmdbId}
                mediaType={item.mediaType}
                inWatchlist
                signedIn
                returnTo="/watchlist"
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

`PosterCard` is fed from the stored snapshot, so this page makes exactly one TMDB request — `getImageConfig()`, which is cached — regardless of how many titles are saved.

- [ ] **Step 4: Add the skeleton**

Create `app/watchlist/loading.tsx`, matching the grid the page renders:

```tsx
export default function Loading() {
  return (
    <main>
      <div className="mx-auto h-8 max-w-7xl px-6 pt-8" />
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <li key={index}>
            <div className="aspect-[2/3] animate-pulse rounded-md bg-white/5" />
            <div className="mt-2 h-10 space-y-1.5">
              <div className="h-4 w-full animate-pulse rounded bg-white/5" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run tests/watchlist-page.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Exercise the whole loop in the browser**

Signed out, visit `/watchlist` — expect a redirect to `/signin`, and after signing in, a return to `/watchlist`. Add two titles from detail pages, confirm both appear newest-first, remove one from the watchlist page itself and confirm it disappears without a full reload. Confirm the empty state renders once everything is removed.

- [ ] **Step 7: Run the full gate and commit**

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db
git add app/watchlist tests/watchlist-page.test.ts
git commit -m "Add the watchlist page

Rendered entirely from the denormalised snapshot, so the page makes one cached
TMDB request for image configuration and none per row."
```

---

### Task 10: Close-out across both drivers

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-08-29-auth-watchlist-slice-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a verification record covering both database drivers, and a README that describes what now exists.

- [ ] **Step 1: Verify the container path writes**

```bash
docker build -t movies-app .
docker compose up -d --build
```

Sign in at `http://localhost:3000`, add a title, then:

```bash
docker compose exec -T db psql -U postgres -d movies \
  -c "select u.email, w.title, w.media_type from users u join watchlist_items w on w.user_id = u.id;"
```

Expected: the row you just added. This is the first time the `node-postgres` branch has written anything, and it is what makes the image's claim of self-containment true rather than assumed.

- [ ] **Step 2: Confirm no secret rode into the image**

```bash
docker run --rm --entrypoint sh movies-app -c 'ls -a /app; cat /app/.env* 2>/dev/null; echo "exit: $?"'
```

Expected: no `.env` file of any kind.

- [ ] **Step 3: Apply the migration to Neon**

```bash
DATABASE_URL_UNPOOLED="<the Neon direct connection string>" pnpm db:migrate
```

Take the value from the Vercel dashboard; do not paste it into a file, a commit, or a terminal transcript that will be shared.

- [ ] **Step 4: Verify the Vercel path writes after merge**

Once bloc 3 is merged and deployed, sign in at `https://my-movies-plum.vercel.app`, add a title, and confirm it survives a reload and appears on `/watchlist`.

This closes the gap the spec opens with: both driver branches had opened a connection, but neither had ever written. After this step, `neon-http` and `node-postgres` have each executed a real insert.

- [ ] **Step 5: Update the README**

Rewrite the "Not built yet" entry for sign-in and the watchlist — both now exist — and extend "What is verified, and what is not" with: both providers signed in against a real database; a watchlist row written and read back through `node-postgres` in the container and `neon-http` on Vercel; the optimistic toggle rolling back with the database stopped.

State plainly anything you did not verify. If preview deployments were never exercised, say so — sign-in cannot complete there by design.

- [ ] **Step 6: Mark the spec implemented**

Change the spec's `Status:` line from `approved, not yet implemented` to `implemented 2026-08-29`, adjusting the date to the day the bloc merges. Do not tick checkboxes in this plan file; the PR bodies carry the verification record.

- [ ] **Step 7: Commit and open the bloc 3 pull request**

```bash
git add README.md docs/superpowers/specs/2026-08-29-auth-watchlist-slice-design.md
git commit -m "Record slice 2 verification across both database drivers"
```

Push `bloc-6-watchlist` and open the PR. The body carries: the container write, the Vercel write, the rollback behaviour, and an explicit list of what was not verified.
