import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z
    .string()
    .default('1d')
    .transform((value, context) => {
      const match = /^([1-9]\d*)(s|m|h|d|w)$/.exec(value);
      const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
      const seconds = match ? Number(match[1]) * (units[match[2] ?? ''] ?? 0) : 0;
      if (!Number.isSafeInteger(seconds) || seconds <= 0) {
        context.addIssue({ code: 'custom', message: 'Use a positive duration such as 1d.' });
        return z.NEVER;
      }
      return seconds;
    }),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  const nonEmpty = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(nonEmpty);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    // Never include raw env values in startup errors.
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  if (
    result.data.NODE_ENV === 'production' &&
    (!result.data.DATABASE_URL || !result.data.JWT_SECRET)
  ) {
    throw new Error('Production requires DATABASE_URL and JWT_SECRET (at least 32 characters).');
  }
  return result.data;
}

export const env = parseEnv(process.env);
