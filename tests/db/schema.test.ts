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
    const pk = getTableConfig(accounts).primaryKeys[0]!
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
