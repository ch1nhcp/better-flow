import type { QueryResultRow } from 'pg';
import { getPool } from './pool.js';

interface UserRow extends QueryResultRow {
  id: number;
  email: string;
  created_at: Date;
}

interface CredentialsRow extends UserRow {
  password_hash: string;
}

export interface AuthUser {
  id: number;
  email: string;
  createdAt: string;
}

function publicUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, createdAt: row.created_at.toISOString() };
}

export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
  const { rows } = await getPool().query<UserRow>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash],
  );
  const row = rows[0];
  if (!row) throw new Error('User creation returned no result.');
  return publicUser(row);
}

export async function findUserById(id: number): Promise<AuthUser | undefined> {
  const { rows } = await getPool().query<UserRow>(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ? publicUser(rows[0]) : undefined;
}

export async function findUserCredentials(email: string) {
  const { rows } = await getPool().query<CredentialsRow>(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
    [email],
  );
  const row = rows[0];
  return row ? { user: publicUser(row), passwordHash: row.password_hash } : undefined;
}
