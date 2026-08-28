import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getDb().execute(sql`select 1`)
    return Response.json({ status: 'ok' })
  } catch (error) {
    console.error('health check failed:', error)
    // The response body stays generic deliberately: this route is unauthenticated, and a
    // connection error's message carries the database host and user.
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 })
  }
}
