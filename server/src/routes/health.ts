import { Router } from 'express';
import type { QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { getPool } from '../db/pool.js';
import { HttpError } from '../lib/http-error.js';

interface DatabaseVersion extends QueryResultRow {
  version: string;
}

export const healthRouter = Router();

// Liveness deliberately does not require a configured database.
healthRouter.get('/health', (_request, response) => {
  response.json({ data: { status: 'ok', service: 'betterflow-api' } });
});

healthRouter.get('/health/ready', async (_request, response) => {
  if (!env.DATABASE_URL)
    throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Database is not configured.');
  try {
    const { rows } = await getPool().query<DatabaseVersion>(
      "SELECT current_setting('server_version_num') AS version",
    );
    if (Math.floor(Number(rows[0]?.version) / 10_000) !== 18) {
      throw new HttpError(503, 'DATABASE_VERSION_MISMATCH', 'PostgreSQL 18 is required.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable.');
  }
  response.json({ data: { status: 'ready' } });
});
