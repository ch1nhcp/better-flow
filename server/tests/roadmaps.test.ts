import type * as EnvModule from '../src/config/env.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testJwtSecret, database } = vi.hoisted(() => ({
  testJwtSecret: 'roadmaps-test-secret-key-32-chars-long!!',
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
const sampleNode = {
  id: 'node-1',
  type: 'default' as const,
  position: { x: 100, y: 50 },
  data: { label: 'Web basics' },
};
const sampleRow = {
  id: 10,
  user_id: 1,
  title: 'Frontend React',
  nodes: [sampleNode],
  edges: [],
  is_public: false,
  share_code: null,
  created_at: new Date('2026-11-04T07:10:00.000Z'),
  updated_at: new Date('2026-11-04T07:10:00.000Z'),
};

beforeEach(() => {
  database.query.mockReset();
  database.clientQuery.mockReset();
  database.clientRelease.mockReset();
});

describe('Roadmap API Authentication', () => {
  it.each([
    { method: 'get' as const, url: '/api/roadmaps' },
    { method: 'post' as const, url: '/api/roadmaps' },
    { method: 'get' as const, url: '/api/roadmaps/1' },
    { method: 'put' as const, url: '/api/roadmaps/1' },
    { method: 'delete' as const, url: '/api/roadmaps/1' },
  ])('rejects unauthenticated requests to $method $url', async ({ method, url }) => {
    const res = await request(app)[method](url).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('Roadmap API Validation', () => {
  it.each(['0', '-1', 'abc', '1.5', '2147483648'])(
    'rejects invalid roadmap ID param: %s',
    async (invalidId) => {
      const res = await request(app)
        .get(`/api/roadmaps/${invalidId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it.each([
    {},
    { title: '   ' },
    { title: 'Line 1\nLine 2' },
    { title: 'a'.repeat(256) },
    { title: 'Valid', extraField: 1 },
    { title: 'Valid', nodes: null },
    { title: 'Valid', edges: null },
    {
      title: 'Valid',
      nodes: [{ id: 'bad id', type: 'default', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    },
    {
      title: 'Valid',
      nodes: [sampleNode, sampleNode],
    },
    {
      title: 'Valid',
      nodes: [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    },
    {
      title: 'Valid',
      nodes: [{ id: 'n1', type: 'default', position: { x: 1000001, y: 0 }, data: { label: 'A' } }],
    },
    {
      title: 'Valid',
      nodes: [sampleNode],
      edges: [{ id: 'e1', source: 'node-1', target: 'missing-node' }],
    },
    {
      title: 'Valid',
      nodes: [sampleNode],
      edges: [{ id: 'e1', source: 'node-1', target: 'node-1' }],
    },
    {
      title: 'Valid',
      nodes: [sampleNode, { ...sampleNode, id: 'node-2' }],
      edges: [
        { id: 'e1', source: 'node-1', target: 'node-2' },
        { id: 'e2', source: 'node-1', target: 'node-2' },
      ],
    },
  ])('rejects invalid POST /api/roadmaps payload: %j', async (body) => {
    const res = await request(app)
      .post('/api/roadmaps')
      .set('Authorization', `Bearer ${user1Token}`)
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    {},
    { title: 'Valid', extraField: 1 },
    { title: null },
    { nodes: null },
    { edges: null },
    {
      nodes: [sampleNode],
      edges: [{ id: 'e1', source: 'node-1', target: '999' }],
    },
  ])('rejects invalid PUT /api/roadmaps/:id payload: %j', async (body) => {
    const res = await request(app)
      .put('/api/roadmaps/1')
      .set('Authorization', `Bearer ${user1Token}`)
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Roadmap API Business Logic & Authorization', () => {
  it('GET /api/roadmaps lists summaries for the authenticated user', async () => {
    const previewNodes = [{ id: 'node-1', label: 'Web basics' }];
    database.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          title: 'My Frontend Path',
          node_count: 5,
          preview_nodes: previewNodes,
          is_public: true,
          share_code: 'k8f2xq',
          created_at: new Date('2026-11-04T07:10:00.000Z'),
          updated_at: new Date('2026-11-04T08:30:00.000Z'),
        },
      ],
    });

    const res = await request(app)
      .get('/api/roadmaps')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    expect(res.body.data.roadmaps).toEqual([
      {
        id: 10,
        title: 'My Frontend Path',
        nodeCount: 5,
        previewNodes,
        isPublic: true,
        shareCode: 'k8f2xq',
        createdAt: '2026-11-04T07:10:00.000Z',
        updatedAt: '2026-11-04T08:30:00.000Z',
      },
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [1]);
  });

  it('POST /api/roadmaps creates a roadmap and returns 201', async () => {
    database.query.mockResolvedValueOnce({ rows: [sampleRow] });

    const res = await request(app)
      .post('/api/roadmaps')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Frontend React', nodes: [sampleNode] })
      .expect(201);

    expect(res.body.data.roadmap).toEqual({
      id: 10,
      userId: 1,
      title: 'Frontend React',
      nodes: [sampleNode],
      edges: [],
      isPublic: false,
      shareCode: null,
      createdAt: '2026-11-04T07:10:00.000Z',
      updatedAt: '2026-11-04T07:10:00.000Z',
    });
  });

  it('GET /api/roadmaps/:id distinguishes 200, 403, and 404', async () => {
    database.query.mockResolvedValueOnce({ rows: [sampleRow] });
    const okRes = await request(app)
      .get('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);
    expect(okRes.body.data.roadmap.id).toBe(10);

    database.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] });
    const forbiddenRes = await request(app)
      .get('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    database.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] });
    const notFoundRes = await request(app)
      .get('/api/roadmaps/99')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(404);
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
  });

  it('PUT /api/roadmaps/:id handles 403, partial update, and full empty-array update', async () => {
    database.clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ ...sampleRow, user_id: 2 }] })
      .mockResolvedValueOnce({});
    const forbidden = await request(app)
      .put('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'New Title' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    database.clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [sampleRow] })
      .mockResolvedValueOnce({ rows: [{ ...sampleRow, title: 'New Title' }] })
      .mockResolvedValueOnce({});
    const partial = await request(app)
      .put('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'New Title' })
      .expect(200);
    expect(partial.body.data.roadmap.title).toBe('New Title');
    expect(partial.body.data.roadmap.nodes).toEqual([sampleNode]);

    database.clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [sampleRow] })
      .mockResolvedValueOnce({
        rows: [{ ...sampleRow, title: 'Cleared', nodes: [], edges: [] }],
      })
      .mockResolvedValueOnce({});
    const fullClear = await request(app)
      .put('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Cleared', nodes: [], edges: [] })
      .expect(200);
    expect(fullClear.body.data.roadmap).toMatchObject({
      title: 'Cleared',
      nodes: [],
      edges: [],
    });
    expect(database.clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE roadmaps'), [
      'Cleared',
      '[]',
      '[]',
      10,
      1,
    ]);
  });

  it('DELETE /api/roadmaps/:id handles 200, 403, and 404', async () => {
    database.query.mockResolvedValueOnce({ rowCount: 1 });
    const okRes = await request(app)
      .delete('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);
    expect(okRes.body).toEqual({ data: { message: 'Đã xóa roadmap thành công' } });

    database.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ exists: true }] });
    const forbidden = await request(app)
      .delete('/api/roadmaps/10')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    database.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ exists: false }] });
    const notFound = await request(app)
      .delete('/api/roadmaps/99')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(404);
    expect(notFound.body.error.code).toBe('NOT_FOUND');
  });
});
