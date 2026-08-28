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

function load(): NodePgDatabase<typeof schema> {
  instance ??= createDb()
  return instance
}

function bound(target: NodePgDatabase<typeof schema>, prop: PropertyKey) {
  const value = target[prop as keyof typeof target]
  return typeof value === 'function' ? value.bind(target) : value
}

// next build evaluates route modules during page-data collection — reading `export const
// dynamic` is itself what forces evaluation — so eager construction fails any build without
// DATABASE_URL, including the Docker build stage. Deferring to first access keeps the
// branch-once contract; resolveDriver staying unit-testable is a side effect, not the reason.
//
// Every trap that can observe the target's shape must go through load() and delegate to the
// real instance. get/has/ownKeys/getOwnPropertyDescriptor alone left [[Set]] falling through to
// the empty target: an assignment would install a non-configurable data property there, and the
// get trap would then permanently violate the proxy invariant on that key. set/defineProperty/
// deleteProperty close that gap so a write behaves like it would on the real instance instead of
// poisoning the proxy.
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return bound(load(), prop)
  },
  has(_target, prop) {
    return prop in load()
  },
  ownKeys() {
    return Reflect.ownKeys(load())
  },
  getOwnPropertyDescriptor(_target, prop) {
    const target = load()
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop)
    if (!descriptor) return descriptor
    return { ...descriptor, value: bound(target, prop) }
  },
  set(_target, prop, value) {
    return Reflect.set(load(), prop, value)
  },
  defineProperty(_target, prop, descriptor) {
    return Reflect.defineProperty(load(), prop, descriptor)
  },
  deleteProperty(_target, prop) {
    return Reflect.deleteProperty(load(), prop)
  },
})
