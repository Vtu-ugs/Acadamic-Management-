const bcrypt = require('bcryptjs');
const { AppUser, Staff } = require('../models');
const { validatePassword } = require('../utils/passwordPolicy');

const ROLES = ['admin', 'admission_staff', 'staff', 'chairperson'];

// There is a single chairperson overseeing every course. Returns true if a
// chairperson account (other than excludeUserId) already exists.
async function chairpersonExists(excludeUserId = null) {
  const existing = await AppUser.findOne({ where: { role: 'chairperson' } });
  return !!existing && existing.user_id !== excludeUserId;
}

// Every login must have a unique password. bcrypt salts each hash, so identical
// passwords produce different hashes — we compare the new password against every
// existing account's hash. Small user count, so this is cheap.
async function passwordInUse(plain, excludeUserId = null) {
  const users = await AppUser.findAll({ attributes: ['user_id', 'password_hash'] });
  return users.some((u) => u.user_id !== excludeUserId && bcrypt.compareSync(plain, u.password_hash));
}

// Shape returned to the client — never expose password_hash.
const safe = (u) => ({
  user_id: u.user_id,
  username: u.username,
  role: u.role,
  full_name: u.full_name,
  is_active: !!u.is_active,
  last_login: u.last_login,
  staff_id: u.staff_id,
  staff_name: u.staff?.staff_name || null,
});

// GET /api/users — list all login accounts (with linked staff name).
async function list(_req, res) {
  const users = await AppUser.findAll({ order: [['user_id', 'ASC']], include: [{ model: Staff }] });
  res.json(users.map(safe));
}

// POST /api/users — create a login account.
async function create(req, res) {
  const { username, password, role, full_name, is_active, staff_id } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'chairperson' && await chairpersonExists()) {
    return res.status(409).json({ error: 'A chairperson already exists — there can only be one' });
  }
  const weak = validatePassword(password);
  if (weak) return res.status(400).json({ error: weak });

  // Unique username (clear message rather than a raw DB constraint error).
  const existing = await AppUser.findOne({ where: { username: username.trim() } });
  if (existing) return res.status(409).json({ error: 'That username is already taken' });

  // Unique password across all accounts.
  if (await passwordInUse(password)) {
    return res.status(409).json({ error: 'That password is already used by another account. Choose a different one.' });
  }

  const user = await AppUser.create({
    username: username.trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
    full_name: full_name || null,
    is_active: is_active === undefined ? true : !!is_active,
    // Only staff logins are linked to a staff record.
    staff_id: role === 'staff' && staff_id ? Number(staff_id) : null,
  });
  res.status(201).json(safe(user));
}

// PUT /api/users/:id — update role/name/active, and optionally reset the password.
async function update(req, res) {
  const user = await AppUser.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role, full_name, is_active, password, staff_id } = req.body || {};

  const effectiveRole = role !== undefined ? role : user.role;
  if (effectiveRole === 'chairperson' && await chairpersonExists(user.user_id)) {
    return res.status(409).json({ error: 'A chairperson already exists — there can only be one' });
  }

  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    // Don't let the last active admin lose admin rights and lock everyone out.
    if (user.role === 'admin' && role !== 'admin' && (await isLastAdmin(user))) {
      return res.status(400).json({ error: 'Cannot change role: this is the last active admin' });
    }
    user.role = role;
  }
  if (full_name !== undefined) user.full_name = full_name || null;
  // Keep the staff link only for staff logins; clear it for other roles.
  if (staff_id !== undefined || role !== undefined) {
    user.staff_id = effectiveRole === 'staff' && staff_id ? Number(staff_id) : null;
  }
  if (is_active !== undefined) {
    if (!is_active && user.role === 'admin' && (await isLastAdmin(user))) {
      return res.status(400).json({ error: 'Cannot deactivate the last active admin' });
    }
    user.is_active = !!is_active;
  }
  if (password) {
    const weak = validatePassword(password);
    if (weak) return res.status(400).json({ error: weak });
    if (await passwordInUse(password, user.user_id)) {
      return res.status(409).json({ error: 'That password is already used by another account. Choose a different one.' });
    }
    user.password_hash = bcrypt.hashSync(password, 10);
  }

  await user.save();
  res.json(safe(user));
}

// DELETE /api/users/:id — remove an account.
async function remove(req, res) {
  const user = await AppUser.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.user_id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  if (user.role === 'admin' && (await isLastAdmin(user))) {
    return res.status(400).json({ error: 'Cannot delete the last active admin' });
  }
  await user.destroy();
  res.status(204).end();
}

// True if `user` is the only remaining active admin.
async function isLastAdmin(user) {
  const count = await AppUser.count({ where: { role: 'admin', is_active: true } });
  return user.role === 'admin' && user.is_active && count <= 1;
}

module.exports = { list, create, update, remove, passwordInUse };
