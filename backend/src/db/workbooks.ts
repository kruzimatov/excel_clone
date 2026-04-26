import { randomUUID } from 'node:crypto';

import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from './pool.js';
import {
  loadWorkbookContent,
  loadWorkbookMetadata,
  loadWorkbookSheetRowsChunk,
  replaceWorkbookContent,
  upsertWorkbookSheetChunk,
} from './workbookContent.js';
import type { WorkbookChunkedInit, WorkbookChunkedSheetPayload, WorkbookRecordInput } from '../types/workbook.js';

interface WorkbookRow extends QueryResultRow {
  id: string;
  title: string;
  current_file_name: string | null;
  source: 'backend' | 'device';
  source_name: string;
  mime_type: string | null;
  file_handle_id: string | null;
  active_sheet_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_opened_at: Date | string;
}

function mapWorkbookRow(row: WorkbookRow, workbook?: WorkbookRecordInput['workbook']) {
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
    workbook,
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

function pickChunkedFileMetadata(input: WorkbookChunkedInit) {
  return {
    source: input.activeFile?.source ?? 'backend',
    sourceName: input.activeFile?.name ?? input.title,
    mimeType: input.activeFile?.mimeType ?? null,
    fileHandleId: input.activeFile?.fileHandleId ?? null,
  } as const;
}

async function withTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
        active_sheet_id,
        created_at,
        updated_at,
        last_opened_at
      FROM workbooks
      ORDER BY last_opened_at DESC, updated_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => mapWorkbookRow(row));
}

export async function getWorkbookById(id: string) {
  return withTransaction(async (client) => {
    const result = await client.query<WorkbookRow>(
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
          active_sheet_id,
          created_at,
          updated_at,
          last_opened_at
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    const workbook = await loadWorkbookContent(client, row.id, row.active_sheet_id);
    return mapWorkbookRow(row, workbook);
  });
}

export async function getWorkbookMetadataById(id: string) {
  return withTransaction(async (client) => {
    const result = await client.query<WorkbookRow>(
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
          active_sheet_id,
          created_at,
          updated_at,
          last_opened_at
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = await loadWorkbookMetadata(client, row.id, row.active_sheet_id);
    return {
      ...mapWorkbookRow(row),
      workbook: {
        sheets: metadata.sheets.map((sheet) => ({
          id: sheet.id,
          name: sheet.name,
          cells: {},
          colWidths: sheet.colWidths,
          rowHeights: sheet.rowHeights,
          visibleRowCount: sheet.visibleRowCount,
          visibleColumnCount: sheet.visibleColumnCount,
        })),
        activeSheetId: metadata.activeSheetId,
      },
      sheetStats: metadata.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        storedRowCount: sheet.storedRowCount,
      })),
    };
  });
}

export async function getWorkbookSheetRowsChunkById(
  workbookId: string,
  sheetKey: string,
  cursorRow: number,
  limit: number,
  direction: 'asc' | 'desc' = 'asc',
) {
  const client = await pool.connect();
  try {
    return await loadWorkbookSheetRowsChunk(client, workbookId, sheetKey, cursorRow, limit, direction);
  } finally {
    client.release();
  }
}

export async function createWorkbook(input: WorkbookRecordInput) {
  const fileMetadata = pickFileMetadata(input);
  const id = randomUUID();

  return withTransaction(async (client) => {
    const result = await client.query<WorkbookRow>(
      `
        INSERT INTO workbooks (
          id,
          title,
          current_file_name,
          source,
          source_name,
          mime_type,
          file_handle_id,
          active_sheet_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          title,
          current_file_name,
          source,
          source_name,
          mime_type,
          file_handle_id,
          active_sheet_id,
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
        input.workbook.activeSheetId,
      ],
    );

    await replaceWorkbookContent(client, id, input.workbook);
    const row = result.rows[0];
    const workbook = await loadWorkbookContent(client, row.id, row.active_sheet_id);
    return mapWorkbookRow(row, workbook);
  });
}

export async function updateWorkbook(id: string, input: WorkbookRecordInput) {
  const fileMetadata = pickFileMetadata(input);
  return withTransaction(async (client) => {
    const result = await client.query<WorkbookRow>(
      `
        UPDATE workbooks
        SET
          title = $2,
          current_file_name = $3,
          source = $4,
          source_name = $5,
          mime_type = $6,
          file_handle_id = $7,
          active_sheet_id = $8,
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
          active_sheet_id,
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
        input.workbook.activeSheetId,
      ],
    );

    if (result.rowCount === 0) {
      return null;
    }

    await replaceWorkbookContent(client, id, input.workbook);
    const row = result.rows[0];
    const workbook = await loadWorkbookContent(client, row.id, row.active_sheet_id);
    return mapWorkbookRow(row, workbook);
  });
}

export async function beginChunkedWorkbookSave(input: WorkbookChunkedInit) {
  const fileMetadata = pickChunkedFileMetadata(input);
  const id = input.id ?? randomUUID();

  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM workbooks WHERE id = $1',
      [id],
    );

    const result = existing.rowCount === 0
      ? await client.query<WorkbookRow>(
          `
            INSERT INTO workbooks (
              id,
              title,
              current_file_name,
              source,
              source_name,
              mime_type,
              file_handle_id,
              active_sheet_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
              id,
              title,
              current_file_name,
              source,
              source_name,
              mime_type,
              file_handle_id,
              active_sheet_id,
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
            input.activeSheetId,
          ],
        )
      : await client.query<WorkbookRow>(
          `
            UPDATE workbooks
            SET
              title = $2,
              current_file_name = $3,
              source = $4,
              source_name = $5,
              mime_type = $6,
              file_handle_id = $7,
              active_sheet_id = $8,
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
              active_sheet_id,
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
            input.activeSheetId,
          ],
        );

    await client.query('DELETE FROM workbook_sheets WHERE workbook_id = $1', [id]);
    return mapWorkbookRow(result.rows[0]);
  });
}

export async function uploadWorkbookSheetChunk(workbookId: string, payload: WorkbookChunkedSheetPayload) {
  return withTransaction(async (client) => {
    const workbookResult = await client.query<WorkbookRow>(
      `
        UPDATE workbooks
        SET updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          title,
          current_file_name,
          source,
          source_name,
          mime_type,
          file_handle_id,
          active_sheet_id,
          created_at,
          updated_at,
          last_opened_at
      `,
      [workbookId],
    );

    if (workbookResult.rowCount === 0) {
      return null;
    }

    await upsertWorkbookSheetChunk(client, workbookId, payload);
    return mapWorkbookRow(workbookResult.rows[0]);
  });
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
        active_sheet_id,
        created_at,
        updated_at,
        last_opened_at
    `,
    [id, title],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const client = await pool.connect();
  try {
    const workbook = await loadWorkbookContent(client, row.id, row.active_sheet_id);
    return mapWorkbookRow(row, workbook);
  } finally {
    client.release();
  }
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
