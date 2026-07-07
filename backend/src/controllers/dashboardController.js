const { Op, fn, col } = require('sequelize');
const {
  Student, StudentPersonalDetails, Admission, Course, Fee, Certificate,
} = require('../models');
const { batchYearFromCsn } = require('../utils/csn');

// CSN range for a batch year string like "2026-27" -> [20260000, 20269999].
// A student's batch is intrinsic to their CSN prefix, so this cleanly scopes a
// whole cohort (and follows it across all 4/2 years of the programme).
function csnRange(academicYear) {
  const y = parseInt(String(academicYear).slice(0, 4), 10);
  if (!Number.isFinite(y)) return null;
  return { lo: y * 10000, hi: y * 10000 + 9999 };
}

const norm = (c) => (c || '').trim() || 'Unspecified';

// GET /dashboard/stats?academic_year=2026-27
// Returns the list of admission batches plus the overall totals and the
// per-branch statistics, all scoped to the selected batch (or all batches when
// academic_year is omitted / "all").
exports.stats = async (req, res) => {
  const year = req.query.academic_year && req.query.academic_year !== 'all'
    ? req.query.academic_year
    : null;
  const range = year ? csnRange(year) : null;

  const studentWhere = range ? { csn: { [Op.between]: [range.lo, range.hi] } } : {};
  const admWhere = year ? { academic_year: year } : undefined;

  const [courses, students, feesPending, certCount, allCsns, admYears] = await Promise.all([
    Course.findAll({ order: [['course_name', 'ASC']], raw: true }),
    Student.findAll({
      where: studentWhere,
      attributes: ['csn', 'course_id', 'usn'],
      include: [{ model: StudentPersonalDetails, attributes: ['category'] }],
      raw: true,
      nest: true,
    }),
    // Only balances still owed — mirrors the pending-dues report.
    Fee.findAll({
      attributes: ['pending_due'],
      where: { pending_due: { [Op.gt]: 0 } },
      include: [{ model: Admission, attributes: ['course_id', 'academic_year'], where: admWhere }],
      raw: true,
      nest: true,
    }),
    Certificate.count(
      year ? { include: [{ model: Admission, attributes: [], where: admWhere }] } : undefined
    ),
    // Every CSN (unfiltered) → the batch list for the year selector.
    Student.findAll({ attributes: ['csn'], raw: true }),
    Admission.findAll({ attributes: [[fn('DISTINCT', col('academic_year')), 'ay']], raw: true }),
  ]);

  // ----- batch list for the dropdown -----
  const yearsSet = new Set();
  allCsns.forEach((s) => { const b = batchYearFromCsn(s.csn); if (b) yearsSet.add(b); });
  admYears.forEach((a) => { if (a.ay) yearsSet.add(a.ay); });
  const academic_years = Array.from(yearsSet).sort().reverse();

  // ----- per-branch accumulator -----
  const byCourse = new Map();
  for (const c of courses) {
    byCourse.set(c.course_id, {
      course_id: c.course_id,
      course_name: c.course_name,
      intake: c.intake,
      total_students: 0,
      total_pending: 0,
      dues_count: 0,
      categories: {},
    });
  }

  let usnPending = 0;
  for (const s of students) {
    if (!s.usn) usnPending += 1;
    const b = byCourse.get(s.course_id);
    if (!b) continue;
    b.total_students += 1;
    const cat = norm(s.student_personal_detail && s.student_personal_detail.category);
    b.categories[cat] = (b.categories[cat] || 0) + 1;
  }

  let totalDue = 0;
  for (const f of feesPending) {
    totalDue += Number(f.pending_due || 0);
    const b = byCourse.get(f.admission && f.admission.course_id);
    if (!b) continue;
    b.total_pending += Number(f.pending_due || 0);
    b.dues_count += 1;
  }

  res.json({
    academic_year: year,
    academic_years,
    totals: {
      students: students.length,
      usnPending,
      courses: courses.length,
      duesCount: feesPending.length,
      totalDue,
      certs: certCount,
    },
    branches: Array.from(byCourse.values()),
  });
};
