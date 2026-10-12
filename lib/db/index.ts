import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }

// pg treats 'prefer' | 'require' | 'verify-ca' as 'verify-full' and warns about it;
// set 'verify-full' explicitly to keep the same behavior without the warning.
function normalizeConnectionString(url: string | undefined) {
  return url?.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, '$1sslmode=verify-full')
}

export const pool =
  globalForDb.pool ?? new Pool({ connectionString: normalizeConnectionString(process.env.DATABASE_URL) })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
