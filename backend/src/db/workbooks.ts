import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';

import { pool } from './pool.js';
import type { WorkbookRecordInput } from '../types/workbook.js';

interface WorkbookRow extends QueryResultRow {
  id: string;
  title: string;
  current_file_name: string | null;
  source: 'backend' | 'device';
  source_name: string;
  mime_type: string | null;
  file_handle_id: string | null;
  workbook?: WorkbookRecordInput['workbook'];
  created_at: Date | string;
  updated_at: Date | string;
  last_opened_at: Date | string;
}

function mapWorkbookRow(row: WorkbookRow, includeWorkbook: boolean) {
  return {
    id: row.id,
    title: row.title,
    currentFileName: row.current_file_name,
    activeFile: {
      source: row.source,
      name: row.source_name,
      fileHandleId: row.file_handle_id ?? undefined,
      mimeType: row.mime_type ?? undefined,
      modifiedAt: new Date(row.updated_at).toISOString(),
      lastOpenedAt: new Date(row.last_opened_at).toISOString(),
    },
    workbook: includeWorkbook ? row.workbook : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastOpenedAt: new Date(row.last_opened_at).toISOString(),
  };
}

function pickFileMetadata(input: WorkbookRecordInput) {
  return {
    source: input.activeFile?.source ?? 'backend',
    sourceName: input.activeFile?.name ?? input.title,
    mimeType: input.activeFile?.mimeType ?? null,
    fileHandleId: input.activeFile?.fileHandleId ?? null,
  } as const;
}

export async function listWorkbookSummaries(limit: number) {
  const result = await pool.query<WorkbookRow>(
    `
      SELECT
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        created_at,
        updated_at,
        last_opened_at
      FROM workbooks
      ORDER BY last_opened_at DESC, updated_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => mapWorkbookRow(row, false));
}

export async function getWorkbookById(id: string) {
  const result = await pool.query<WorkbookRow>(
    `
      UPDATE workbooks
      SET last_opened_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        workbook,
        created_at,
        updated_at,
        last_opened_at
    `,
    [id],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapWorkbookRow(result.rows[0], true);
}

export async function createWorkbook(input: WorkbookRecordInput) {
  const fileMetadata = pickFileMetadata(input);
  const id = randomUUID();

  const result = await pool.query<WorkbookRow>(
    `
      INSERT INTO workbooks (
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        workbook
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        workbook,
        created_at,
        updated_at,
        last_opened_at
    `,
    [
      id,
      input.title,
      input.currentFileName,
      fileMetadata.source,
      fileMetadata.sourceName,
      fileMetadata.mimeType,
      fileMetadata.fileHandleId,
      JSON.stringify(input.workbook),
    ],
  );

  return mapWorkbookRow(result.rows[0], true);
}

export async function updateWorkbook(id: string, input: WorkbookRecordInput) {
  const fileMetadata = pickFileMetadata(input);
  const result = await pool.query<WorkbookRow>(
    `
      UPDATE workbooks
      SET
        title = $2,
        current_file_name = $3,
        source = $4,
        source_name = $5,
        mime_type = $6,
        file_handle_id = $7,
        workbook = $8::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        workbook,
        created_at,
        updated_at,
        last_opened_at
    `,
    [
      id,
      input.title,
      input.currentFileName,
      fileMetadata.source,
      fileMetadata.sourceName,
      fileMetadata.mimeType,
      fileMetadata.fileHandleId,
      JSON.stringify(input.workbook),
    ],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapWorkbookRow(result.rows[0], true);
}

export async function renameWorkbook(id: string, title: string) {
  const result = await pool.query<WorkbookRow>(
    `
      UPDATE workbooks
      SET
        title = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        title,
        current_file_name,
        source,
        source_name,
        mime_type,
        file_handle_id,
        workbook,
        created_at,
        updated_at,
        last_opened_at
    `,
    [id, title],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapWorkbookRow(result.rows[0], true);
}

export async function deleteWorkbook(id: string) {
  const result = await pool.query<{ id: string }>(
    `
      DELETE FROM workbooks
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rowCount !== 0;
}
