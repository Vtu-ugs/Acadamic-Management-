const express = require('express');
const h = require('../utils/asyncHandler');
const ctrl = require('../controllers/customFieldController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = requireRole('admin');

// Readable by any signed-in user: the Admissions/Students/Fees forms need the
// definitions to render, and those pages are not admin-only.
router.get('/', h(ctrl.list));

// Defining, editing and retiring fields is the admin's job alone.
router.post('/', adminOnly, h(ctrl.create));
router.put('/:id', adminOnly, h(ctrl.update));
router.get('/:id/usage', adminOnly, h(ctrl.usage));

// Two ways to remove a field, deliberately on different URLs:
//   DELETE /:id            → hide it, keep every stored value (reversible)
//   DELETE /:id/permanent  → drop it and erase its values (irreversible)
router.delete('/:id', adminOnly, h(ctrl.hide));
router.delete('/:id/permanent', adminOnly, h(ctrl.destroy));

module.exports = router;
