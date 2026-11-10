import type { QueryResultRow } from 'pg';
import { getPool } from './pool.js';
import { HttpError } from '../lib/http-error.js';
import type { RoadmapEdge, RoadmapNode, UpdateRoadmapInput } from '../lib/roadmap-validation.js';
import { validateAndNormalizeGraph } from '../lib/roadmap-validation.js';

interface RoadmapRow extends QueryResultRow {
  id: number;
  user_id: number;
  title: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  is_public: boolean;
  share_code: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RoadmapSummaryRow extends QueryResultRow {
  id: number;
  title: string;
  node_count: number | string;
  is_public: boolean;
  share_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoadmapSummary {
  id: number;
  title: string;
  nodeCount: number;
  isPublic: boolean;
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapDetail {
  id: number;
  userId: number;
  title: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  isPublic: boolean;
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatRoadmapDetail(row: RoadmapRow): RoadmapDetail {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    edges: Array.isArray(row.edges) ? row.edges : [],
    isPublic: row.is_public,
    shareCode: row.share_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function formatRoadmapSummary(row: RoadmapSummaryRow): RoadmapSummary {
  return {
    id: row.id,
    title: row.title,
    nodeCount: Number(row.node_count) || 0,
    isPublic: row.is_public,
    shareCode: row.share_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findRoadmapsByUserId(userId: number): Promise<RoadmapSummary[]> {
  const { rows } = await getPool().query<RoadmapSummaryRow>(
    `SELECT
       id,
       title,
       CASE WHEN jsonb_typeof(nodes) = 'array' THEN jsonb_array_length(nodes) ELSE 0 END AS node_count,
       is_public,
       share_code,
       created_at,
       updated_at
     FROM roadmaps
     WHERE user_id = $1
     ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return rows.map(formatRoadmapSummary);
}

export async function findRoadmapByIdAndUserId(
  id: number,
  userId: number,
): Promise<RoadmapDetail | undefined> {
  const { rows } = await getPool().query<RoadmapRow>(
    `SELECT id, user_id, title, nodes, edges, is_public, share_code, created_at, updated_at
     FROM roadmaps
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rows[0] ? formatRoadmapDetail(rows[0]) : undefined;
}

export async function checkRoadmapExists(id: number): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM roadmaps WHERE id = $1) AS exists',
    [id],
  );
  return Boolean(rows[0]?.exists);
}

export async function getRoadmapDetail(id: number, userId: number): Promise<RoadmapDetail> {
  const roadmap = await findRoadmapByIdAndUserId(id, userId);
  if (!roadmap) {
    const exists = await checkRoadmapExists(id);
    if (exists) {
      throw new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập roadmap này.');
    }
    throw new HttpError(404, 'NOT_FOUND', 'Roadmap không tồn tại.');
  }
  return roadmap;
}

export async function createRoadmap(
  userId: number,
  title: string,
  nodes: RoadmapNode[],
  edges: RoadmapEdge[],
): Promise<RoadmapDetail> {
  const { rows } = await getPool().query<RoadmapRow>(
    `INSERT INTO roadmaps (user_id, title, nodes, edges)
     VALUES ($1, $2, $3::jsonb, $4::jsonb)
     RETURNING id, user_id, title, nodes, edges, is_public, share_code, created_at, updated_at`,
    [userId, title, JSON.stringify(nodes), JSON.stringify(edges)],
  );
  const row = rows[0];
  if (!row) throw new Error('Roadmap creation returned no result.');
  return formatRoadmapDetail(row);
}

export async function updateRoadmap(
  id: number,
  userId: number,
  updates: UpdateRoadmapInput,
): Promise<RoadmapDetail> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<RoadmapRow>(
      `SELECT id, user_id, title, nodes, edges, is_public, share_code, created_at, updated_at
       FROM roadmaps
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    const existing = rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      throw new HttpError(404, 'NOT_FOUND', 'Roadmap không tồn tại.');
    }
    if (existing.user_id !== userId) {
      await client.query('ROLLBACK');
      throw new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền cập nhật roadmap này.');
    }

    const nextTitle = updates.title !== undefined ? updates.title : existing.title;
    const rawNodes = updates.nodes !== undefined ? updates.nodes : existing.nodes;
    const rawEdges = updates.edges !== undefined ? updates.edges : existing.edges;

    const { nodes: nextNodes, edges: nextEdges } = validateAndNormalizeGraph(rawNodes, rawEdges);

    const updateResult = await client.query<RoadmapRow>(
      `UPDATE roadmaps
       SET title = $1, nodes = $2::jsonb, edges = $3::jsonb, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, title, nodes, edges, is_public, share_code, created_at, updated_at`,
      [nextTitle, JSON.stringify(nextNodes), JSON.stringify(nextEdges), id, userId],
    );

    await client.query('COMMIT');
    const updated = updateResult.rows[0];
    if (!updated) throw new Error('Roadmap update returned no result.');
    return formatRoadmapDetail(updated);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors if connection was broken
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRoadmap(id: number, userId: number): Promise<void> {
  const { rowCount } = await getPool().query(
    'DELETE FROM roadmaps WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  if (rowCount === 0) {
    const exists = await checkRoadmapExists(id);
    if (exists) {
      throw new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền xóa roadmap này.');
    }
    throw new HttpError(404, 'NOT_FOUND', 'Roadmap không tồn tại.');
  }
}
