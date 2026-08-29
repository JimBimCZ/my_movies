'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { MergedGenre } from '@/lib/genres'

export function GenresMenu({ genres }: { genres: MergedGenre[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setOpen(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setOpen(false)
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="rounded py-1 text-sm text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Genres
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-x-3 top-[4.75rem] z-30 max-h-[70vh] w-auto overflow-y-auto rounded-md border border-white/10 bg-[var(--background)] p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:w-[min(90vw,34rem)]"
      >
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {genres.map((genre) => (
            <li key={genre.slug}>
              <Link
                href={`/genre/${genre.slug}`}
                onClick={() => setOpen(false)}
                className="block rounded py-1 text-sm text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {genre.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
