'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  // Tracks the query we last put in the URL ourselves, so we can tell "the
  // URL changed because our own debounced push landed" apart from "the URL
  // changed underneath us" (header-link click, back/forward). Only the
  // latter should overwrite what the user is typing.
  const lastSynced = useRef(urlQuery)
  const skipNextDebounce = useRef(true)

  useEffect(() => {
    if (urlQuery !== lastSynced.current) {
      lastSynced.current = urlQuery
      skipNextDebounce.current = true
      setValue(urlQuery)
    }
  }, [urlQuery])

  useEffect(() => {
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false
      return
    }
    const timer = setTimeout(() => {
      const trimmed = value.trim()
      lastSynced.current = trimmed
      const params = new URLSearchParams()
      if (trimmed) params.set('q', trimmed)
      router.replace(params.toString() ? `/search?${params}` : '/search')
    }, 300)
    return () => clearTimeout(timer)
  }, [value, router])

  return (
    <label className="mx-auto mt-8 block max-w-2xl px-6">
      <span className="mb-2 block text-sm text-[var(--muted)]">Search movies and TV</span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search for a title"
        autoComplete="off"
        className="w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus-visible:border-white/50"
      />
    </label>
  )
}
