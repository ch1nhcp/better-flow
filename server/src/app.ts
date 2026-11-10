import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
});
app.use(errorHandler);

export default app;
