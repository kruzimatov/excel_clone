import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import {
  createWorkbook,
  deleteWorkbook,
  getWorkbookById,
  listWorkbookSummaries,
  renameWorkbook,
  updateWorkbook,
} from '../db/workbooks.js';
import { workbookRecordInputSchema } from '../types/workbook.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const workbookIdSchema = z.object({
  id: z.string().uuid(),
});

const renameWorkbookSchema = z.object({
  title: z.string().trim().min(1).max(255),
});

export const workbookRouter = Router();

workbookRouter.get('/', async (request: Request, response: Response) => {
  const { limit } = listQuerySchema.parse(request.query);
  const workbooks = await listWorkbookSummaries(limit);
  response.json({ data: workbooks });
});

workbookRouter.get('/:id', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const workbook = await getWorkbookById(id);

  if (!workbook) {
    response.status(404).json({ error: 'Workbook not found.' });
    return;
  }

  response.json({ data: workbook });
});

workbookRouter.post('/', async (request: Request, response: Response) => {
  const payload = workbookRecordInputSchema.parse(request.body);
  const workbook = await createWorkbook(payload);
  response.status(201).json({ data: workbook });
});

workbookRouter.put('/:id', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const payload = workbookRecordInputSchema.parse(request.body);
  const workbook = await updateWorkbook(id, payload);

  if (!workbook) {
    response.status(404).json({ error: 'Workbook not found.' });
    return;
  }

  response.json({ data: workbook });
});

workbookRouter.patch('/:id/title', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const { title } = renameWorkbookSchema.parse(request.body);
  const workbook = await renameWorkbook(id, title);

  if (!workbook) {
    response.status(404).json({ error: 'Workbook not found.' });
    return;
  }

  response.json({ data: workbook });
});

workbookRouter.delete('/:id', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const deleted = await deleteWorkbook(id);

  if (!deleted) {
    response.status(404).json({ error: 'Workbook not found.' });
    return;
  }

  response.status(204).send();
});
