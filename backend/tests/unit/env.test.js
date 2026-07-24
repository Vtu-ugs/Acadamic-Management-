import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { assertProductionSafety, DEV_JWT_SECRET } = require('../../src/config/env');

const base = {
  isProd: true,
  JWT_SECRET: 'a'.repeat(40),
  DB_PASSWORD: 'strongpw',
};

describe('assertProductionSafety', () => {
  it('does nothing outside production', () => {
    expect(() => assertProductionSafety({ isProd: false })).not.toThrow();
  });

  it('passes with a strong secret and a set DB password', () => {
    expect(() => assertProductionSafety({ ...base })).not.toThrow();
  });

  it('throws when JWT_SECRET is the insecure dev default', () => {
    expect(() => assertProductionSafety({ ...base, JWT_SECRET: DEV_JWT_SECRET }))
      .toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => assertProductionSafety({ ...base, JWT_SECRET: 'short' }))
      .toThrow(/32 characters/);
  });

  it('throws when the DB password is empty', () => {
    expect(() => assertProductionSafety({ ...base, DB_PASSWORD: '' }))
      .toThrow(/DB_PASSWORD/);
  });
});
