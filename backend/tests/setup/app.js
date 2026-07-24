// Shared integration harness: brings up the app against the test DB and exposes
// helpers for auth tokens and seeding. Requires ./db first so env is set before
// the app's config/env is evaluated.
require('./db');

const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const models = require('../../src/models');
const { config } = require('../../src/config/env');

// Sign a token the same way the login route does, so protected routes accept it
// without going through the (rate-limited) login endpoint.
function tokenFor({ userId = 1, username = 'tester', role = 'admin', staff_id = null } = {}) {
  return jwt.sign({ userId, username, role, staff_id }, config.JWT_SECRET, { expiresIn: '1h' });
}

// Seed a course + student + admission + fee-structure slabs and return their ids.
// Defaults model a BE Regular student in batch 2025-26 with year1=100000,
// year2=120000 official totals.
async function seedAdmission({
  courseName = 'B.E. Computer Science',
  dsn = 20250001,
  entryType = 'Regular',
  year1Total = 100000,
  year2Total = 120000,
} = {}) {
  const { Course, Student, Admission, FeeStructure } = models;
  const course = await Course.create({ course_name: courseName });
  await Student.create({ dsn, student_name: 'Test Student', course_id: course.course_id, semester: 1 });
  const adm = await Admission.create({
    dsn, course_id: course.course_id, entry_type: entryType,
    // academic_year auto-fills from dsn prefix (2025 -> "2025-26").
  });
  await FeeStructure.bulkCreate([
    { batch_year: adm.academic_year, program: 'BE', entry_type: entryType, program_year: 1, total_fee: year1Total },
    { batch_year: adm.academic_year, program: 'BE', entry_type: entryType, program_year: 2, total_fee: year2Total },
  ]);
  return { course, adm, batch: adm.academic_year };
}

module.exports = { app, models, tokenFor, seedAdmission };
