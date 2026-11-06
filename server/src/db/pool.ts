import { Pool } from 'pg';
import { env } from '../config/env.js';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!env.DATABASE_URL)
    throw new Error('Set DATABASE_URL in server/.env before using the database.');
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    });
    pool.on('error', () => {
      console.error('Unexpected idle PostgreSQL connection error.');
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
