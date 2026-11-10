import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthLocals } from '../middleware/require-auth.js';
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
