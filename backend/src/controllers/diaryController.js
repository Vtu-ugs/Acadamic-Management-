const { WeeklyDiary, Staff, Course, AcademicCoordinator } = require('../models');
const { logActivity } = require('../utils/activityLog');
const { UNPAGED_MAX } = require('../utils/paginate');

// Staff record + its course, plus who approved the entry (another staff record).
const include = [
  { model: Staff, include: [{ model: Course }] },
  { model: Staff, as: 'approver' },
];

// Staff users are scoped to their own record; the chairperson and admins see
// every course. The chairperson runs the approval workflow across all courses.
const isStaffRole = (req) => req.user.role === 'staff';
const isChairpersonRole = (req) => req.user.role === 'chairperson';

const ALLOWED_STATUSES = ['Pending', 'Approved', 'Rejected'];

// GET /api/diary — admin/chairperson: all courses; staff: only their own entries.
async function list(req, res) {
  const where = {};
  if (isStaffRole(req)) {
    if (!req.user.staff_id) return res.json([]); // unlinked staff login → nothing to show
    where.staff_id = req.user.staff_id;
  }
  const rows = await WeeklyDiary.findAll({
    where,
    include,
    order: [['week_start_date', 'DESC'], ['diary_id', 'DESC']],
    limit: UNPAGED_MAX, // safety cap
  });

  // Attach the coordinator(s) for each entry's course so a chairperson can see, at a
  // glance, who oversees the staff whose diary they're approving. A course can
  // have several coordinators (one per year), so we collect all of them.
  const coordinators = await AcademicCoordinator.findAll({ include: [{ model: Staff }] });
  const coByCourse = new Map();
  for (const c of coordinators) {
    if (!c.staff?.staff_name) continue;
    const list = coByCourse.get(c.course_id) || new Set();
    list.add(c.staff.staff_name);
    coByCourse.set(c.course_id, list);
  }
  const withCoordinator = rows.map((r) => {
    const names = r.staff ? coByCourse.get(r.staff.course_id) : null;
    return { ...r.toJSON(), coordinator_name: names ? [...names].join(', ') : null };
  });
  res.json(withCoordinator);
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

// POST /api/diary — staff can only create for themselves; chairpersons don't author entries.
async function create(req, res) {
  if (isChairpersonRole(req)) return res.status(403).json({ error: 'Chairpersons approve diaries, they do not create them' });
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

// PUT /api/diary/:id — staff can only edit their own entries; chairpersons don't edit content.
async function update(req, res) {
  if (isChairpersonRole(req)) return res.status(403).json({ error: 'Chairpersons can approve or reject a diary, not edit its content' });
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

// PATCH /api/diary/:id/approval — chairperson (or admin) approves/rejects an entry.
async function approve(req, res) {
  const row = await WeeklyDiary.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'weekly_diary not found' });

  const status = req.body?.approval_status;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `approval_status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  await row.update({
    approval_status: status,
    // Stamp the decision date; clear it if sent back to Pending.
    approval_date: status === 'Pending' ? null : new Date().toISOString().slice(0, 10),
    // The approver is the chairperson/admin's linked staff record, if any.
    approved_by: status === 'Pending' ? null : (req.user.staff_id || null),
  });
  await logActivity(req.user, 'diary_approval', `Diary #${row.diary_id} → ${status}`);
  res.json(row);
}

// DELETE /api/diary/:id — staff can only delete their own entries; chairpersons can't delete.
async function remove(req, res) {
  if (isChairpersonRole(req)) return res.status(403).json({ error: 'Chairpersons cannot delete diary entries' });
  const row = await WeeklyDiary.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'weekly_diary not found' });
  if (isStaffRole(req) && row.staff_id !== req.user.staff_id) {
    return res.status(403).json({ error: 'You can only delete your own diary' });
  }
  await row.destroy();
  await logActivity(req.user, 'diary_delete', `Diary #${req.params.id}`);
  res.status(204).end();
}

module.exports = { list, getOne, create, update, approve, remove };
