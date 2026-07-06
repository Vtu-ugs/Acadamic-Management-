const bcrypt = require('bcryptjs');
const { AppUser } = require('../models');
const { validatePassword } = require('../utils/passwordPolicy');

const ROLES = ['admin', 'admission_staff', 'staff'];

// Shape returned to the client — never expose password_hash.
const safe = (u) => ({
  user_id: u.user_id,
  username: u.username,
  role: u.role,
  full_name: u.full_name,
  is_active: !!u.is_active,
  last_login: u.last_login,
});

// GET /api/users — list all login accounts.
async function list(_req, res) {
  const users = await AppUser.findAll({ order: [['user_id', 'ASC']] });
  res.json(users.map(safe));
}

// POST /api/users — create a login account.
async function create(req, res) {
  const { username, password, role, full_name, is_active } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const weak = validatePassword(password);
  if (weak) return res.status(400).json({ error: weak });

  const user = await AppUser.create({
    username: username.trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
    full_name: full_name || null,
    is_active: is_active === undefined ? true : !!is_active,
  });
  res.status(201).json(safe(user));
}

// PUT /api/users/:id — update role/name/active, and optionally reset the password.
async function update(req, res) {
  const user = await AppUser.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role, full_name, is_active, password } = req.body || {};

  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    // Don't let the last active admin lose admin rights and lock everyone out.
    if (user.role === 'admin' && role !== 'admin' && (await isLastAdmin(user))) {
      return res.status(400).json({ error: 'Cannot change role: this is the last active admin' });
    }
    user.role = role;
  }
  if (full_name !== undefined) user.full_name = full_name || null;
  if (is_active !== undefined) {
    if (!is_active && user.role === 'admin' && (await isLastAdmin(user))) {
      return res.status(400).json({ error: 'Cannot deactivate the last active admin' });
    }
    user.is_active = !!is_active;
  }
  if (password) {
    const weak = validatePassword(password);
    if (weak) return res.status(400).json({ error: weak });
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

module.exports = { list, create, update, remove };
