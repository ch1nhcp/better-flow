import type { RequestHandler } from 'express';
import type { AuthUser } from '../db/users.js';
import { findUserById } from '../db/users.js';
import { verifyToken } from '../lib/auth.js';
import { HttpError } from '../lib/http-error.js';

export interface AuthLocals {
  auth: { userId: number; user: AuthUser };
}

export const requireAuth: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  unknown,
  AuthLocals
> = async (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  const match = /^Bearer ([^\s]+)$/i.exec(request.get('Authorization') ?? '');
  const userId = match?.[1] ? verifyToken(match[1]) : undefined;
  if (!userId)
    throw new HttpError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  const user = await findUserById(userId);
  if (!user)
    throw new HttpError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  response.locals.auth = { userId, user };
  next();
};
