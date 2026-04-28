import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  REQUEST_BODY_LIMIT: z.string().default('256mb'),
  AUTH_ENABLED: z.preprocess(
    (value) => value === '1' || value === 'true' || value === true,
    z.boolean(),
  ).default(false),
  ADMIN_USERNAME: z.string().trim().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  APPS_SCRIPT_WEBHOOK_URL: z.string().url().optional(),
  APPS_SCRIPT_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export const env = envSchema.parse({
  PORT: process.env.PORT ?? '4000',
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT ?? '256mb',
  AUTH_ENABLED: process.env.AUTH_ENABLED ?? 'false',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || undefined,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || undefined,
  APPS_SCRIPT_WEBHOOK_URL: process.env.APPS_SCRIPT_WEBHOOK_URL || undefined,
  APPS_SCRIPT_SECRET: process.env.APPS_SCRIPT_SECRET || undefined,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || undefined,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || undefined,
});
