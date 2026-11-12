import { Router } from 'express';
import { findSharedRoadmapByCode } from '../db/roadmaps.js';

export const shareRouter = Router();

shareRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

shareRouter.get<{ shareCode: string }>('/:shareCode', async (request, response) => {
  const roadmap = await findSharedRoadmapByCode(request.params.shareCode);
  response.json({ data: { roadmap } });
});
