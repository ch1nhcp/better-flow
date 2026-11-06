import type { QueryResultRow } from 'pg';
import { closePool, getPool } from '../src/db/pool.js';

interface DatabaseInfo extends QueryResultRow {
  version: string;
  database: string;
}

try {
  const { rows } = await getPool().query<DatabaseInfo>(
    "SELECT current_setting('server_version_num') AS version, current_database() AS database",
  );
  const database = rows[0];
  if (!database || Math.floor(Number(database.version) / 10_000) !== 18) {
    throw new Error('PostgreSQL 18 is required.');
  }
  console.log(`Connected to ${database.database} (PostgreSQL 18).`);
} catch {
  console.error(
    'Database check failed. Verify DATABASE_URL, database availability and PostgreSQL 18.',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
