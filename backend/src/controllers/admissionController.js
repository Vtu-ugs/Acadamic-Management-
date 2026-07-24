const { Op } = require('sequelize');
const { Admission, Student, Course } = require('../models');

// Typeahead for the admission pickers (Fees, Certificates). Searches the linked
// student by name / USN / DSN and returns at most 50 matches with the student +
// course loaded, so the client never has to pull the whole admission table just
// to fill a dropdown. An empty query returns the most recent admissions.
exports.search = async (req, res) => {
  const q = (req.query.q || '').trim();

  const studentInclude = { model: Student, required: true };
  if (q) {
    studentInclude.where = {
      [Op.or]: [
        { student_name: { [Op.like]: `%${q}%` } },
        { usn: { [Op.like]: `%${q}%` } },
        ...(Number.isInteger(Number(q)) ? [{ dsn: Number(q) }] : []),
      ],
    };
  }

  const admissions = await Admission.findAll({
    include: [studentInclude, { model: Course }],
    order: [['adm_id', 'DESC']],
    limit: 50,
  });
  res.json(admissions);
};

// GET /admissions/lateral?academic_year=2026-27
// Every lateral-entry admission with its student + course, so the frontend can
// segregate them course-wise. Optionally scoped to one admission batch.
exports.lateral = async (req, res) => {
  const where = { entry_type: 'Lateral' };
  const year = req.query.academic_year;
  if (year && year !== 'all') where.academic_year = year;

  const admissions = await Admission.findAll({
    where,
    include: [{ model: Student, required: true }, { model: Course }],
    order: [['course_id', 'ASC'], ['dsn', 'ASC']],
  });
  res.json(admissions);
};
