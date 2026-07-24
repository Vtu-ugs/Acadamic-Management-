import { describe, it, expect } from 'vitest';
import { ROLE_ROUTES } from '../src/App.jsx';

// These guard against accidental privilege creep in the nav/route allow-lists.
// They mirror the backend's middleware/auth.js MODULE_ROLES intent.
describe('ROLE_ROUTES privilege scoping', () => {
  it('gives admin unrestricted access (null = all routes)', () => {
    expect(ROLE_ROUTES.admin).toBeNull();
  });

  it('never exposes admin-only modules to admission_staff', () => {
    const forbidden = ['/users', '/activity', '/custom-fields', '/staff', '/coordinators', '/diary'];
    for (const route of forbidden) {
      expect(ROLE_ROUTES.admission_staff).not.toContain(route);
    }
  });

  it('lets admission_staff reach its core modules', () => {
    for (const route of ['/admissions', '/students', '/fees', '/certificates']) {
      expect(ROLE_ROUTES.admission_staff).toContain(route);
    }
  });

  it('restricts staff to only their diary and their own password', () => {
    expect(ROLE_ROUTES.staff).toEqual(['/diary', '/change-password']);
  });

  it('restricts chairpersons to the diary-approvals workspace and their own password', () => {
    expect(ROLE_ROUTES.chairperson).toEqual(['/diary-approvals', '/change-password']);
  });

  it('never exposes authoring/admin diary routes to chairpersons', () => {
    for (const route of ['/diary', '/users', '/staff', '/students']) {
      expect(ROLE_ROUTES.chairperson).not.toContain(route);
    }
  });
});
