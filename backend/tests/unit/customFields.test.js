import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { coerce, asObject, unwrapValue, unwrapLabel } = require('../../src/utils/customFields');

describe('customFields.coerce', () => {
  it('coerces truthy checkbox representations to boolean true', () => {
    for (const v of [true, 1, '1', 'true', 'Yes', 'YES']) {
      expect(coerce(v, 'checkbox')).toBe(true);
    }
  });

  it('coerces everything else for a checkbox to false', () => {
    for (const v of [false, 0, '0', 'no', 'nope']) {
      expect(coerce(v, 'checkbox')).toBe(false);
    }
  });

  it('coerces numbers, rejecting non-numeric to null', () => {
    expect(coerce('42', 'number')).toBe(42);
    expect(coerce('nan', 'number')).toBeNull();
  });

  it('treats empty/undefined as null', () => {
    expect(coerce('', 'text')).toBeNull();
    expect(coerce(undefined, 'text')).toBeNull();
    expect(coerce(null, 'number')).toBeNull();
  });

  it('stringifies plain text values', () => {
    expect(coerce(123, 'text')).toBe('123');
  });
});

describe('customFields.asObject', () => {
  it('parses a JSON string (MariaDB path)', () => {
    expect(asObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('passes through an object (MySQL path)', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 });
  });
  it('returns {} for null or malformed input', () => {
    expect(asObject(null)).toEqual({});
    expect(asObject('not json')).toEqual({});
    expect(asObject('[1,2]')).toEqual({}); // arrays are not valid field maps
  });
});

describe('customFields.unwrap helpers', () => {
  it('unwraps { label, value } and bare values alike', () => {
    expect(unwrapValue({ label: 'Bus', value: 'Route 2' })).toBe('Route 2');
    expect(unwrapValue('Route 2')).toBe('Route 2');
  });
  it('reads a label, falling back when absent', () => {
    expect(unwrapLabel({ label: 'Bus', value: 'x' }, 'fallback')).toBe('Bus');
    expect(unwrapLabel('x', 'fallback')).toBe('fallback');
  });
});
