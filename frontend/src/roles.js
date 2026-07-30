// Role → route maps, shared by App (which enforces them) and Login (which picks
// a landing page). They live here rather than in App.jsx so Login can import
// them without the two modules importing each other.

// Which routes each role may see. Mirrors backend middleware/auth.js MODULE_ROLES.
// `null` for admin = all routes. Exported so tests can assert privilege scoping.
export const ROLE_ROUTES = {
  admin: null,
  admission_staff: [
    '/', '/students', '/admissions', '/lateral-entry', '/loans', '/fees', '/fee-structure',
    '/fee-reports', '/fee-ledger', '/certificates', '/courses',
    '/usn-pending', '/import-export',
  ],
  // Staff users can only work on their own weekly diary — plus their own password.
  staff: ['/diary', '/change-password'],
  // Chairpersons review and approve staff diaries — plus their own password.
  chairperson: ['/diary-approvals', '/change-password'],
};

// Landing page per role after a successful login. Every key here must be a
// route the role is actually allowed to open per ROLE_ROUTES above.
export const HOME_BY_ROLE = {
  admin: '/',
  admission_staff: '/admissions',
  staff: '/diary',
  chairperson: '/diary-approvals',
};

export const ROLE_LABEL = {
  admin: 'Admin',
  admission_staff: 'Admission Staff',
  staff: 'Staff',
  chairperson: 'Chairperson',
};
