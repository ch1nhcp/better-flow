import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

describe('environment configuration', () => {
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
