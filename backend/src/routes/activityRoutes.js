const express = require('express');
const h = require('../utils/asyncHandler');
const { list } = require('../controllers/activityController');

// Mounted behind requireAuth + requireRole('admin') in routes/index.js.
const router = express.Router();
router.get('/', h(list));

module.exports = router;
