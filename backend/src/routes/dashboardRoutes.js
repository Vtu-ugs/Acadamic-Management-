const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/dashboardController');

const router = express.Router();

// Year-switchable dashboard: totals + per-branch stats scoped to a batch.
router.get('/stats', h(c.stats));

module.exports = router;
