import type { TitleDetail } from '@/server/tmdb/endpoints/titles'
import type { CastMember, Credits, ImageAsset, TitleImages, Video } from '@/server/tmdb/types'

export interface TitleFact {
  label: string
  value: string
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

// TMDB dates are plain YYYY-MM-DD. Parsing one as a bare Date makes it local
// midnight, which lands on the previous day west of UTC, so both the parse and
// the format are pinned to UTC.
function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function toTitleFacts(detail: TitleDetail): TitleFact[] {
  const facts: TitleFact[] = []

  if (detail.media_type === 'movie') {
    const directors = detail.credits.crew.filter((member) => member.job === 'Director')
    if (directors.length > 0) {
      facts.push({ label: 'Director', value: directors.map((member) => member.name).join(', ') })
    }
    if (detail.release_date) facts.push({ label: 'Released', value: formatDate(detail.release_date) })
    if (detail.runtime > 0) facts.push({ label: 'Runtime', value: formatRuntime(detail.runtime) })
  } else {
    if (detail.created_by.length > 0) {
      facts.push({ label: 'Creator', value: detail.created_by.map((person) => person.name).join(', ') })
    }
    if (detail.first_air_date) {
      facts.push({ label: 'First aired', value: formatDate(detail.first_air_date) })
    }
    if (detail.number_of_seasons > 0) {
      const seasons = plural(detail.number_of_seasons, 'season')
      const episodes = detail.number_of_episodes
      facts.push({
        label: 'Seasons',
        value: episodes ? `${seasons} · ${plural(episodes, 'episode')}` : seasons,
      })
    }
  }

  if (detail.vote_count > 0) {
    facts.push({
      label: 'Rating',
      value: `${detail.vote_average.toFixed(1)} / 10 · ${plural(detail.vote_count, 'vote')}`,
    })
  }
  if (detail.status) facts.push({ label: 'Status', value: detail.status })

  const studio =
    detail.media_type === 'movie' ? detail.production_companies[0]?.name : detail.networks[0]?.name
  if (studio) {
    facts.push({ label: detail.media_type === 'movie' ? 'Studio' : 'Network', value: studio })
  }

  return facts.filter((fact) => fact.value !== '')
}

const TRAILER_RANK = ['Trailer', 'Teaser']

export function pickTrailer(videos: Video[]): Video | null {
  const youtube = videos.filter((item) => item.site === 'YouTube')
  for (const type of TRAILER_RANK) {
    for (const official of [true, false]) {
      const matches = youtube
        .filter((item) => item.type === type && item.official === official)
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
      if (matches[0]) return matches[0]
    }
  }
  return null
}

export function pickCast(credits: Credits, limit: number): CastMember[] {
  return [...credits.cast].sort((a, b) => a.order - b.order).slice(0, limit)
}

export function pickBackdrops(images: TitleImages, limit: number): ImageAsset[] {
  return [...images.backdrops]
    .sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count)
    .slice(0, limit)
}
