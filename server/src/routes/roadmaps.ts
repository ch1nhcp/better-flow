import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthLocals } from '../middleware/require-auth.js';
import { HttpError } from '../lib/http-error.js';
import { formatRoadmapMarkdown, roadmapExportFilename } from '../lib/roadmap-export.js';
import {
  findRoadmapsByUserId,
  createRoadmap,
  getRoadmapDetail,
  updateRoadmap,
  deleteRoadmap,
} from '../db/roadmaps.js';
import {
  parseRoadmapId,
  validateCreateRoadmapBody,
  validateUpdateRoadmapBody,
} from '../lib/roadmap-validation.js';

export const roadmapsRouter = Router();

roadmapsRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

roadmapsRouter.use(requireAuth);

roadmapsRouter.get<Record<string, string>, unknown, unknown, unknown, AuthLocals>(
  '/',
  async (_request, response) => {
    const roadmaps = await findRoadmapsByUserId(response.locals.auth.userId);
    response.json({ data: { roadmaps } });
  },
);

roadmapsRouter.post<Record<string, string>, unknown, unknown, unknown, AuthLocals>(
  '/',
  async (request, response) => {
    const { title, nodes, edges } = validateCreateRoadmapBody(request.body);
    const roadmap = await createRoadmap(response.locals.auth.userId, title, nodes, edges);
    response.status(201).json({ data: { roadmap } });
  },
);

roadmapsRouter.get<{ id: string }, unknown, unknown, unknown, AuthLocals>(
  '/:id',
  async (request, response) => {
    const id = parseRoadmapId(request.params.id);
    const roadmap = await getRoadmapDetail(id, response.locals.auth.userId);
    response.json({ data: { roadmap } });
  },
);

roadmapsRouter.get<{ id: string }, unknown, unknown, { format?: unknown }, AuthLocals>(
  '/:id/export',
  async (request, response) => {
    const id = parseRoadmapId(request.params.id);
    const { format } = request.query;
    if (format !== 'png' && format !== 'markdown') {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Định dạng tải xuống phải là png hoặc markdown.',
      );
    }

    const roadmap = await getRoadmapDetail(id, response.locals.auth.userId);
    const extension = format === 'png' ? 'png' : 'md';
    const content =
      format === 'png'
        ? await (await import('../lib/roadmap-png.js')).renderRoadmapPng(roadmap)
        : formatRoadmapMarkdown(roadmap);

    response.set('Access-Control-Expose-Headers', 'Content-Disposition');
    response
      .attachment(roadmapExportFilename(roadmap.title, extension))
      .type(format === 'png' ? 'image/png' : 'text/markdown; charset=utf-8')
      .send(content);
  },
);

roadmapsRouter.put<{ id: string }, unknown, unknown, unknown, AuthLocals>(
  '/:id',
  async (request, response) => {
    const id = parseRoadmapId(request.params.id);
    const updates = validateUpdateRoadmapBody(request.body);
    const roadmap = await updateRoadmap(id, response.locals.auth.userId, updates);
    response.json({ data: { roadmap } });
  },
);

roadmapsRouter.delete<{ id: string }, unknown, unknown, unknown, AuthLocals>(
  '/:id',
  async (request, response) => {
    const id = parseRoadmapId(request.params.id);
    await deleteRoadmap(id, response.locals.auth.userId);
    response.json({ data: { message: 'Đã xóa roadmap thành công' } });
  },
);
