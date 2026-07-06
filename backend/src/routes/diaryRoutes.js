const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/diaryController');

// Mounted behind requireAuth + requireRole('admin','staff') in routes/index.js.
// The controller further scopes staff users to their own entries.
const router = express.Router();

router.get('/', h(c.list));
router.post('/', h(c.create));
router.get('/:id', h(c.getOne));
router.put('/:id', h(c.update));
router.delete('/:id', h(c.remove));

module.exports = router;
