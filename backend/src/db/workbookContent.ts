import { randomUUID } from 'node:crypto';

import type { PoolClient, QueryResultRow } from 'pg';

import type {
  CellRecord,
  WorkbookChunkedSheetPayload,
  WorkbookRecord,
} from '../types/workbook.js';

const ROW_INSERT_CHUNK_SIZE = 500;

interface WorkbookSheetRow extends QueryResultRow {
  id: string;
  sheet_key: string;
  name: string;
  position: number;
  col_widths: Record<string, number> | null;
  row_heights: Record<string, number> | null;
  visible_row_count: number;
  visible_column_count: number;
}

interface WorkbookStoredRow extends QueryResultRow {
  workbook_sheet_id: string;
  row_index: number;
  cells: Record<string, CellRecord> | null;
}

interface WorkbookSheetChunkRow extends QueryResultRow {
  row_index: number;
  cells: Record<string, CellRecord> | null;
}

interface LegacyWorkbookCellRow extends QueryResultRow {
  workbook_sheet_id: string;
  cell_ref: string;
  row_index: number;
  text_value: string | null;
  number_value: number | null;
  formula: string | null;
  display: string | null;
  style: Record<string, unknown> | null;
}

function parseCellReference(cellRef: string) {
  const match = cellRef.match(/^[A-Z]+(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid cell reference "${cellRef}".`);
  }

  return {
    rowIndex: Math.max(0, parseInt(match[1], 10) - 1),
  };
}

function toLegacyCellRecord(row: LegacyWorkbookCellRow): CellRecord {
  return {
    value: row.number_value ?? row.text_value ?? null,
    formula: row.formula ?? undefined,
    display: row.display ?? undefined,
    style: (row.style as CellRecord['style'] | null) ?? {},
  };
}

async function insertRowChunk(
  client: PoolClient,
  rows: Array<{
    id: string;
    workbookSheetId: string;
    sheetKey: string;
    sheetName: string;
    rowIndex: number;
    cells: Record<string, CellRecord>;
  }>,
) {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * 6;
    values.push(
      row.id,
      row.workbookSheetId,
      row.sheetKey,
      row.sheetName,
      row.rowIndex,
      JSON.stringify(row.cells),
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`;
  });

  await client.query(
    `
      INSERT INTO workbook_rows (
        id,
        workbook_sheet_id,
        sheet_key,
        sheet_name,
        row_index,
        cells
      )
      VALUES ${placeholders.join(', ')}
    `,
    values,
  );
}

async function upsertRowChunk(
  client: PoolClient,
  rows: Array<{
    id: string;
    workbookSheetId: string;
    sheetKey: string;
    sheetName: string;
    rowIndex: number;
    cells: Record<string, CellRecord>;
  }>,
) {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * 6;
    values.push(
      row.id,
      row.workbookSheetId,
      row.sheetKey,
      row.sheetName,
      row.rowIndex,
      JSON.stringify(row.cells),
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`;
  });

  await client.query(
    `
      INSERT INTO workbook_rows (
        id,
        workbook_sheet_id,
        sheet_key,
        sheet_name,
        row_index,
        cells
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (workbook_sheet_id, row_index)
      DO UPDATE SET
        sheet_key = EXCLUDED.sheet_key,
        sheet_name = EXCLUDED.sheet_name,
        cells = EXCLUDED.cells
    `,
    values,
  );
}

function mergeRowCells(
  target: Record<string, CellRecord>,
  source: Record<string, CellRecord> | null | undefined,
) {
  if (!source) {
    return target;
  }

  for (const [cellRef, cell] of Object.entries(source)) {
    target[cellRef] = cell;
  }

  return target;
}

export async function replaceWorkbookContent(
  client: PoolClient,
  workbookId: string,
  workbook: WorkbookRecord,
) {
  await client.query('DELETE FROM workbook_sheets WHERE workbook_id = $1', [workbookId]);

  const pendingRows: Array<{
    id: string;
    workbookSheetId: string;
    sheetKey: string;
    sheetName: string;
    rowIndex: number;
    cells: Record<string, CellRecord>;
  }> = [];

  for (const [position, sheet] of workbook.sheets.entries()) {
    const workbookSheetId = randomUUID();

    await client.query(
      `
        INSERT INTO workbook_sheets (
          id,
          workbook_id,
          sheet_key,
          name,
        position,
        col_widths,
        row_heights,
        visible_row_count,
        visible_column_count
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
      `,
      [
        workbookSheetId,
        workbookId,
        sheet.id,
        sheet.name,
        position,
        JSON.stringify(sheet.colWidths ?? {}),
        JSON.stringify(sheet.rowHeights ?? {}),
        sheet.visibleRowCount,
        sheet.visibleColumnCount,
      ],
    );

    const rowsByIndex = new Map<number, Record<string, CellRecord>>();
    for (const [cellRef, cell] of Object.entries(sheet.cells)) {
      const { rowIndex } = parseCellReference(cellRef);
      const rowCells = rowsByIndex.get(rowIndex) ?? {};
      rowCells[cellRef] = cell;
      rowsByIndex.set(rowIndex, rowCells);
    }

    for (const [rowIndex, cells] of Array.from(rowsByIndex.entries()).sort((left, right) => left[0] - right[0])) {
      pendingRows.push({
        id: randomUUID(),
        workbookSheetId,
        sheetKey: sheet.id,
        sheetName: sheet.name,
        rowIndex,
        cells,
      });

      if (pendingRows.length >= ROW_INSERT_CHUNK_SIZE) {
        await insertRowChunk(client, pendingRows.splice(0, pendingRows.length));
      }
    }
  }

  if (pendingRows.length > 0) {
    await insertRowChunk(client, pendingRows);
  }
}

export async function upsertWorkbookSheetChunk(
  client: PoolClient,
  workbookId: string,
  payload: WorkbookChunkedSheetPayload,
) {
  const sheetResult = await client.query<{ id: string }>(
    `
      INSERT INTO workbook_sheets (
        id,
        workbook_id,
        sheet_key,
        name,
        position,
        col_widths,
        row_heights,
        visible_row_count,
        visible_column_count
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
      ON CONFLICT (workbook_id, sheet_key)
      DO UPDATE SET
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        col_widths = EXCLUDED.col_widths,
        row_heights = EXCLUDED.row_heights,
        visible_row_count = EXCLUDED.visible_row_count,
        visible_column_count = EXCLUDED.visible_column_count
      RETURNING id
    `,
    [
      randomUUID(),
      workbookId,
      payload.sheet.id,
      payload.sheet.name,
      payload.position,
      JSON.stringify(payload.sheet.colWidths ?? {}),
      JSON.stringify(payload.sheet.rowHeights ?? {}),
      payload.sheet.visibleRowCount,
      payload.sheet.visibleColumnCount,
    ],
  );

  const workbookSheetId = sheetResult.rows[0]?.id;
  if (!workbookSheetId) {
    throw new Error('Failed to upsert workbook sheet.');
  }

  const rows = payload.rows.map((row) => ({
    id: randomUUID(),
    workbookSheetId,
    sheetKey: payload.sheet.id,
    sheetName: payload.sheet.name,
    rowIndex: row.rowIndex,
    cells: row.cells,
  }));

  await upsertRowChunk(client, rows);
}

export async function loadWorkbookContent(
  client: PoolClient,
  workbookId: string,
  activeSheetId: string | null,
): Promise<WorkbookRecord> {
  const sheetsResult = await client.query<WorkbookSheetRow>(
    `
      SELECT
        id,
        sheet_key,
        name,
        position,
        col_widths,
        row_heights,
        visible_row_count,
        visible_column_count
      FROM workbook_sheets
      WHERE workbook_id = $1
      ORDER BY position ASC
    `,
    [workbookId],
  );

  const rowsResult = await client.query<WorkbookStoredRow>(
    `
      SELECT
        workbook_sheet_id,
        row_index,
        cells
      FROM workbook_rows
      WHERE workbook_sheet_id IN (
        SELECT id
        FROM workbook_sheets
        WHERE workbook_id = $1
      )
      ORDER BY workbook_sheet_id ASC, row_index ASC
    `,
    [workbookId],
  );

  const cellsBySheetId = new Map<string, Record<string, CellRecord>>();
  for (const row of rowsResult.rows) {
    const sheetCells = cellsBySheetId.get(row.workbook_sheet_id) ?? {};
    mergeRowCells(sheetCells, row.cells);
    cellsBySheetId.set(row.workbook_sheet_id, sheetCells);
  }

  const sheets = sheetsResult.rows.map((sheetRow) => ({
    id: sheetRow.sheet_key,
    name: sheetRow.name,
    cells: cellsBySheetId.get(sheetRow.id) ?? {},
    colWidths: sheetRow.col_widths ?? {},
    rowHeights: sheetRow.row_heights ?? {},
    visibleRowCount: sheetRow.visible_row_count,
    visibleColumnCount: sheetRow.visible_column_count,
  }));

  return {
    sheets,
    activeSheetId: activeSheetId && sheets.some((sheet) => sheet.id === activeSheetId)
      ? activeSheetId
      : (sheets[0]?.id ?? ''),
  };
}

export async function loadWorkbookMetadata(
  client: PoolClient,
  workbookId: string,
  activeSheetId: string | null,
) {
  const sheetsResult = await client.query<
    WorkbookSheetRow & { stored_row_count: string | number }
  >(
    `
      SELECT
        ws.id,
        ws.sheet_key,
        ws.name,
        ws.position,
        ws.col_widths,
        ws.row_heights,
        ws.visible_row_count,
        ws.visible_column_count,
        COUNT(wr.id)::int AS stored_row_count
      FROM workbook_sheets ws
      LEFT JOIN workbook_rows wr
        ON wr.workbook_sheet_id = ws.id
      WHERE ws.workbook_id = $1
      GROUP BY
        ws.id,
        ws.sheet_key,
        ws.name,
        ws.position,
        ws.col_widths,
        ws.row_heights,
        ws.visible_row_count,
        ws.visible_column_count
      ORDER BY ws.position ASC
    `,
    [workbookId],
  );

  const sheets = sheetsResult.rows.map((sheetRow) => ({
    id: sheetRow.sheet_key,
    name: sheetRow.name,
    colWidths: sheetRow.col_widths ?? {},
    rowHeights: sheetRow.row_heights ?? {},
    visibleRowCount: sheetRow.visible_row_count,
    visibleColumnCount: sheetRow.visible_column_count,
    storedRowCount: Number(sheetRow.stored_row_count ?? 0),
  }));

  return {
    sheets,
    activeSheetId: activeSheetId && sheets.some((sheet) => sheet.id === activeSheetId)
      ? activeSheetId
      : (sheets[0]?.id ?? ''),
  };
}

export async function loadWorkbookSheetRowsChunk(
  client: PoolClient,
  workbookId: string,
  sheetKey: string,
  cursorRow: number,
  limit: number,
  direction: 'asc' | 'desc' = 'asc',
) {
  const sheetResult = await client.query<{ id: string; name: string }>(
    `
      SELECT id, name
      FROM workbook_sheets
      WHERE workbook_id = $1 AND sheet_key = $2
      LIMIT 1
    `,
    [workbookId, sheetKey],
  );

  if (sheetResult.rowCount === 0) {
    return null;
  }

  const workbookSheetId = sheetResult.rows[0].id;
  const rowsResult = direction === 'desc'
    ? await client.query<WorkbookSheetChunkRow>(
        `
          SELECT row_index, cells
          FROM workbook_rows
          WHERE workbook_sheet_id = $1
            AND row_index < $2
          ORDER BY row_index DESC
          LIMIT $3
        `,
        [workbookSheetId, cursorRow, limit],
      )
    : await client.query<WorkbookSheetChunkRow>(
        `
          SELECT row_index, cells
          FROM workbook_rows
          WHERE workbook_sheet_id = $1
            AND row_index > $2
          ORDER BY row_index ASC
          LIMIT $3
        `,
        [workbookSheetId, cursorRow, limit],
      );

  const orderedRows = direction === 'desc'
    ? [...rowsResult.rows].reverse()
    : rowsResult.rows;

  const rows = orderedRows.map((row) => ({
    rowIndex: row.row_index,
    cells: row.cells ?? {},
  }));

  return {
    sheetId: sheetKey,
    sheetName: sheetResult.rows[0].name,
    rows,
    nextAfterRow: direction === 'asc'
      ? (rows.length > 0 ? rows[rows.length - 1].rowIndex : cursorRow)
      : cursorRow,
    nextBeforeRow: direction === 'desc'
      ? (rows.length > 0 ? rows[0].rowIndex : cursorRow)
      : cursorRow,
    totalStoredRows: 0,
    done: rows.length < limit,
  };
}

export async function migrateCellStorageToRowStorage(client: PoolClient) {
  const tableResult = await client.query<{ exists: string | null }>(`
    SELECT to_regclass('public.workbook_cells') AS exists
  `);

  if (!tableResult.rows[0]?.exists) {
    return;
  }

  const orphanSheets = await client.query<{ id: string; sheet_key: string; name: string }>(
    `
      SELECT ws.id, ws.sheet_key, ws.name
      FROM workbook_sheets ws
      WHERE EXISTS (
        SELECT 1
        FROM workbook_cells wc
        WHERE wc.workbook_sheet_id = ws.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM workbook_rows wr
        WHERE wr.workbook_sheet_id = ws.id
      )
    `,
  );

  for (const sheet of orphanSheets.rows) {
    const legacyRows = await client.query<LegacyWorkbookCellRow>(
      `
        SELECT
          workbook_sheet_id,
          cell_ref,
          row_index,
          text_value,
          number_value,
          formula,
          display,
          style
        FROM workbook_cells
        WHERE workbook_sheet_id = $1
        ORDER BY row_index ASC, cell_ref ASC
      `,
      [sheet.id],
    );

    const grouped = new Map<number, Record<string, CellRecord>>();
    for (const cell of legacyRows.rows) {
      const rowCells = grouped.get(cell.row_index) ?? {};
      rowCells[cell.cell_ref] = toLegacyCellRecord(cell);
      grouped.set(cell.row_index, rowCells);
    }

    const pendingRows: Array<{
      id: string;
      workbookSheetId: string;
      sheetKey: string;
      sheetName: string;
      rowIndex: number;
      cells: Record<string, CellRecord>;
    }> = [];

    for (const [rowIndex, cells] of grouped.entries()) {
      pendingRows.push({
        id: randomUUID(),
        workbookSheetId: sheet.id,
        sheetKey: sheet.sheet_key,
        sheetName: sheet.name,
        rowIndex,
        cells,
      });
    }

    await insertRowChunk(client, pendingRows);
  }
}
