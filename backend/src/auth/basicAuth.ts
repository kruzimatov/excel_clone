import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { anyUsersExist, getUserByUsername } from '../db/users.js';
import { verifyPassword } from './password.js';

function parseBasicAuth(headerValue: string | undefined) {
  if (!headerValue) return null;
  const match = headerValue.match(/^Basic\s+(.+)$/i);
  if (!match) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return null;

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function basicAuthMiddleware() {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!env.AUTH_ENABLED) {
      next();
      return;
    }

    const hasUsers = await anyUsersExist(pool);
    if (!hasUsers) {
      next();
      return;
    }

    const credentials = parseBasicAuth(request.header('authorization'));
    if (!credentials?.username) {
      response.setHeader('WWW-Authenticate', 'Basic realm="excel-clone"');
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const user = await getUserByUsername(pool, credentials.username);
    if (!user || !verifyPassword(credentials.password, user.password_hash)) {
      response.setHeader('WWW-Authenticate', 'Basic realm="excel-clone"');
      response.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    next();
  };
}
