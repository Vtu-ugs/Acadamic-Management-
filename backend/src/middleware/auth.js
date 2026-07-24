const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const JWT_SECRET = config.JWT_SECRET;

// Single source of truth for which roles may reach each API module.
// The frontend nav/route guard (App.jsx ROLE_ROUTES) mirrors this map.
// `admin` is included in every set, so admin passes all checks.
const MODULE_ROLES = {
  staff:          ['admin', 'staff'],
  coordinators:   ['admin', 'staff'],
  // Diary is shared by staff (author their own), chairpersons (approve), and admins.
  diary:          ['admin', 'staff', 'chairperson'],
  students:       ['admin', 'admission_staff'],
  admissions:     ['admin', 'admission_staff'],
  fees:           ['admin', 'admission_staff'],
  'fee-structures': ['admin', 'admission_staff'],
  certificates:   ['admin', 'admission_staff'],
  // `courses` are shared lookups — any authenticated user may read them.
};

// Verify the Bearer token and attach the decoded payload to req.user.
// Accepts the token from the Authorization header, or a `?token=` query param
// (needed for file downloads/previews opened in an <iframe>/new tab, where the
// browser can't attach the header).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { userId, username, role }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Restrict a route to the given roles (403 otherwise). Assumes requireAuth ran first.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, MODULE_ROLES, JWT_SECRET };
