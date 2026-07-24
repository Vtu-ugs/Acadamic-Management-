import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validatePassword } = require('../../src/utils/passwordPolicy');

describe('validatePassword', () => {
  it('accepts a password with >=8 chars, a letter and a number', () => {
    expect(validatePassword('abc12345')).toBeNull();
    expect(validatePassword('Password1')).toBeNull();
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(validatePassword('ab12')).toBeTruthy();
    expect(validatePassword('a1b2c3d')).toBeTruthy(); // 7 chars
  });

  it('rejects passwords with no digit', () => {
    expect(validatePassword('abcdefgh')).toBeTruthy();
  });

  it('rejects passwords with no letter', () => {
    expect(validatePassword('12345678')).toBeTruthy();
  });

  it('rejects non-string input', () => {
    expect(validatePassword(undefined)).toBeTruthy();
    expect(validatePassword(null)).toBeTruthy();
    expect(validatePassword(12345678)).toBeTruthy();
  });
});
