const express = require('express');
const h = require('../utils/asyncHandler');
const { login, me, logout, changePassword } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');

const router = express.Router();

router.post('/login', loginLimiter, h(login));         // public, brute-force limited
router.get('/me', requireAuth, h(me));
router.post('/logout', requireAuth, h(logout));
// Signed-in users may change their OWN password (the controller verifies the
// caller's current password against their own account). Admission staff are
// excluded — password resets for them go through an admin in User Management.
router.post('/change-password', requireAuth, requireRole('admin', 'staff', 'chairperson'), h(changePassword));

module.exports = router;
