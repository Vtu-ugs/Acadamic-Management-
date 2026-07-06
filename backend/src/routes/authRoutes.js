const express = require('express');
const h = require('../utils/asyncHandler');
const { login, me, logout, changePassword } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/login', h(login));                       // public
router.get('/me', requireAuth, h(me));
router.post('/logout', requireAuth, h(logout));
// Only admin may change a password (admin manages all credentials).
router.post('/change-password', requireAuth, requireRole('admin'), h(changePassword));

module.exports = router;
