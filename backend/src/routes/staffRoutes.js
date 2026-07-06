const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/staffController');
const { requireRole } = require('../middleware/auth');

// Mounted behind requireRole('admin','staff'): staff may READ (for lookups),
// but only admin may add/edit/delete staff and issue their logins.
const router = express.Router();
const adminOnly = requireRole('admin');

router.get('/', h(c.list));
router.get('/:id', h(c.getOne));
router.post('/', adminOnly, h(c.create));
router.put('/:id', adminOnly, h(c.update));
router.delete('/:id', adminOnly, h(c.remove));

module.exports = router;
