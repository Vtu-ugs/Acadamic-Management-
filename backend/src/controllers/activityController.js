const { ActivityLog } = require('../models');

// GET /api/activity — recent audit entries (admin only). Newest first.
async function list(req, res) {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const where = {};
  if (req.query.action) where.action = req.query.action;
  const rows = await ActivityLog.findAll({ where, order: [['log_id', 'DESC']], limit });
  res.json(rows);
}

module.exports = { list };
