import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import {
  beginChunkedWorkbookSave,
  createWorkbook,
  deleteWorkbook,
  getWorkbookById,
  getWorkbookMetadataById,
  getWorkbookSheetRowsChunkById,
  listWorkbookSummaries,
  renameWorkbook,
  uploadWorkbookSheetChunk,
  updateWorkbook,
} from '../db/workbooks.js';
import { workbookChunkedInitSchema, workbookChunkedSheetPayloadSchema, workbookRecordInputSchema } from '../types/workbook.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const workbookIdSchema = z.object({
  id: z.string().uuid(),
});

const renameWorkbookSchema = z.object({
  title: z.string().trim().min(1).max(255),
});

const sheetRowsQuerySchema = z.object({
  direction: z.enum(['asc', 'desc']).default('asc'),
  afterRow: z.coerce.number().int().min(-1).default(-1),
  beforeRow: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(20000).default(5000),
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

workbookRouter.get('/:id/meta', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const workbook = await getWorkbookMetadataById(id);

  if (!workbook) {
    response.status(404).json({ error: 'Workbook not found.' });
    return;
  }

  response.json({ data: workbook });
});

workbookRouter.get('/:id/sheets/:sheetId/rows', async (request: Request, response: Response) => {
  const { id, sheetId } = z.object({
    id: z.string().uuid(),
    sheetId: z.string().min(1),
  }).parse(request.params);
  const { afterRow, beforeRow, direction, limit } = sheetRowsQuerySchema.parse(request.query);
  const cursorRow = direction === 'desc'
    ? (beforeRow ?? 2147483647)
    : afterRow;
  const chunk = await getWorkbookSheetRowsChunkById(id, sheetId, cursorRow, limit, direction);

  if (!chunk) {
    response.status(404).json({ error: 'Workbook or sheet not found.' });
    return;
  }

  response.json({ data: chunk });
});

workbookRouter.post('/chunked/init', async (request: Request, response: Response) => {
  const payload = workbookChunkedInitSchema.parse(request.body);
  const workbook = await beginChunkedWorkbookSave(payload);
  response.status(payload.id ? 200 : 201).json({ data: workbook });
});

workbookRouter.post('/:id/chunked-sheet', async (request: Request, response: Response) => {
  const { id } = workbookIdSchema.parse(request.params);
  const payload = workbookChunkedSheetPayloadSchema.parse(request.body);
  const workbook = await uploadWorkbookSheetChunk(id, payload);

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
