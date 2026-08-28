'use client'

import { useRef, type ReactNode } from 'react'

export function RowScroller({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label={`Scroll ${label} left`}
        className="absolute left-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-r bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 md:block"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label={`Scroll ${label} right`}
        className="absolute right-0 top-1/3 z-10 hidden h-16 w-10 -translate-y-1/2 rounded-l bg-black/70 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 md:block"
      >
        ›
      </button>
    </div>
  )
}
