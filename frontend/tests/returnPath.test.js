import { describe, it, expect, beforeEach } from 'vitest';
import { returnPath } from '../src/pages/Login.jsx';
import { RETURN_TO_KEY } from '../src/api.js';

// Where a user lands after signing in. Two bounce paths feed this: router state
// (in-app redirect of an unauthenticated navigation) and sessionStorage (token
// expired mid-session, stashed by api.js before a full page reload).
describe('returnPath', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns null with no bounce recorded, so the caller uses the role home', () => {
    expect(returnPath(undefined)).toBeNull();
  });

  it('restores an in-app redirect from router state, keeping the query and hash', () => {
    const state = { from: { pathname: '/fee-ledger', search: '?dsn=20260001', hash: '#row-3' } };
    expect(returnPath(state)).toBe('/fee-ledger?dsn=20260001#row-3');
  });

  it('restores the path stashed on an expired-token reload', () => {
    sessionStorage.setItem(RETURN_TO_KEY, '/certificates?page=2');
    expect(returnPath(undefined)).toBe('/certificates?page=2');
  });

  it('prefers router state over a stale stashed path', () => {
    sessionStorage.setItem(RETURN_TO_KEY, '/stale');
    expect(returnPath({ from: { pathname: '/diary' } })).toBe('/diary');
  });

  it('consumes the stashed path so a later login does not reuse it', () => {
    sessionStorage.setItem(RETURN_TO_KEY, '/students');
    expect(returnPath(undefined)).toBe('/students');
    expect(returnPath(undefined)).toBeNull();
  });

  it('never bounces back to the login page itself', () => {
    expect(returnPath({ from: { pathname: '/login' } })).toBeNull();
    sessionStorage.setItem(RETURN_TO_KEY, '/login?next=/');
    expect(returnPath(undefined)).toBeNull();
  });
});
