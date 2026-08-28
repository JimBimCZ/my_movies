'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { initialSearchInputState, syncFromUrl, typed, type SearchInputState } from '@/lib/search-input-state'

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [state, setState] = useState<SearchInputState>(() => initialSearchInputState(urlQuery))
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)

  // A URL change we didn't cause resyncs the box; one we did cause is
  // ignored until it lands, so a late commit can't clobber newer typing.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setState((current) => syncFromUrl(current, urlQuery))
  }

  useEffect(() => {
    if (state.pending === null) return
    const pending = state.pending
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (pending) params.set('q', pending)
      router.replace(params.toString() ? `/search?${params}` : '/search')
    }, 300)
    return () => clearTimeout(timer)
  }, [state.pending, router])

  return (
    <label className="mx-auto mt-8 block max-w-2xl px-6">
      <span className="mb-2 block text-sm text-[var(--muted)]">Search movies and TV</span>
      <input
        type="search"
        value={state.value}
        onChange={(event) => setState(typed(urlQuery, event.target.value))}
        placeholder="Search for a title"
        autoComplete="off"
        className="w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus-visible:border-white/50"
      />
    </label>
  )
}
