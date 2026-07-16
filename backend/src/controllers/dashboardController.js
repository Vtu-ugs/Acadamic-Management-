const { QueryTypes } = require('sequelize');
const { sequelize, Course } = require('../models');
const { batchYearFromDsn } = require('../utils/dsn');

// DSN range for a batch year string like "2026-27" -> [20260000, 20269999].
// A student's batch is intrinsic to their DSN prefix, so this cleanly scopes a
// whole cohort (and follows it across all 4/2 years of the programme).
function dsnRange(academicYear) {
  const y = parseInt(String(academicYear).slice(0, 4), 10);
  if (!Number.isFinite(y)) return null;
  return { lo: y * 10000, hi: y * 10000 + 9999 };
}

// GET /dashboard/stats?academic_year=2026-27
// Returns the list of admission batches plus the overall totals and the
// per-branch statistics, all scoped to the selected batch (or all batches when
// academic_year is omitted / "all").
//
// Aggregation runs in SQL (GROUP BY) rather than loading every row into memory,
// so the response time stays roughly flat as the student count grows.
exports.stats = async (req, res) => {
  const year = req.query.academic_year && req.query.academic_year !== 'all'
    ? req.query.academic_year
    : null;
  const range = year ? dsnRange(year) : null;

  // Scope clauses shared by the grouped queries.
  const studentWhere = range ? 'WHERE s.dsn BETWEEN :lo AND :hi' : '';
  const studentRepl = range ? { lo: range.lo, hi: range.hi } : {};
  const admYearFilter = year ? 'AND a.academic_year = :ay' : '';
  const admRepl = year ? { ay: year } : {};

  const [courses, studentAgg, catAgg, feeAgg, certRows, dsnYears, admYears] = await Promise.all([
    Course.findAll({ order: [['course_name', 'ASC']], raw: true }),

    // Per-course headcount + USN-pending count.
    sequelize.query(
      `SELECT s.course_id AS course_id,
              COUNT(*) AS total_students,
              SUM(CASE WHEN s.usn IS NULL THEN 1 ELSE 0 END) AS usn_pending
         FROM student s
         ${studentWhere}
        GROUP BY s.course_id`,
      { replacements: studentRepl, type: QueryTypes.SELECT }
    ),

    // Per-course caste/category breakdown.
    sequelize.query(
      `SELECT s.course_id AS course_id,
              COALESCE(NULLIF(TRIM(p.category), ''), 'Unspecified') AS category,
              COUNT(*) AS cnt
         FROM student s
         LEFT JOIN student_personal_details p ON p.dsn = s.dsn
         ${studentWhere}
        GROUP BY s.course_id, category`,
      { replacements: studentRepl, type: QueryTypes.SELECT }
    ),

    // Per-course pending dues (only balances still owed).
    sequelize.query(
      `SELECT a.course_id AS course_id,
              SUM(f.pending_due) AS total_pending,
              COUNT(*) AS dues_count
         FROM fee f
         JOIN admission a ON a.adm_id = f.adm_id
        WHERE f.pending_due > 0 ${admYearFilter}
        GROUP BY a.course_id`,
      { replacements: admRepl, type: QueryTypes.SELECT }
    ),

    // Certificates issued (scoped to the batch when one is selected).
    sequelize.query(
      `SELECT COUNT(*) AS cnt
         FROM certificate c
         ${year ? 'JOIN admission a ON a.adm_id = c.adm_id WHERE a.academic_year = :ay' : ''}`,
      { replacements: admRepl, type: QueryTypes.SELECT }
    ),

    // Batch list for the dropdown: DSN-prefix years + any admission academic_year.
    sequelize.query(
      'SELECT DISTINCT FLOOR(dsn / 10000) AS y FROM student',
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      "SELECT DISTINCT academic_year AS ay FROM admission WHERE academic_year IS NOT NULL AND academic_year <> ''",
      { type: QueryTypes.SELECT }
    ),
  ]);

  // ----- batch list -----
  const yearsSet = new Set();
  dsnYears.forEach((r) => { const b = batchYearFromDsn(Number(r.y) * 10000); if (b) yearsSet.add(b); });
  admYears.forEach((r) => { if (r.ay) yearsSet.add(r.ay); });
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

  let totalStudents = 0;
  let usnPending = 0;
  for (const r of studentAgg) {
    totalStudents += Number(r.total_students) || 0;
    usnPending += Number(r.usn_pending) || 0;
    const b = byCourse.get(r.course_id);
    if (b) b.total_students = Number(r.total_students) || 0;
  }

  for (const r of catAgg) {
    const b = byCourse.get(r.course_id);
    if (b) b.categories[r.category] = Number(r.cnt) || 0;
  }

  let totalDue = 0;
  let duesCount = 0;
  for (const r of feeAgg) {
    totalDue += Number(r.total_pending) || 0;
    duesCount += Number(r.dues_count) || 0;
    const b = byCourse.get(r.course_id);
    if (b) {
      b.total_pending = Number(r.total_pending) || 0;
      b.dues_count = Number(r.dues_count) || 0;
    }
  }

  res.json({
    academic_year: year,
    academic_years,
    totals: {
      students: totalStudents,
      usnPending,
      courses: courses.length,
      duesCount,
      totalDue,
      certs: Number(certRows[0]?.cnt || 0),
    },
    branches: Array.from(byCourse.values()),
  });
};
