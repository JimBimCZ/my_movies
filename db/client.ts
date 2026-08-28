import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type DriverName = 'neon-http' | 'node-postgres'

export function resolveDriver(env: Record<string, string | undefined>): DriverName {
  const explicit = env.DB_DRIVER
  if (explicit) {
    if (explicit !== 'neon-http' && explicit !== 'node-postgres') {
      throw new Error(`Unsupported DB_DRIVER: ${explicit}`)
    }
    return explicit
  }
  return env.VERCEL ? 'neon-http' : 'node-postgres'
}

function createDb(): NodePgDatabase<typeof schema> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  if (resolveDriver(process.env) === 'neon-http') {
    // Both drivers expose the same Drizzle query-builder surface; typing the export as the
    // node-postgres shape keeps a single type at every call site, which is what lets query
    // code stay driver-agnostic.
    return drizzleNeon(neon(url), { schema }) as unknown as NodePgDatabase<typeof schema>
  }

  return drizzlePg(new Pool({ connectionString: url }), { schema })
}

let instance: NodePgDatabase<typeof schema> | undefined

// next build evaluates route modules during page-data collection — reading `export const
// dynamic` is itself what forces evaluation — so eager construction fails any build without
// DATABASE_URL, including the Docker build stage. Deferring to first access keeps the
// branch-once contract; resolveDriver staying unit-testable is a side effect, not the reason.
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!instance) instance = createDb()
    const value = instance[prop as keyof typeof instance]
    return typeof value === 'function' ? value.bind(instance) : value
  },
  has(_target, prop) {
    if (!instance) instance = createDb()
    return prop in instance
  },
  ownKeys() {
    if (!instance) instance = createDb()
    return Reflect.ownKeys(instance)
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (!instance) instance = createDb()
    return Reflect.getOwnPropertyDescriptor(instance, prop)
  },
})
