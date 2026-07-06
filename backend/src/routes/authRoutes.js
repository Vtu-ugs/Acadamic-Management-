const express = require('express');
const h = require('../utils/asyncHandler');
const { login, me, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', h(login));   // public
router.get('/me', requireAuth, h(me));
router.post('/change-password', requireAuth, h(changePassword));

module.exports = router;
