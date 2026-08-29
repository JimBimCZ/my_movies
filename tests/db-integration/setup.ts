import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Start the local database with ' +
        '`set -a; . ./.env.local; set +a; docker compose up -d db` and run `pnpm test:db`, ' +
        'which supplies it.',
    )
  }

  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './server/db/migrations' })
  } finally {
    await pool.end()
  }
}
