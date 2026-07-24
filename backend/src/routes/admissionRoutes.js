const express = require('express');
const h = require('../utils/asyncHandler');
const crudFactory = require('../controllers/crudFactory');
const genericRouter = require('./genericRoutes');
const admissionController = require('../controllers/admissionController');
const { Admission, Student, Course } = require('../models');

const router = express.Router();

// Typeahead — declared before the generic CRUD router so it isn't shadowed by
// its `/:id` route.
router.get('/search', h(admissionController.search));

// Lateral-entry roster (grouped course-wise on the client).
router.get('/lateral', h(admissionController.lateral));

// Standard list/getOne/create/update/remove (list supports opt-in pagination).
router.use('/', genericRouter(
  crudFactory(Admission, 'adm_id', [{ model: Student }, { model: Course }])
));

module.exports = router;
