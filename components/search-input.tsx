'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const initial = useRef(true)

  useEffect(() => {
    if (initial.current) {
      initial.current = false
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
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
