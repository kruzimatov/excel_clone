import { randomUUID } from 'node:crypto';
import type { Pool, QueryResultRow } from 'pg';

import { env } from '../config/env.js';
import { hashPassword } from '../auth/password.js';

export interface UserRow extends QueryResultRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export async function anyUsersExist(db: Pool) {
  const result = await db.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM users) as exists;');
  return Boolean(result.rows[0]?.exists);
}

export async function getUserByUsername(db: Pool, username: string) {
  const result = await db.query<UserRow>(
    'SELECT id, username, password_hash, created_at FROM users WHERE username = $1 LIMIT 1',
    [username],
  );
  return result.rows[0] ?? null;
}

export async function createUser(db: Pool, username: string, password: string) {
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const id = randomUUID();
  await db.query(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)',
    [id, username, passwordHash, now],
  );
  return { id, username, createdAt: now };
}

export async function ensureDefaultUserFromEnv(db: Pool) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return;
  }

  const hasUsers = await anyUsersExist(db);
  if (hasUsers) {
    return;
  }

  await createUser(db, env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  console.log(`Created default admin user: ${env.ADMIN_USERNAME}`);
}
