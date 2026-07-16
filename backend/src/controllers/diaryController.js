const { WeeklyDiary, Staff } = require('../models');
const { logActivity } = require('../utils/activityLog');

const include = [{ model: Staff }];

// Staff users are scoped to their own linked staff record; admins see everything.
const isStaffRole = (req) => req.user.role === 'staff';

// GET /api/diary — admin: all; staff: only their own entries.
async function list(req, res) {
  const where = {};
  if (isStaffRole(req)) {
    if (!req.user.staff_id) return res.json([]); // unlinked staff login → nothing to show
    where.staff_id = req.user.staff_id;
  }
  const rows = await WeeklyDiary.findAll({ where, include });
  res.json(rows);
}

// GET /api/diary/:id — with ownership check for staff.
async function getOne(req, res) {
  const row = await WeeklyDiary.findByPk(req.params.id, { include });
  if (!row) return res.status(404).json({ error: 'weekly_diary not found' });
  if (isStaffRole(req) && row.staff_id !== req.user.staff_id) {
    return res.status(403).json({ error: 'You can only view your own diary' });
  }
  res.json(row);
}

// POST /api/diary — staff can only create for themselves.
async function create(req, res) {
  const body = { ...req.body };
  if (isStaffRole(req)) {
    if (!req.user.staff_id) {
      return res.status(400).json({ error: 'Your login is not linked to a staff record. Ask an admin to link it.' });
    }
    body.staff_id = req.user.staff_id;          // force ownership
    delete body.approval_status;                 // approval is not self-service
    delete body.approval_date;
    delete body.approved_by;
  } else if (!body.staff_id) {
    // Admin must say whose diary this is (staff_id is NOT NULL) — return a clean
    // 400 rather than letting the FK constraint surface as a 500.
    return res.status(400).json({ error: 'staff_id is required' });
  }
  const row = await WeeklyDiary.create(body);
  await logActivity(req.user, 'diary_create', `Diary #${row.diary_id} (week ${row.week_start_date || '?'})`);
  res.status(201).json(row);
}

// PUT /api/diary/:id — staff can only edit their own entries.
async function update(req, res) {
  const row = await WeeklyDiary.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'weekly_diary not found' });

  const body = { ...req.body };
  if (isStaffRole(req)) {
    if (row.staff_id !== req.user.staff_id) {
      return res.status(403).json({ error: 'You can only edit your own diary' });
    }
    body.staff_id = req.user.staff_id;          // can't reassign to someone else
    delete body.approval_status;                 // staff can't approve their own work
    delete body.approval_date;
    delete body.approved_by;
  }
  await row.update(body);
  await logActivity(req.user, 'diary_update', `Diary #${row.diary_id}`);
  res.json(row);
}

// DELETE /api/diary/:id — staff can only delete their own entries.
async function remove(req, res) {
  const row = await WeeklyDiary.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'weekly_diary not found' });
  if (isStaffRole(req) && row.staff_id !== req.user.staff_id) {
    return res.status(403).json({ error: 'You can only delete your own diary' });
  }
  await row.destroy();
  await logActivity(req.user, 'diary_delete', `Diary #${req.params.id}`);
  res.status(204).end();
}

module.exports = { list, getOne, create, update, remove };
