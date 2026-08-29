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
