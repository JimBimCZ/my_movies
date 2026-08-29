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
