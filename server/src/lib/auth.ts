import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function assertAuthConfigured(): string {
  if (!env.JWT_SECRET) throw new Error('Authentication requires JWT_SECRET.');
  return env.JWT_SECRET;
}

export function signToken(userId: number): string {
  return jwt.sign({}, assertAuthConfigured(), {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): number | undefined {
  const secret = assertAuthConfigured();
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !/^[1-9]\d*$/.test(payload.sub) ||
      Number(payload.sub) > 2_147_483_647 ||
      !Number.isSafeInteger(payload.exp) ||
      !Number.isSafeInteger(payload.iat) ||
      Number(payload.exp) <= Number(payload.iat)
    )
      return undefined;
    return Number(payload.sub);
  } catch {
    return undefined;
  }
}
