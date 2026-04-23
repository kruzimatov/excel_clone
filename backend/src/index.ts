import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { initDatabase, pool } from './db/pool.js';
import { workbookRouter } from './routes/workbooks.js';

async function startServer() {
  await initDatabase();

  const app = express();

  app.use(cors({
    origin: env.CORS_ORIGIN,
  }));
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', async (_request: Request, response: Response) => {
    await pool.query('SELECT 1');
    response.json({
      status: 'ok',
      database: 'ok',
      message: 'Express API connected to PostgreSQL.',
    });
  });

  app.use('/api/workbooks', workbookRouter);

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);

    if (error instanceof ZodError) {
      response.status(400).json({
        error: 'Invalid request payload.',
        details: error.flatten(),
      });
      return;
    }

    if (error instanceof Error) {
      response.status(500).json({ error: error.message });
      return;
    }

    response.status(500).json({ error: 'Unknown server error.' });
  });

  app.listen(env.PORT, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
