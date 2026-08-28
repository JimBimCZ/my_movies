'use client'

import { useRef, type FocusEvent, type ReactNode } from 'react'

// Matches the track's px-6 / scroll-px-6. Landing a card flush against the raw clip edge
// leaves no room for its focus ring, which overflow-x then clips.
const TRACK_SNAP_INSET = 24

export function RowScroller({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  // Native focus-follow (and scrollIntoView 'nearest') treats any overlap with the scrollport
  // as "visible", so the trailing card of each page never gets scrolled fully into view.
  // Guarded to keyboard focus only: onFocus also fires on click, and re-targeting mid-click
  // scrolls the row out from under the pointer.
  const scrollFocusedIntoView = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return
    const track = trackRef.current
    if (!track) return
    const trackRect = track.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const left = trackRect.left + TRACK_SNAP_INSET
    const fullyVisible = targetRect.left >= left && targetRect.right <= trackRect.right
    if (fullyVisible) return
    track.scrollBy({ left: targetRect.left - left, behavior: 'smooth' })
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label={`Scroll ${label} left`}
        className="absolute left-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-r bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 pointer-fine:block"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        onFocus={scrollFocusedIntoView}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth scroll-px-6 px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label={`Scroll ${label} right`}
        className="absolute right-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-l bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 pointer-fine:block"
      >
        ›
      </button>
    </div>
  )
}
