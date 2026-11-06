import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { QueryResultRow } from 'pg';
import { closePool, getPool } from '../src/db/pool.js';

interface AppliedMigration extends QueryResultRow {
  name: string;
  checksum: string;
}

const directory = new URL('./migrations/', import.meta.url);

async function migrate() {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.some((name) => !/^\d{3}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new Error('Migration names must match NNN_snake_case.sql.');
  }
  const numbers = names.map((name) => name.slice(0, 3));
  if (new Set(numbers).size !== numbers.length) throw new Error('Duplicate migration numbers.');
  const client = await getPool().connect();
  try {
    // Session lock serializes migration runners; use a direct connection, not a transaction pooler.
    await client.query('SELECT pg_advisory_lock($1)', [184206]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<AppliedMigration>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    for (const name of applied.keys()) {
      if (!names.includes(name)) throw new Error(`Missing applied migration: ${name}`);
    }
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== checksum)
          throw new Error(`Applied migration was modified: ${name}`);
        continue;
      }
      if (rows.some((row) => row.name > name)) {
        throw new Error(
          `Migration ${name} is older than an applied migration. Add a later number.`,
        );
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log(
      names.length
        ? 'Migrations are up to date.'
        : 'No domain migrations yet. Confirm the schema first.',
    );
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [184206]);
    } finally {
      client.release();
    }
  }
}

try {
  await migrate();
} catch (error) {
  // PostgreSQL error messages may contain data; only report safe runner errors.
  const message =
    error instanceof Error && !('code' in error) ? error.message : 'Database migration failed.';
  console.error(message);
  process.exitCode = 1;
} finally {
  await closePool();
}
