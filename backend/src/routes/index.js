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

// Admin-only: activity/audit log (logins, logouts, diary changes).
router.use('/activity', requireRole('admin'), require('./activityRoutes'));

// Dashboard overview — any authenticated user may read it.
router.use('/dashboard', require('./dashboardRoutes'));

// Custom fields: readable by all (forms render from them), admin-only to change.
router.use('/custom-fields', require('./customFieldRoutes'));

// Feature-rich modules
router.use('/students', admission, require('./studentRoutes'));
router.use('/fees', admission, require('./feeRoutes'));
router.use('/certificates', admission, require('./certificateRoutes'));

// Straightforward CRUD modules
// Courses are shared lookups — any authenticated user may read them.
router.use('/courses', genericRouter(crudFactory(Course, 'course_id')));
router.use('/fee-structures', admission, genericRouter(crudFactory(FeeStructure, 'structure_id')));
// Staff uses a dedicated controller (admin can add/delete staff + issue logins).
router.use('/staff', staff, require('./staffRoutes'));
router.use('/admissions', admission, genericRouter(
  crudFactory(Admission, 'adm_id', [{ model: Student }, { model: Course }])
));
router.use('/coordinators', staff, genericRouter(
  crudFactory(AcademicCoordinator, 'co_id', [{ model: Course }, { model: Staff }])
));
// Diary uses a dedicated controller that scopes staff to their own entries.
router.use('/diary', staff, require('./diaryRoutes'));

module.exports = router;
