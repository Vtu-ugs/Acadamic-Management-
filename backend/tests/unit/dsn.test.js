import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { batchYearFromDsn } = require('../../src/utils/dsn');

describe('batchYearFromDsn', () => {
  it('derives the batch year from a DSN year prefix', () => {
    expect(batchYearFromDsn(20260001)).toBe('2026-27');
    expect(batchYearFromDsn(20270123)).toBe('2027-28');
  });

  it('handles the century rollover in the second half', () => {
    expect(batchYearFromDsn(20990001)).toBe('2099-00');
  });

  it('accepts a numeric string', () => {
    expect(batchYearFromDsn('20260001')).toBe('2026-27');
  });

  it('returns null for out-of-range or nonsense input', () => {
    expect(batchYearFromDsn(123)).toBeNull();       // year 0 → out of range
    expect(batchYearFromDsn('abc')).toBeNull();
    expect(batchYearFromDsn(99990001)).toBeNull();  // year 9999 > 2999
  });
});
