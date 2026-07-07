const { Op } = require('sequelize');
const {
  sequelize, Student, StudentPersonalDetails, Admission, Course, Fee,
} = require('../models');
const { generateCsn, withCsnRetry } = require('../utils/csn');

// FR-S4: list all students across all courses (with optional course/semester filters)
exports.list = async (req, res) => {
  const where = {};
  if (req.query.course_id) where.course_id = req.query.course_id;
  if (req.query.semester) where.semester = req.query.semester;

  const students = await Student.findAll({
    where,
    include: [
      { model: Course },
      { model: StudentPersonalDetails },
    ],
    order: [['csn', 'ASC']],
  });
  res.json(students);
};

// FR-S3: quick search — USN first, then name, student mobile, parent mobile, csn
exports.search = async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const students = await Student.findAll({
    include: [{ model: StudentPersonalDetails }, { model: Course }],
    where: {
      [Op.or]: [
        { usn: { [Op.like]: `%${q}%` } },
        { student_name: { [Op.like]: `%${q}%` } },
        ...(Number.isInteger(Number(q)) ? [{ csn: Number(q) }] : []),
        { '$student_personal_detail.student_mobile$': { [Op.like]: `%${q}%` } },
        { '$student_personal_detail.parent_mobile$': { [Op.like]: `%${q}%` } },
      ],
    },
    limit: 100,
  });
  res.json(students);
};

// Dashboard: per-branch (per-course) statistics — total students, total pending
// dues, and a caste/category-wise headcount for each branch. One assembled
// object per course so the dashboard can render a card per branch.
exports.branchStats = async (_req, res) => {
  const [courses, students, fees] = await Promise.all([
    Course.findAll({ order: [['course_name', 'ASC']], raw: true }),
    Student.findAll({
      attributes: ['csn', 'course_id'],
      include: [{ model: StudentPersonalDetails, attributes: ['category'] }],
      raw: true,
      nest: true,
    }),
    // Only fees still carrying a balance — mirrors the pending-dues report so
    // the per-branch totals add up to the dashboard-wide "Total Pending Dues".
    Fee.findAll({
      attributes: ['pending_due'],
      where: { pending_due: { [Op.gt]: 0 } },
      include: [{ model: Admission, attributes: ['course_id'] }],
      raw: true,
      nest: true,
    }),
  ]);

  const norm = (c) => (c || '').trim() || 'Unspecified';

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

  for (const s of students) {
    const b = byCourse.get(s.course_id);
    if (!b) continue;
    b.total_students += 1;
    const cat = norm(s.student_personal_detail && s.student_personal_detail.category);
    b.categories[cat] = (b.categories[cat] || 0) + 1;
  }

  for (const f of fees) {
    const b = byCourse.get(f.admission && f.admission.course_id);
    if (!b) continue;
    b.total_pending += Number(f.pending_due || 0);
    b.dues_count += 1;
  }

  res.json(Array.from(byCourse.values()));
};

// FR-S3a: students with USN pending (usn IS NULL)
exports.usnPending = async (_req, res) => {
  const students = await Student.findAll({
    where: { usn: { [Op.is]: null } },
    include: [{ model: Course }, { model: StudentPersonalDetails }],
    order: [['csn', 'ASC']],
  });
  res.json(students);
};

exports.getOne = async (req, res) => {
  const student = await Student.findByPk(req.params.csn, {
    include: [
      { model: Course },
      { model: StudentPersonalDetails },
      { model: Admission },
    ],
  });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
};

// FR-S1: add student (academic + personal) — usn left NULL at admission.
// csn is generated as a year-wise running number (e.g. 20260001); an optional
// `csn_year` in the body overrides the calendar year used for the prefix.
exports.create = async (req, res) => {
  const { personal = {}, csn_year, csn: _ignore, ...academic } = req.body;
  if (academic.usn === '') academic.usn = null;
  const year = csn_year ? Number(csn_year) : new Date().getFullYear();

  const result = await withCsnRetry(() => sequelize.transaction(async (t) => {
    const csn = await generateCsn(t, year);
    const student = await Student.create({ ...academic, csn }, { transaction: t });
    await StudentPersonalDetails.create(
      { ...personal, csn: student.csn },
      { transaction: t }
    );
    return student;
  }));

  const created = await Student.findByPk(result.csn, {
    include: [{ model: StudentPersonalDetails }, { model: Course }],
  });
  res.status(201).json(created);
};

// FR-S2: edit academic + personal details
exports.update = async (req, res) => {
  const { personal, ...academic } = req.body;
  if (academic.usn === '') academic.usn = null;

  const student = await Student.findByPk(req.params.csn);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  await sequelize.transaction(async (t) => {
    await student.update(academic, { transaction: t });
    if (personal) {
      const [spd] = await StudentPersonalDetails.findOrCreate({
        where: { csn: student.csn },
        defaults: { csn: student.csn },
        transaction: t,
      });
      await spd.update(personal, { transaction: t });
    }
  });

  const updated = await Student.findByPk(student.csn, {
    include: [{ model: StudentPersonalDetails }, { model: Course }],
  });
  res.json(updated);
};

// FR-S1a: update USN once university allots it (uniqueness validated by DB)
exports.updateUsn = async (req, res) => {
  const { usn } = req.body;
  if (!usn) return res.status(400).json({ error: 'usn is required' });

  const student = await Student.findByPk(req.params.csn);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const dup = await Student.findOne({ where: { usn } });
  if (dup && dup.csn !== student.csn) {
    return res.status(409).json({ error: `USN ${usn} already assigned to CSN ${dup.csn}` });
  }

  await student.update({ usn });
  res.json(student);
};

exports.remove = async (req, res) => {
  const deleted = await Student.destroy({ where: { csn: req.params.csn } });
  if (!deleted) return res.status(404).json({ error: 'Student not found' });
  res.status(204).end();
};
