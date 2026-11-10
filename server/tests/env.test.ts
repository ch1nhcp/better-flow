import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

describe('environment configuration', () => {
  it('parses explicit JWT lifetimes and rejects invalid durations', () => {
    expect(parseEnv({}).JWT_EXPIRES_IN).toBe(86400);
    expect(parseEnv({ JWT_EXPIRES_IN: '30m' }).JWT_EXPIRES_IN).toBe(1800);
    for (const value of ['120', '0s', '-1h', 'invalid', '999999999999999999999d']) {
      expect(() => parseEnv({ JWT_EXPIRES_IN: value })).toThrow('JWT_EXPIRES_IN');
    }
  });
  it('starts locally with blank example values and no secrets', () => {
    expect(parseEnv({ PORT: '', DATABASE_URL: '', JWT_SECRET: '' })).toMatchObject({
      PORT: 3001,
      NODE_ENV: 'development',
    });
  });

  it('requires database and signing secret in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow('Production requires');
  });

  it('rejects invalid values without exposing them', () => {
    expect(() => parseEnv({ DATABASE_URL: 'private-invalid-value' })).toThrow(
      'Invalid environment variables: DATABASE_URL',
    );
    expect(() => parseEnv({ PORT: '0' })).toThrow('PORT');
    expect(() => parseEnv({ JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });
});
