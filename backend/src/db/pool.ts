import { Pool } from 'pg';

import { env } from '../config/env.js';

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
      workbook JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS workbooks_last_opened_idx
      ON workbooks (last_opened_at DESC, updated_at DESC);
  `);
}
