import type { Session } from 'next-auth'

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

// The default session callback returns only name, email and image; every downstream
// watchlist query needs the user id. Returning the merged adapter session verbatim
// would also leak `sessionToken` — the value the cookie's httpOnly flag hides — into
// the JSON body of GET /api/auth/session, so this returns a projection instead.
export function projectSession(user: SessionUser, expires: Date): Session {
  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    expires: expires.toISOString(),
  }
}
