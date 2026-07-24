const { ActivityLog } = require('../models');
const { logActivity } = require('../utils/activityLog');

// GET /api/activity — recent audit entries (admin only). Newest first.
async function list(req, res) {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const where = {};
  if (req.query.action) where.action = req.query.action;
  const rows = await ActivityLog.findAll({ where, order: [['log_id', 'DESC']], limit });
  res.json(rows);
}

// DELETE /api/activity/:id — remove a single audit entry (admin only).
async function remove(req, res) {
  const row = await ActivityLog.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'activity entry not found' });
  await row.destroy();
  res.status(204).end();
}

// DELETE /api/activity — clear the log (admin only). An optional `?action=`
// clears only that activity type; otherwise the whole log is wiped.
async function clear(req, res) {
  const where = {};
  if (req.query.action) where.action = req.query.action;
  const deleted = await ActivityLog.destroy({ where });
  // Leave a single breadcrumb that the log was cleared, and by whom.
  await logActivity(req.user, 'activity_clear',
    `Cleared ${deleted} ${req.query.action || 'activity'} entr${deleted === 1 ? 'y' : 'ies'}`);
  res.json({ deleted });
}

module.exports = { list, remove, clear };
