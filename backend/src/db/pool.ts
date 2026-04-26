import { Pool } from 'pg';

import { env } from '../config/env.js';
import { migrateCellStorageToRowStorage } from './workbookContent.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (error: Error) => {
  console.error('Unexpected PostgreSQL error', error);
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_file_name TEXT,
      source TEXT NOT NULL,
      source_name TEXT NOT NULL,
      mime_type TEXT,
      file_handle_id TEXT,
      active_sheet_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE workbooks
    ADD COLUMN IF NOT EXISTS active_sheet_id TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workbook_sheets (
      id TEXT PRIMARY KEY,
      workbook_id TEXT NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
      sheet_key TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      col_widths JSONB NOT NULL DEFAULT '{}'::jsonb,
      row_heights JSONB NOT NULL DEFAULT '{}'::jsonb,
      visible_row_count INTEGER NOT NULL DEFAULT 50,
      visible_column_count INTEGER NOT NULL DEFAULT 23,
      UNIQUE (workbook_id, sheet_key)
    );
  `);

  await pool.query(`
    ALTER TABLE workbook_sheets
    ADD COLUMN IF NOT EXISTS visible_column_count INTEGER NOT NULL DEFAULT 23;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workbook_rows (
      id TEXT PRIMARY KEY,
      workbook_sheet_id TEXT NOT NULL REFERENCES workbook_sheets(id) ON DELETE CASCADE,
      sheet_key TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      cells JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workbook_sheet_id, row_index)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS workbooks_last_opened_idx
      ON workbooks (last_opened_at DESC, updated_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS workbook_sheets_workbook_position_idx
      ON workbook_sheets (workbook_id, position);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS workbook_rows_sheet_row_idx
      ON workbook_rows (workbook_sheet_id, row_index);
  `);

  await pool.query(`
    ALTER TABLE workbooks
    DROP COLUMN IF EXISTS workbook;
  `);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await migrateCellStorageToRowStorage(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
