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
    expect(rows[0]!.title).toBe('Interstellar')
    expect(rows[0]!.posterPath).toBe('/a.jpg')
    expect(rows[0]!.addedAt).toBeInstanceOf(Date)
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
    expect((await listForUser(ALICE))[0]!.posterPath).toBeNull()
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
