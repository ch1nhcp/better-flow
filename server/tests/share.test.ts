import type * as EnvModule from '../src/config/env.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testJwtSecret, database } = vi.hoisted(() => ({
  testJwtSecret: 'share-test-secret-key-32-chars-long!!!!',
  database: {
    query: vi.fn(),
    clientQuery: vi.fn(),
    clientRelease: vi.fn(),
  },
}));

vi.mock('../src/config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvModule>();
  return {
    ...original,
    env: { ...original.env, JWT_SECRET: testJwtSecret, JWT_EXPIRES_IN: 86400 },
  };
});

vi.mock('../src/db/pool.js', () => ({
  getPool: () => ({
    query: database.query,
    connect: async () => ({
      query: database.clientQuery,
      release: database.clientRelease,
    }),
  }),
}));

vi.mock('../src/db/users.js', () => ({
  findUserById: vi.fn(async (id: number) => ({
    id,
    email: `user${id}@example.com`,
    createdAt: '2026-11-04T07:00:00.000Z',
  })),
}));

import app from '../src/app.js';
import { signToken } from '../src/lib/auth.js';

const user1Token = signToken(1);
const user2Token = signToken(2);

beforeEach(() => {
  database.query.mockReset();
  database.clientQuery.mockReset();
  database.clientRelease.mockReset();
});

describe('PATCH /api/roadmaps/:id/share', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .send({ isPublic: true })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each(['0', '-1', 'abc', '1.5', '2147483648'])(
    'rejects invalid roadmap ID param: %s',
    async (invalidId) => {
      const res = await request(app)
        .patch(`/api/roadmaps/${invalidId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ isPublic: true })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it.each([
    {},
    { isPublic: 'true' },
    { isPublic: 1 },
    { isPublic: null },
    { isPublic: true, extra: 'field' },
  ])('rejects invalid payload: %j', async (body) => {
    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when roadmap does not exist', async () => {
    database.clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .patch('/api/roadmaps/999/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ isPublic: true })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(database.clientRelease).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when roadmap belongs to another user', async () => {
    database.clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 10, user_id: 1, is_public: false, share_code: null }],
      }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ isPublic: true })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(database.clientRelease).toHaveBeenCalledTimes(1);
  });

  it('generates a 6-char lowercase alphanumeric shareCode when enabling share for the first time', async () => {
    let generatedCode = '';
    database.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT')) {
        return { rows: [{ id: 10, user_id: 1, is_public: false, share_code: null }] };
      }
      if (sql.startsWith('UPDATE roadmaps')) {
        expect(sql).toContain('updated_at = NOW()');
        generatedCode = String(params?.[1] ?? '');
        expect(generatedCode).toMatch(/^[a-z0-9]{6}$/);
        return {
          rows: [{ id: 10, user_id: 1, is_public: true, share_code: generatedCode }],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ isPublic: true })
      .expect(200);

    expect(res.body).toEqual({
      data: {
        id: 10,
        isPublic: true,
        shareCode: generatedCode,
      },
    });
    expect(database.clientRelease).toHaveBeenCalledTimes(1);
  });

  it('keeps existing shareCode when enabling share again', async () => {
    database.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT')) {
        return { rows: [{ id: 10, user_id: 1, is_public: false, share_code: 'k8f2xq' }] };
      }
      if (sql.startsWith('UPDATE roadmaps')) {
        expect(sql).toContain('updated_at = NOW()');
        expect(params).toEqual([true, 10, 1]);
        return {
          rows: [{ id: 10, user_id: 1, is_public: true, share_code: 'k8f2xq' }],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ isPublic: true })
      .expect(200);

    expect(res.body).toEqual({
      data: {
        id: 10,
        isPublic: true,
        shareCode: 'k8f2xq',
      },
    });
  });

  it('retries shareCode generation on unique constraint collision', async () => {
    let updateCalls = 0;
    let finalCode = '';
    database.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT')) {
        return { rows: [{ id: 10, user_id: 1, is_public: false, share_code: null }] };
      }
      if (sql.startsWith('UPDATE roadmaps')) {
        updateCalls += 1;
        if (updateCalls === 1) {
          throw Object.assign(new Error('duplicate key'), {
            code: '23505',
            constraint: 'roadmaps_share_code_key',
          });
        }
        finalCode = String(params?.[1] ?? '');
        return {
          rows: [{ id: 10, user_id: 1, is_public: true, share_code: finalCode }],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ isPublic: true })
      .expect(200);

    expect(updateCalls).toBe(2);
    expect(res.body).toEqual({
      data: {
        id: 10,
        isPublic: true,
        shareCode: finalCode,
      },
    });
  });

  it('disables sharing while preserving shareCode and updating updated_at', async () => {
    database.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT')) {
        return { rows: [{ id: 10, user_id: 1, is_public: true, share_code: 'k8f2xq' }] };
      }
      if (sql.startsWith('UPDATE roadmaps')) {
        expect(sql).toContain('updated_at = NOW()');
        expect(params).toEqual([false, 10, 1]);
        return {
          rows: [{ id: 10, user_id: 1, is_public: false, share_code: 'k8f2xq' }],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .patch('/api/roadmaps/10/share')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ isPublic: false })
      .expect(200);

    expect(res.body).toEqual({
      data: {
        id: 10,
        isPublic: false,
        shareCode: 'k8f2xq',
      },
    });
  });
});

describe('GET /api/share/:shareCode', () => {
  it('returns public roadmap without requiring authentication', async () => {
    const updatedAt = new Date('2026-11-04T08:30:00.000Z');
    const nodes = [
      {
        id: 'node-1',
        type: 'default',
        position: { x: 100, y: 50 },
        data: { label: 'Web basics' },
      },
    ];
    database.query.mockResolvedValueOnce({
      rows: [
        {
          title: 'Lộ trình học Frontend React',
          nodes,
          edges: [],
          author_email: 'quang@cmc.com.vn',
          updated_at: updatedAt,
        },
      ],
    });

    const res = await request(app).get('/api/share/k8f2xq').expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.share_code = $1 AND r.is_public = TRUE'),
      ['k8f2xq'],
    );
    expect(res.body).toEqual({
      data: {
        roadmap: {
          title: 'Lộ trình học Frontend React',
          nodes,
          edges: [],
          authorEmail: 'quang@cmc.com.vn',
          updatedAt: '2026-11-04T08:30:00.000Z',
        },
      },
    });
  });

  it('returns 404 when shareCode does not exist or sharing is disabled', async () => {
    database.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/share/missing1').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
