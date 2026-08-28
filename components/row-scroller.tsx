'use client'

import { useRef, type FocusEvent, type ReactNode } from 'react'

export function RowScroller({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  const scrollFocusedIntoView = (event: FocusEvent<HTMLDivElement>) => {
    const track = trackRef.current
    const target = event.target
    if (!track || !(target instanceof HTMLElement)) return
    const trackRect = track.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const fullyVisible = targetRect.left >= trackRect.left && targetRect.right <= trackRect.right
    if (fullyVisible) return
    track.scrollBy({ left: targetRect.left - trackRect.left, behavior: 'smooth' })
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
      {/*
        Native focus-follows-scroll (and scrollIntoView({ inline: 'nearest' })) only scrolls
        when the newly focused card has zero overlap with the track's visible width. Since
        clientWidth is rarely an exact multiple of card width + gap, the trailing card of each
        "page" is left partially clipped and gets skipped by that check. Compute and apply the
        correction ourselves instead of trusting the browser to fully reveal it.
      */}
      <div
        ref={trackRef}
        onFocus={scrollFocusedIntoView}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
