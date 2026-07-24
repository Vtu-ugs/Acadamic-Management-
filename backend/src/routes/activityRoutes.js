const express = require('express');
const h = require('../utils/asyncHandler');
const { list, remove, clear } = require('../controllers/activityController');

// Mounted behind requireAuth + requireRole('admin') in routes/index.js.
const router = express.Router();
router.get('/', h(list));
router.delete('/', h(clear));      // clear all (or all of one action type)
router.delete('/:id', h(remove));  // delete a single entry

module.exports = router;
