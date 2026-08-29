'use client'

import Image from 'next/image'
import { useState } from 'react'

export function TrailerPlayer({
  youtubeKey,
  title,
  thumbnail,
}: {
  youtubeKey: string
  title: string
  thumbnail: string | null
}) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-white/5">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1`}
          title={`${title} trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {thumbnail && (
            <Image src={thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/25">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-black">
              ▶
            </span>
          </span>
          <span className="sr-only">Play trailer for {title}</span>
        </button>
      )}
    </div>
  )
}
