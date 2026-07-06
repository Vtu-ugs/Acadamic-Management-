const express = require('express');
const crudFactory = require('../controllers/crudFactory');
const genericRouter = require('./genericRoutes');
const {
  Course, Staff, Admission, AcademicCoordinator, WeeklyDiary, Student, FeeStructure,
} = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public auth endpoints (login is unauthenticated).
router.use('/auth', require('./authRoutes'));

// Everything below requires a valid session.
router.use(requireAuth);

// Role guards per module (admin is included in every set → full access).
const admission = requireRole('admin', 'admission_staff');
const staff = requireRole('admin', 'staff');

// Admin-only: manage login accounts (staff / admission staff / other admins).
router.use('/users', requireRole('admin'), require('./userRoutes'));

// Feature-rich modules
router.use('/students', admission, require('./studentRoutes'));
router.use('/fees', admission, require('./feeRoutes'));
router.use('/certificates', admission, require('./certificateRoutes'));

// Straightforward CRUD modules
// Courses are shared lookups — any authenticated user may read them.
router.use('/courses', genericRouter(crudFactory(Course, 'course_id')));
router.use('/fee-structures', admission, genericRouter(crudFactory(FeeStructure, 'structure_id')));
router.use('/staff', staff, genericRouter(crudFactory(Staff, 'staff_id', [{ model: Course }])));
router.use('/admissions', admission, genericRouter(
  crudFactory(Admission, 'adm_id', [{ model: Student }, { model: Course }])
));
router.use('/coordinators', staff, genericRouter(
  crudFactory(AcademicCoordinator, 'co_id', [{ model: Course }, { model: Staff }])
));
router.use('/diary', staff, genericRouter(crudFactory(WeeklyDiary, 'diary_id', [{ model: Staff }])));

module.exports = router;
