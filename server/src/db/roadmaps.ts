import { randomInt } from 'node:crypto';
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

export interface RoadmapPreviewNode {
  id: string;
  label: string;
}

interface RoadmapSummaryRow extends QueryResultRow {
  id: number;
  title: string;
  node_count: number | string;
  preview_nodes: RoadmapPreviewNode[];
  is_public: boolean;
  share_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoadmapSummary {
  id: number;
  title: string;
  nodeCount: number;
  previewNodes: RoadmapPreviewNode[];
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

export interface RoadmapShareStatus {
  id: number;
  isPublic: boolean;
  shareCode: string | null;
}

interface RoadmapShareRow extends QueryResultRow {
  id: number;
  user_id: number;
  is_public: boolean;
  share_code: string | null;
}

interface SharedRoadmapRow extends QueryResultRow {
  title: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  author_email: string;
  updated_at: Date;
}

export interface SharedRoadmapDetail {
  title: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  authorEmail: string;
  updatedAt: string;
}

const SHARE_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHARE_CODE_LENGTH = 6;
const MAX_SHARE_CODE_ATTEMPTS = 5;

function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i += 1) {
    code += SHARE_CODE_ALPHABET[randomInt(SHARE_CODE_ALPHABET.length)];
  }
  return code;
}

function isShareCodeUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== '23505') {
    return false;
  }
  if ('constraint' in error && typeof error.constraint === 'string') {
    return error.constraint === 'roadmaps_share_code_key';
  }
  return true;
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
    previewNodes: Array.isArray(row.preview_nodes) ? row.preview_nodes : [],
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
       CASE WHEN jsonb_typeof(nodes) = 'array' THEN 
           COALESCE(
             (
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', elem->>'id',
                   'label', elem->'data'->>'label'
                 )
               )
               FROM (
                 SELECT elem 
                 FROM jsonb_array_elements(nodes) AS elem 
                 LIMIT 3
               ) sub
             ), 
             '[]'::jsonb
           )
         ELSE '[]'::jsonb 
       END AS preview_nodes,
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

export async function updateRoadmapShare(
  id: number,
  userId: number,
  isPublic: boolean,
): Promise<RoadmapShareStatus> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<RoadmapShareRow>(
      `SELECT id, user_id, is_public, share_code
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
      throw new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền chia sẻ roadmap này.');
    }

    if (isPublic && !existing.share_code) {
      for (let attempt = 0; attempt < MAX_SHARE_CODE_ATTEMPTS; attempt += 1) {
        const candidateCode = generateShareCode();
        await client.query('SAVEPOINT update_share_code');
        try {
          const updateResult = await client.query<RoadmapShareRow>(
            `UPDATE roadmaps
             SET is_public = $1, share_code = $2, updated_at = NOW()
             WHERE id = $3 AND user_id = $4
             RETURNING id, user_id, is_public, share_code`,
            [true, candidateCode, id, userId],
          );
          await client.query('RELEASE SAVEPOINT update_share_code');
          await client.query('COMMIT');
          const updated = updateResult.rows[0];
          if (!updated) throw new Error('Roadmap share update returned no result.');
          return {
            id: updated.id,
            isPublic: updated.is_public,
            shareCode: updated.share_code,
          };
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT update_share_code');
          if (isShareCodeUniqueViolation(error) && attempt < MAX_SHARE_CODE_ATTEMPTS - 1) {
            continue;
          }
          throw error;
        }
      }
      throw new Error('Failed to generate unique share code.');
    }

    const updateResult = await client.query<RoadmapShareRow>(
      `UPDATE roadmaps
       SET is_public = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, is_public, share_code`,
      [isPublic, id, userId],
    );
    await client.query('COMMIT');
    const updated = updateResult.rows[0];
    if (!updated) throw new Error('Roadmap share update returned no result.');
    return {
      id: updated.id,
      isPublic: updated.is_public,
      shareCode: updated.share_code,
    };
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

export async function findSharedRoadmapByCode(shareCode: string): Promise<SharedRoadmapDetail> {
  const { rows } = await getPool().query<SharedRoadmapRow>(
    `SELECT
       r.title,
       r.nodes,
       r.edges,
       u.email AS author_email,
       r.updated_at
     FROM roadmaps r
     INNER JOIN users u ON u.id = r.user_id
     WHERE r.share_code = $1 AND r.is_public = TRUE`,
    [shareCode],
  );
  const row = rows[0];
  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Link chia sẻ không tồn tại hoặc đã bị tắt.');
  }
  return {
    title: row.title,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    edges: Array.isArray(row.edges) ? row.edges : [],
    authorEmail: row.author_email,
    updatedAt: row.updated_at.toISOString(),
  };
}
