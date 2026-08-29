import 'server-only'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import NextAuth, { type Session } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import { getDb } from '@/server/db/client'
import { accounts, sessions, users } from '@/server/db/schema'

type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

// The default session callback returns only name, email and image; every downstream
// watchlist query needs the user id. Returning the merged adapter session verbatim
// would also leak `sessionToken` — the value the cookie's httpOnly flag hides — into
// the JSON body of GET /api/auth/session, so this returns a projection instead. A named,
// exported function so the projection can be unit-tested without a database or a server.
export function projectSession(user: SessionUser, expires: Date): Session {
  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    expires: expires.toISOString(),
  }
}

// next build evaluates route modules while collecting page data, so building the adapter at
// module scope would construct a database client during a build that has no DATABASE_URL —
// which is every Docker build stage.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(
    // Db omits `transaction` because neon-http cannot offer one; the adapter's parameter type
    // requires it but its Postgres implementation never calls it (0 hits for `transaction` in
    // @auth/drizzle-adapter/lib/pg.js), so the mismatch is type-level only.
    getDb() as unknown as PgDatabase<PgQueryResultHKT, Record<string, never>>,
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
    },
  ),
  session: { strategy: 'database' },
  providers: [GitHub, Google],
  pages: { signIn: '/signin' },
  callbacks: {
    session({ session, user }) {
      return projectSession(user, session.expires)
    },
  },
}))
