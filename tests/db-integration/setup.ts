import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db'])

function assertLocal(url: string) {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    throw new Error(
      'DATABASE_URL is not a parseable URL, so its host cannot be checked. The integration ' +
        'suite truncates tables, so it only runs against a local database.',
    )
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the integration suite against host "${host}". This suite truncates ` +
        `watchlist_items and users, so it only runs against a local database ` +
        `(${[...LOCAL_HOSTS].join(', ')}). Run \`pnpm test:db\`, which supplies a local ` +
        `DATABASE_URL, instead of relying on whatever is exported in your shell.`,
    )
  }
}

export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Start the local database with ' +
        '`set -a; . ./.env.local; set +a; docker compose up -d db` and run `pnpm test:db`, ' +
        'which supplies it.',
    )
  }
  assertLocal(url)

  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './server/db/migrations' })
  } finally {
    await pool.end()
  }
}
