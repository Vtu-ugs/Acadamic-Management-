const bcrypt = require('bcryptjs');
const { Staff, Course, AppUser } = require('../models');
const { UNPAGED_MAX } = require('../utils/paginate');
const { validatePassword } = require('../utils/passwordPolicy');
const { passwordInUse } = require('./userController');

// Staff fields that belong to the staff record itself (not the login).
const STAFF_FIELDS = ['course_id', 'staff_name', 'designation', 'email', 'mobile', 'custom_fields'];
const pickStaff = (body) => {
  const out = {};
  for (const k of STAFF_FIELDS) if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  return out;
};

const include = [{ model: Course }, { model: AppUser }];

// Shape a staff row with its linked login username (no password ever exposed).
const shape = (s) => {
  const j = s.toJSON();
  return { ...j, login_username: j.app_user?.username || null, app_user: undefined };
};

// Validate proposed login credentials without writing anything.
// Returns an error string, or null if the (optional) login is OK to create.
async function validateLogin({ username, password }) {
  if (!username || !password) return null; // login is optional
  const weak = validatePassword(password);
  if (weak) return weak;
  const existing = await AppUser.findOne({ where: { username: username.trim() } });
  if (existing) return 'That login username is already taken';
  if (await passwordInUse(password)) {
    return 'That password is already used by another account. Choose a different one.';
  }
  return null;
}

// Create the staff login (role 'staff'). Assumes validateLogin already passed.
async function createLogin({ username, password, staff_id, full_name }) {
  if (!username || !password) return;
  await AppUser.create({
    username: username.trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role: 'staff',
    full_name: full_name || null,
    is_active: true,
    staff_id,
  });
}

// GET /api/staff — list staff with their linked login username.
async function list(req, res) {
  const where = {};
  for (const key of Object.keys(req.query)) {
    if (Staff.rawAttributes[key]) where[key] = req.query[key];
  }
  const rows = await Staff.findAll({ where, include, limit: UNPAGED_MAX }); // safety cap
  res.json(rows.map(shape));
}

async function getOne(req, res) {
  const row = await Staff.findByPk(req.params.id, { include });
  if (!row) return res.status(404).json({ error: 'staff not found' });
  res.json(shape(row));
}

// POST /api/staff — create the staff record and (optionally) their login.
async function create(req, res) {
  const creds = { username: req.body.login_username, password: req.body.login_password };
  // Validate credentials first so a bad login doesn't leave an orphan staff record.
  const err = await validateLogin(creds);
  if (err) return res.status(409).json({ error: err });

  const staff = await Staff.create(pickStaff(req.body));
  await createLogin({ ...creds, staff_id: staff.staff_id, full_name: staff.staff_name });

  const withLogin = await Staff.findByPk(staff.staff_id, { include });
  res.status(201).json(shape(withLogin));
}

// PUT /api/staff/:id — update staff fields; optionally create/reset the login.
async function update(req, res) {
  const staff = await Staff.findByPk(req.params.id);
  if (!staff) return res.status(404).json({ error: 'staff not found' });
  await staff.update(pickStaff(req.body));

  const { login_username, login_password } = req.body;
  if (login_password || login_username) {
    const login = await AppUser.findOne({ where: { staff_id: staff.staff_id } });
    if (!login) {
      // No login yet → create one (needs both username and password).
      const err = await validateLogin({ username: login_username, password: login_password });
      if (err) return res.status(409).json({ error: err });
      await createLogin({
        username: login_username, password: login_password,
        staff_id: staff.staff_id, full_name: staff.staff_name,
      });
    } else {
      // Existing login → optionally rename and/or reset password.
      if (login_username && login_username.trim() !== login.username) {
        const clash = await AppUser.findOne({ where: { username: login_username.trim() } });
        if (clash) return res.status(409).json({ error: 'That login username is already taken' });
        login.username = login_username.trim();
      }
      if (login_password) {
        const weak = validatePassword(login_password);
        if (weak) return res.status(400).json({ error: weak });
        if (await passwordInUse(login_password, login.user_id)) {
          return res.status(409).json({ error: 'That password is already used by another account. Choose a different one.' });
        }
        login.password_hash = bcrypt.hashSync(login_password, 10);
      }
      await login.save();
    }
  }

  const withLogin = await Staff.findByPk(staff.staff_id, { include });
  res.json(shape(withLogin));
}

// DELETE /api/staff/:id — remove the staff and their linked login together.
async function remove(req, res) {
  const staff = await Staff.findByPk(req.params.id);
  if (!staff) return res.status(404).json({ error: 'staff not found' });
  await AppUser.destroy({ where: { staff_id: staff.staff_id } }); // drop the login first
  await staff.destroy();
  res.status(204).end();
}

module.exports = { list, getOne, create, update, remove };
