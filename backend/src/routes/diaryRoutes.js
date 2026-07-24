const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/diaryController');

// Mounted behind requireAuth + requireRole('admin','staff','chairperson') in routes/index.js.
// The controller scopes staff to their own entries, and blocks chairpersons from
// authoring/editing/deleting — they only view and run the approval workflow.
const router = express.Router();

router.get('/', h(c.list));
router.post('/', h(c.create));
router.get('/:id', h(c.getOne));
router.put('/:id', h(c.update));
router.patch('/:id/approval', h(c.approve));
router.delete('/:id', h(c.remove));

module.exports = router;
