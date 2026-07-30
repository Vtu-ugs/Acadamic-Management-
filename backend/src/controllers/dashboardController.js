const { QueryTypes } = require('sequelize');
const PDFDocument = require('pdfkit');
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

  const [courses, studentAgg, catAgg, genderAgg, feeAgg, lateralAgg, certRows, dsnYears, admYears] = await Promise.all([
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

    // Per-course gender split. Grouped on the raw value and normalised in JS,
    // since the column is free text ("Male" / "M" / "female" all occur).
    sequelize.query(
      `SELECT s.course_id AS course_id, p.gender AS gender, COUNT(*) AS cnt
         FROM student s
         LEFT JOIN student_personal_details p ON p.dsn = s.dsn
         ${studentWhere}
        GROUP BY s.course_id, p.gender`,
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

    // Per-course lateral-entry headcount (scoped to the batch when selected).
    sequelize.query(
      `SELECT a.course_id AS course_id, COUNT(*) AS lateral_count
         FROM admission a
        WHERE a.entry_type = 'Lateral' ${admYearFilter}
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
      lateral_count: 0,
      male_count: 0,
      female_count: 0,
      other_count: 0,
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

  for (const r of genderAgg) {
    const b = byCourse.get(r.course_id);
    if (!b) continue;
    const g = String(r.gender || '').trim().toLowerCase();
    const n = Number(r.cnt) || 0;
    if (g.startsWith('m')) b.male_count += n;
    else if (g.startsWith('f')) b.female_count += n;
    else b.other_count += n; // "Other" and students with no personal details yet
  }

  for (const r of lateralAgg) {
    const b = byCourse.get(r.course_id);
    if (b) b.lateral_count = Number(r.lateral_count) || 0;
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

// Roster order: USN ascending, with USN-pending students last (by name).
// USNs are allotted by the university in a fixed sequence, so this is the order
// the office expects on any printed list.
const ROSTER_ORDER = `ORDER BY (s.usn IS NULL OR s.usn = '') ASC, s.usn ASC, s.student_name ASC`;

// GET /dashboard/course-students?course_id=1&academic_year=2026-27
// The roster (name / DSN / USN) for one course, scoped to the selected batch.
// Loaded on demand when a dashboard branch card is opened, so the main stats
// payload stays lean.
exports.courseStudents = async (req, res) => {
  const courseId = Number(req.query.course_id);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'course_id is required' });

  const year = req.query.academic_year && req.query.academic_year !== 'all'
    ? req.query.academic_year
    : null;
  const range = year ? dsnRange(year) : null;

  const rows = await sequelize.query(
    `SELECT s.dsn AS dsn, s.usn AS usn, s.student_name AS student_name, s.semester AS semester
       FROM student s
      WHERE s.course_id = :courseId
      ${range ? 'AND s.dsn BETWEEN :lo AND :hi' : ''}
      ${ROSTER_ORDER}`,
    {
      replacements: range ? { courseId, lo: range.lo, hi: range.hi } : { courseId },
      type: QueryTypes.SELECT,
    }
  );
  res.json(rows);
};

// GET /dashboard/usn-list.pdf?course_id=1|all&academic_year=2026-27
// A printable USN + student-name list, grouped branch-wise and ordered by USN.
// `course_id=all` prints every branch that has students, one branch per page.
exports.usnListPdf = async (req, res) => {
  const rawCourse = req.query.course_id;
  const allCourses = !rawCourse || rawCourse === 'all';
  const courseId = allCourses ? null : Number(rawCourse);
  if (!allCourses && !Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'course_id must be a number or "all"' });
  }

  const year = req.query.academic_year && req.query.academic_year !== 'all'
    ? req.query.academic_year
    : null;
  const range = year ? dsnRange(year) : null;

  const where = ['1 = 1'];
  const repl = {};
  if (!allCourses) { where.push('s.course_id = :courseId'); repl.courseId = courseId; }
  if (range) { where.push('s.dsn BETWEEN :lo AND :hi'); repl.lo = range.lo; repl.hi = range.hi; }

  const rows = await sequelize.query(
    `SELECT c.course_id AS course_id, c.course_name AS course_name,
            s.dsn AS dsn, s.usn AS usn, s.student_name AS student_name
       FROM student s
       JOIN courses c ON c.course_id = s.course_id
      WHERE ${where.join(' AND ')}
      ${ROSTER_ORDER.replace('ORDER BY', 'ORDER BY c.course_name ASC,')}`,
    { replacements: repl, type: QueryTypes.SELECT }
  );

  // Group into branches, preserving the SQL ordering.
  const groups = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.course_id !== r.course_id) {
      g = { course_id: r.course_id, course_name: r.course_name, students: [] };
      groups.push(g);
    }
    g.students.push(r);
  }

  const scope = year ? `${year} admission batch` : 'All batches';
  const fileName = allCourses ? 'usn-list-all-branches.pdf' : `usn-list-${courseId}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  if (groups.length === 0) {
    doc.fontSize(14).text('USN List', { align: 'center' });
    doc.moveDown().fontSize(11).text(`No students found for ${scope}.`, { align: 'center' });
    return doc.end();
  }

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  // Sl. No. | USN | Student Name — the three columns the office prints.
  const COLS = [{ w: 50 }, { w: 130 }, { w: R - L - 180 }];
  const X = [L, L + COLS[0].w, L + COLS[0].w + COLS[1].w];

  const headerRow = (y) => {
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Sl. No.', X[0], y, { width: COLS[0].w });
    doc.text('USN', X[1], y, { width: COLS[1].w });
    doc.text('Student Name', X[2], y, { width: COLS[2].w });
    doc.moveTo(L, y + 14).lineTo(R, y + 14).stroke();
    return y + 20;
  };

  groups.forEach((g, gi) => {
    if (gi > 0) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).text('USN List', L, doc.y, { align: 'center' });
    doc.font('Helvetica').fontSize(11).text(g.course_name, { align: 'center' });
    doc.fontSize(9).text(`${scope}  •  ${g.students.length} student(s)`, { align: 'center' });
    doc.moveDown(1);

    let y = headerRow(doc.y);
    doc.font('Helvetica').fontSize(10);

    g.students.forEach((s, i) => {
      // Start a new page before running off the bottom, repeating the header.
      if (y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        y = headerRow(doc.page.margins.top);
        doc.font('Helvetica').fontSize(10);
      }
      doc.text(String(i + 1), X[0], y, { width: COLS[0].w });
      doc.text(s.usn || 'USN pending', X[1], y, { width: COLS[1].w });
      doc.text(s.student_name || '-', X[2], y, { width: COLS[2].w });
      y += 18;
    });
  });

  doc.end();
};
