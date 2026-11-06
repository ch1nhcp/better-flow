import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  url: undefined as string | undefined,
  query: vi.fn(),
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    CLIENT_ORIGIN: 'http://localhost:5173',
    get DATABASE_URL() {
      return database.url;
    },
  },
}));
vi.mock('../src/db/pool.js', () => ({ getPool: () => ({ query: database.query }) }));

import app from '../src/app.js';

beforeEach(() => {
  database.url = undefined;
  database.query.mockReset();
});

describe('API foundation', () => {
  it('exposes liveness without a database', async () => {
    const result = await request(app).get('/api/health').expect(200);
    expect(result.body).toEqual({ data: { status: 'ok', service: 'betterflow-api' } });
    expect(result.headers['x-powered-by']).toBeUndefined();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('reports an unconfigured database separately from liveness', async () => {
    const result = await request(app).get('/api/health/ready').expect(503);
    expect(result.body.error.code).toBe('DATABASE_NOT_CONFIGURED');
  });

  it('checks PostgreSQL 18 readiness', async () => {
    database.url = 'configured';
    database.query.mockResolvedValue({ rows: [{ version: '180001' }] });
    const result = await request(app).get('/api/health/ready').expect(200);
    expect(result.body).toEqual({ data: { status: 'ready' } });
  });

  it('rejects the wrong PostgreSQL major version', async () => {
    database.url = 'configured';
    database.query.mockResolvedValue({ rows: [{ version: '170005' }] });
    const result = await request(app).get('/api/health/ready').expect(503);
    expect(result.body.error.code).toBe('DATABASE_VERSION_MISMATCH');
  });

  it('does not expose database failures or connection strings', async () => {
    database.url = 'configured';
    database.query.mockRejectedValue(new Error('postgresql://secret@host/db'));
    const result = await request(app).get('/api/health/ready').expect(503);
    expect(result.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(result.text).not.toContain('secret');
  });

  it('returns a consistent JSON error for unknown routes', async () => {
    const result = await request(app).get('/api/missing').expect(404);
    expect(result.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
  });

  it('handles malformed JSON before routing', async () => {
    const result = await request(app)
      .post('/api/missing')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(result.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized payloads', async () => {
    const result = await request(app)
      .post('/api/missing')
      .send({ value: 'x'.repeat(1024 * 1024) })
      .expect(413);
    expect(result.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('allows only the configured browser origin', async () => {
    const result = await request(app)
      .get('/api/health')
      .set('Origin', 'https://other.example')
      .expect(200);
    expect(result.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(result.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
