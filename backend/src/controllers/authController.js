const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppUser } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');

const TOKEN_TTL = '8h';

// POST /api/auth/login — verify credentials, return a JWT + safe user info.
async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await AppUser.findOne({ where: { username } });
  // Generic message so we don't reveal whether the username exists.
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Record the successful sign-in time (best-effort; don't block login on it).
  user.last_login = new Date();
  await user.save();

  const token = jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  return res.json({
    token,
    user: { username: user.username, role: user.role, full_name: user.full_name },
  });
}

// GET /api/auth/me — current session's user (req.user set by requireAuth).
async function me(req, res) {
  const user = await AppUser.findByPk(req.user.userId);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Session no longer valid' });
  return res.json({ username: user.username, role: user.role, full_name: user.full_name });
}

// POST /api/auth/change-password — verify current password, then set a new one.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  const weak = validatePassword(newPassword);
  if (weak) return res.status(400).json({ error: weak });

  const user = await AppUser.findByPk(req.user.userId);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Session no longer valid' });
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.password_hash = bcrypt.hashSync(newPassword, 10);
  await user.save();
  return res.json({ message: 'Password changed successfully' });
}

module.exports = { login, me, changePassword };
