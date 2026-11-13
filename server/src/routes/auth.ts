import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { createUser, findUserCredentials } from '../db/users.js';
import { assertAuthConfigured, signToken } from '../lib/auth.js';
import { HttpError } from '../lib/http-error.js';
import type { AuthLocals } from '../middleware/require-auth.js';
import { requireAuth } from '../middleware/require-auth.js';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .refine((value) => [...value].length <= 255);
const passwordSchema = z.string().refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema.refine((value) => [...value].length >= 8),
});
const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema.refine((value) => value.length > 0),
});
// A dummy comparison prevents skipping bcrypt entirely for an unknown email.
const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);

export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

authRouter.post('/register', async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Email hoặc mật khẩu không hợp lệ.');
  assertAuthConfigured();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const user = await createUser(parsed.data.email, passwordHash);
    response.status(201).json({ data: { token: signToken(user.id), user } });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'users_email_key'
    ) {
      throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được đăng ký.');
    }
    throw error;
  }
});

authRouter.post('/login', async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Email hoặc mật khẩu không hợp lệ.');
  assertAuthConfigured();
  const credentials = await findUserCredentials(parsed.data.email);
  const valid = await bcrypt.compare(
    parsed.data.password,
    credentials?.passwordHash ?? (await dummyPasswordHash),
  );
  if (!credentials || !valid)
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
  response.json({ data: { token: signToken(credentials.user.id), user: credentials.user } });
});

authRouter.get<Record<string, string>, unknown, unknown, unknown, AuthLocals>(
  '/me',
  requireAuth,
  (_request, response) => {
    response.json({ data: { user: response.locals.auth.user } });
  },
);
