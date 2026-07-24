const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/dashboardController');

const router = express.Router();

// Year-switchable dashboard: totals + per-branch stats scoped to a batch.
router.get('/stats', h(c.stats));

// The student roster (name / DSN / USN) for one branch card, loaded on demand.
router.get('/course-students', h(c.courseStudents));

module.exports = router;
