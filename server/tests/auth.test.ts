import { randomUUID } from 'node:crypto';
import type * as EnvModule from '../src/config/env.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvModule>();
  const { randomBytes } = await import('node:crypto');
  return {
    ...original,
    env: {
      ...original.env,
      DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL,
      JWT_SECRET: randomBytes(48).toString('hex'),
      JWT_EXPIRES_IN: 86400,
    },
  };
});

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { closePool, getPool } from '../src/db/pool.js';

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('_test')) {
  throw new Error('AUTH_TEST_DATABASE_URL must use a dedicated database ending in _test.');
}
const prefix = `auth-test-${randomUUID()}`;
const password = 'test-password-2026';

describe('auth input and token validation without a database', () => {
  it.each([
    { email: 'invalid', password },
    { email: 'valid@example.test', password: 'short' },
    { email: 'valid@example.test', password: '🔑'.repeat(19) },
    { email: 'valid@example.test', password, userId: 1 },
    { email: 'valid@example.test', password: 12345678 },
  ])('rejects invalid registration data', async (body) => {
    const response = await request(app).post('/api/auth/register').send(body).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid login data', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'valid@example.test', password: '' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing, forged, expired and incomplete tokens', async () => {
    const secret = env.JWT_SECRET!;
    const tokens = [
      '',
      'broken.token.value',
      jwt.sign({}, randomUUID(), { subject: '1', expiresIn: '1d' }),
      jwt.sign({}, secret, { subject: '1', expiresIn: -1 }),
      jwt.sign({}, secret, { subject: '1' }),
      jwt.sign({}, secret, { subject: '1', expiresIn: '1d', noTimestamp: true }),
      jwt.sign({}, secret, { subject: '1', expiresIn: '1d', algorithm: 'HS384' }),
      jwt.sign({}, secret, { subject: 'invalid-id', expiresIn: '1d' }),
    ];
    for (const token of tokens) {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
    await request(app).get('/api/auth/me').expect(401);
  });
});

describe.skipIf(!databaseUrl)('auth with real PostgreSQL', () => {
  afterAll(async () => {
    try {
      await getPool().query('DELETE FROM users WHERE email LIKE $1', [`${prefix}%@example.test`]);
    } finally {
      await closePool();
    }
  });

  it('registers a normalized email and restores the user with its token', async () => {
    const email = `${prefix}-register@example.test`;
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: ` ${email.toUpperCase()} `, password })
      .expect(201);
    expect(response.body.data.user).toMatchObject({ email });
    expect(Object.keys(response.body.data.user).sort()).toEqual(['createdAt', 'email', 'id']);
    const restored = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.data.token}`)
      .expect(200);
    expect(restored.body.data.user).toEqual(response.body.data.user);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('logs in and returns the same error for an unknown email and a wrong password', async () => {
    const email = `${prefix}-login@example.test`;
    await request(app).post('/api/auth/register').send({ email, password }).expect(201);
    const loggedIn = await request(app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    expect(loggedIn.body.data.user.email).toBe(email);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const absent = await request(app)
      .post('/api/auth/login')
      .send({ email: `${prefix}-absent@example.test`, password: 'wrong-password' })
      .expect(401);
    expect(wrong.body).toEqual(absent.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows only one concurrent registration per normalized email', async () => {
    const email = `${prefix}-duplicate@example.test`;
    const responses = await Promise.all([
      request(app).post('/api/auth/register').send({ email, password }),
      request(app)
        .post('/api/auth/register')
        .send({ email: ` ${email.toUpperCase()} `, password }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );
  });

  it('preserves password whitespace and accepts exactly 72 UTF-8 bytes', async () => {
    const email = `${prefix}-bytes@example.test`;
    const value = ` ${'🔑'.repeat(17)}ab `;
    await request(app).post('/api/auth/register').send({ email, password: value }).expect(201);
    await request(app).post('/api/auth/login').send({ email, password: value }).expect(200);
    await request(app).post('/api/auth/login').send({ email, password: value.trim() }).expect(401);
  });

  it('rejects a valid token when its user no longer exists', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: `${prefix}-removed@example.test`, password })
      .expect(201);
    await getPool().query('DELETE FROM users WHERE id = $1', [response.body.data.user.id]);
    const result = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.data.token}`)
      .expect(401);
    expect(result.body.error.code).toBe('UNAUTHORIZED');
  });
});
