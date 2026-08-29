import { createHash, timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { isKnownTag } from '@/server/tmdb/cache'

// Digests rather than the raw bytes: timingSafeEqual throws on unequal lengths, and guarding
// that with an early length comparison would leak the configured secret's length.
function matchesSecret(provided: string | null, expected: string): boolean {
  if (provided === null) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(provided), digest(expected))
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    return Response.json({ error: 'revalidation is not configured' }, { status: 503 })
  }

  if (!matchesSecret(request.headers.get('x-revalidate-secret'), secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const tag = (body as { tag?: unknown } | null)?.tag
  if (typeof tag !== 'string' || !isKnownTag(tag)) {
    return Response.json({ error: 'unknown tag' }, { status: 400 })
  }

  // Next 16 requires a cacheLife profile here. 'max' is what the docs prescribe for
  // stale-while-revalidate: the stale entry keeps serving while the refetch runs, so purging a
  // row's worth of tags cannot stall a render on TMDB. updateTag would expire immediately, but
  // it is callable only from a Server Action, not a Route Handler.
  revalidateTag(tag, 'max')
  return Response.json({ revalidated: true, tag })
}
