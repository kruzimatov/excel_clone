import { Pool } from 'pg';

import { env } from '../config/env.js';
import { migrateCellStorageToRowStorage } from './workbookContent.js';
import { ensureDefaultUserFromEnv } from './users.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (error: Error) => {
  console.error('Unexpected PostgreSQL error', error);
});

function parseDatabaseName(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const dbName = url.pathname.replace(/^\//, '');
    return dbName || null;
  } catch {
    return null;
  }
}

function buildAdminConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    url.pathname = '/postgres';
    return url.toString();
  } catch {
    return null;
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists() {
  const dbName = parseDatabaseName(env.DATABASE_URL);
  if (!dbName) {
    return;
  }

  // Keep this conservative to avoid executing unexpected identifiers.
  if (!/^[A-Za-z0-9_-]+$/.test(dbName)) {
    return;
  }

  const adminConnectionString = buildAdminConnectionString(env.DATABASE_URL);
  if (!adminConnectionString) {
    return;
  }

  const adminPool = new Pool({ connectionString: adminConnectionString });
  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount && exists.rowCount > 0) {
      return;
    }

    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
  } finally {
    await adminPool.end().catch(() => undefined);
  }
}

export async function initDatabase() {
  try {
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
  } catch (error) {
    // 3D000 = invalid_catalog_name (database does not exist).
    if (error && typeof error === 'object' && 'code' in error && error.code === '3D000') {
      await ensureDatabaseExists();
      await pool.query('SELECT 1;');
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
    } else {
      throw error;
    }
  }

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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

  await ensureDefaultUserFromEnv(pool);
}
