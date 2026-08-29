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
  title?: string
}

export function WatchlistButton({
  tmdbId,
  mediaType,
  inWatchlist,
  signedIn,
  returnTo,
  title,
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
        {/* A watchlist page renders one of these per row, so the visible label alone leaves
            every button with the same accessible name. Appended, not substituted: dropping
            the visible words would stop speech input matching the control. */}
        {title ? <span className="sr-only"> — {title}</span> : null}
      </button>
      <p role="status" className="text-sm text-red-300 empty:hidden">
        {error}
      </p>
    </div>
  )
}
