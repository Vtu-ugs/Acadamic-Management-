const express = require('express');
const h = require('../utils/asyncHandler');
const { login, me, logout, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', h(login));                       // public
router.get('/me', requireAuth, h(me));
router.post('/logout', requireAuth, h(logout));
// Any signed-in user may change their OWN password (the controller verifies the
// caller's current password against their own account).
router.post('/change-password', requireAuth, h(changePassword));

module.exports = router;
