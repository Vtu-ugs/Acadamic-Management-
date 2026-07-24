const { ActivityLog } = require('../models');

// Record an audit entry. Best-effort: never let logging break the request.
// `who` is req.user (or a user-like object with userId/username/role).
async function logActivity(who, action, detail) {
  try {
    await ActivityLog.create({
      user_id: who?.userId ?? null,
      username: who?.username ?? null,
      role: who?.role ?? null,
      action,
      detail: detail ? String(detail).slice(0, 255) : null,
    });
  } catch (err) {
    console.error('activity log failed:', err.message);
  }
}

module.exports = { logActivity };
