const PDFDocument = require('pdfkit');
const { fn, col, literal, QueryTypes, Op } = require('sequelize');
const {
  sequelize, Fee, Admission, Student, Course, FeeStructure,
} = require('../models');

// ---------------------------------------------------------------------------
// Helper: which program a course belongs to (drives the fee-structure lookup).
// ---------------------------------------------------------------------------
function detectProgram(courseName) {
  const c = (courseName || '').toUpperCase();
  if (c.includes('MCA') || c.includes('M.C.A')) return 'MCA';
  if (c.includes('MTECH') || c.includes('M.TECH')) return 'MTech';
  return 'BE';
}

// Load an admission with its official fee-structure slabs (batch + program +
// entry type). One source of truth for both carry-forward and billing.
async function getAdmissionSlabs(admId) {
  const adm = await Admission.findByPk(admId, { include: [{ model: Course }] });
  if (!adm) return { adm: null, slabs: [], program: 'BE', startYear: 1 };
  const program = detectProgram(adm.course?.course_name);
  const slabs = await FeeStructure.findAll({
    where: {
      batch_year: adm.academic_year || '',
      program,
      entry_type: adm.entry_type || 'Regular',
    },
    order: [['program_year', 'ASC']],
  });
  const startYear = adm.entry_type === 'Lateral' ? 2 : 1;
  return { adm, slabs, program, startYear };
}

// ---------------------------------------------------------------------------
// Helper: compute carry-forward for a given admission + program year.
// Net of the OFFICIAL expected fees for all previous years minus everything
// actually paid in those years. This is robust to multiple part-payment
// receipts per year (no double counting) and cannot be gamed by editing a
// stored pending_due value — the shortfall always follows the student forward.
// ---------------------------------------------------------------------------
async function computeCarryForward(admId, programYear, preloaded) {
  const yr = Number(programYear);
  if (!yr || yr <= 1) return 0;

  const { slabs, startYear } = preloaded || await getAdmissionSlabs(admId);

  // Official fees expected for every prior program year.
  let expected = 0;
  for (let y = startYear; y < yr; y++) {
    const slab = slabs.find((s) => s.program_year === y);
    expected += Number(slab?.total_fee) || 0;
  }

  // Everything paid across all receipts of those prior years.
  const priorFees = await Fee.findAll({
    where: { adm_id: admId, program_year: { [Op.lt]: yr } },
    raw: true,
  });
  const paid = priorFees.reduce((s, f) => (
    s + (Number(f.kea_fee) || 0) + (Number(f.regn_fee) || 0) + (Number(f.tuition_fee) || 0)
  ), 0);

  return Math.max(expected - paid, 0);
}

// FR-F1/F3: record a fee. The server is the source of truth for the money:
// the year is BILLED at the official slab total, carry-forward and pending are
// always recomputed here — client-supplied totals/carry/pending are ignored so
// a receipt can never under-bill or hide a shortfall.
exports.create = async (req, res) => {
  const data = { ...req.body };

  // Persist program_year
  data.program_year = data.program_year != null ? (Number(data.program_year) || null) : null;

  const { slabs, adm } = await getAdmissionSlabs(data.adm_id);
  const slab = slabs.find((s) => s.program_year === data.program_year);

  // Bill this year at the official slab total when a slab exists; otherwise
  // fall back to a supplied total (e.g. batches with no structure entered yet).
  const billed = slab ? (Number(slab.total_fee) || 0) : (Number(data.total_course_fee) || 0);
  data.total_course_fee = billed;

  // Carry-forward is always server-computed from prior years — never trusted
  // from the client.
  data.carry_forward = await computeCarryForward(data.adm_id, data.program_year);

  const carryFwd = Number(data.carry_forward) || 0;
  const totalDue = billed + carryFwd;
  const paid = (Number(data.kea_fee) || 0) + (Number(data.regn_fee) || 0) + (Number(data.tuition_fee) || 0);

  // Pending is always recomputed here; the shortfall (slab + carry − paid) is
  // authoritative and carries into next year via computeCarryForward.
  data.pending_due = Math.max(totalDue - paid, 0);
  data.payment_status = data.pending_due <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');

  if (!data.academic_year && adm?.academic_year) data.academic_year = adm.academic_year;
  if (!data.receipt_number) data.receipt_number = `RC-${Date.now()}`;

  const fee = await Fee.create(data);
  res.status(201).json(fee);
};

exports.list = async (req, res) => {
  const where = {};
  if (req.query.payment_status) where.payment_status = req.query.payment_status;
  if (req.query.academic_year) where.academic_year = req.query.academic_year;

  const fees = await Fee.findAll({
    where,
    include: [{ model: Admission, include: [{ model: Student }, { model: Course }] }],
    order: [['fee_id', 'DESC']],
  });
  res.json(fees);
};

// FR-F4: student-wise financial history
exports.byStudent = async (req, res) => {
  const fees = await Fee.findAll({
    include: [{
      model: Admission,
      where: { csn: req.params.csn },
      include: [{ model: Student }, { model: Course }],
    }],
    order: [['receipt_date', 'ASC']],
  });
  res.json(fees);
};

// ---------------------------------------------------------------------------
// NEW: Year-wise fee ledger for a student (GET /fees/ledger/:csn)
// Returns one row per program year with expected fee, carry-forward, paid, pending.
// ---------------------------------------------------------------------------
exports.ledger = async (req, res) => {
  const csn = req.params.csn;

  // Find admission(s) for this student
  const admissions = await Admission.findAll({
    where: { csn },
    include: [{ model: Student }, { model: Course }],
  });

  if (!admissions.length) return res.status(404).json({ error: 'No admission found for this student' });

  const results = [];

  for (const adm of admissions) {
    // Determine program from course name
    let program = 'BE';
    const cname = (adm.course?.course_name || '').toUpperCase();
    if (cname.includes('MCA') || cname.includes('M.C.A')) program = 'MCA';
    else if (cname.includes('MTECH') || cname.includes('M.TECH')) program = 'MTech';

    const maxYear = program === 'BE' ? 4 : 2;
    const startYear = adm.entry_type === 'Lateral' ? 2 : 1;

    // Get all fee records for this admission
    const feeRecords = await Fee.findAll({
      where: { adm_id: adm.adm_id },
      order: [['program_year', 'ASC'], ['receipt_date', 'ASC']],
    });

    // Get fee structure slabs for this student's ADMISSION batch. A student
    // follows the fee structure of the year they were admitted for the whole
    // course duration — it does not switch to a later year's structure.
    const slabs = await FeeStructure.findAll({
      where: {
        batch_year: adm.academic_year || '',
        program,
        entry_type: adm.entry_type || 'Regular',
      },
      order: [['program_year', 'ASC']],
    });

    const yearRows = [];
    let cumulativePending = 0;

    for (let yr = startYear; yr <= maxYear; yr++) {
      const slab = slabs.find((s) => s.program_year === yr);
      const yearFees = feeRecords.filter((f) => f.program_year === yr);

      const expectedFee = Number(slab?.total_fee) || 0;
      const carryForward = cumulativePending;
      const totalDue = expectedFee + carryForward;

      // Sum up all payments for this year
      const totalPaid = yearFees.reduce((sum, f) => {
        return sum + (Number(f.kea_fee) || 0) + (Number(f.regn_fee) || 0) + (Number(f.tuition_fee) || 0);
      }, 0);

      const pending = Math.max(totalDue - totalPaid, 0);

      // Determine academic year for this program year
      let academicYear = '';
      if (adm.academic_year) {
        const baseYear = parseInt(adm.academic_year.split('-')[0], 10);
        const offset = yr - startYear;
        academicYear = `${baseYear + offset}-${(baseYear + offset + 1).toString().slice(-2)}`;
      }

      const status = yearFees.length === 0 ? 'Pending'
        : pending <= 0 ? 'Paid'
        : totalPaid > 0 ? 'Partial'
        : 'Pending';

      yearRows.push({
        program_year: yr,
        academic_year: academicYear,
        expected_fee: expectedFee,
        carry_forward: carryForward,
        total_due: totalDue,
        total_paid: totalPaid,
        pending,
        status,
        receipts: yearFees,
        slab,
      });

      cumulativePending = pending;
    }

    results.push({
      adm_id: adm.adm_id,
      csn: adm.csn,
      student_name: adm.student?.student_name,
      usn: adm.student?.usn,
      course_name: adm.course?.course_name,
      program,
      entry_type: adm.entry_type,
      batch_year: adm.academic_year,
      years: yearRows,
    });
  }

  res.json(results);
};

// Helper: get carry-forward amount for a given admission + program year (used by frontend)
exports.getCarryForward = async (req, res) => {
  const { adm_id, program_year } = req.query;
  if (!adm_id || !program_year) return res.json({ carry_forward: 0 });
  const cf = await computeCarryForward(Number(adm_id), Number(program_year));
  res.json({ carry_forward: cf });
};

// FR-F3: pending dues report (filterable by course/semester/year)
exports.pendingDues = async (req, res) => {
  const admWhere = {};
  if (req.query.course_id) admWhere.course_id = req.query.course_id;
  if (req.query.academic_year) admWhere.academic_year = req.query.academic_year;

  const fees = await Fee.findAll({
    where: { pending_due: { [Op.gt]: 0 } },
    include: [{
      model: Admission,
      where: Object.keys(admWhere).length ? admWhere : undefined,
      include: [{ model: Student }, { model: Course }],
    }],
    order: [['pending_due', 'DESC']],
  });
  res.json(fees);
};

// FR-F5: year-wise collection report
exports.reportByYear = async (_req, res) => {
  const rows = await Fee.findAll({
    attributes: [
      'academic_year',
      [fn('SUM', col('total_course_fee')), 'total_billed'],
      [fn('SUM', col('pending_due')), 'total_pending'],
      [fn('SUM', literal('total_course_fee - pending_due')), 'total_collected'],
      [fn('COUNT', col('fee_id')), 'receipts'],
    ],
    group: ['academic_year'],
    order: [['academic_year', 'ASC']],
  });
  res.json(rows);
};

// FR-F6: course-wise collection report
exports.reportByCourse = async (_req, res) => {
  const rows = await sequelize.query(
    `SELECT c.course_name AS course_name,
            SUM(f.total_course_fee)               AS total_billed,
            SUM(f.pending_due)                    AS total_pending,
            SUM(f.total_course_fee - f.pending_due) AS total_collected
       FROM fee f
       JOIN admission a ON a.adm_id = f.adm_id
       JOIN courses   c ON c.course_id = a.course_id
      GROUP BY c.course_id, c.course_name
      ORDER BY c.course_name`,
    { type: QueryTypes.SELECT }
  );
  res.json(rows);
};

// FR-F2: printable PDF receipt
exports.receiptPdf = async (req, res) => {
  const fee = await Fee.findByPk(req.params.id, {
    include: [{ model: Admission, include: [{ model: Student }, { model: Course }] }],
  });
  if (!fee) return res.status(404).json({ error: 'Fee record not found' });

  const student = fee.admission?.student;
  const course = fee.admission?.course;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${fee.receipt_number}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).text('Fee Receipt', { align: 'center' }).moveDown();
  doc.fontSize(11);
  const line = (k, v) => doc.text(`${k}: ${v ?? '-'}`);

  line('Receipt Number', fee.receipt_number);
  line('Receipt Date', fee.receipt_date);
  line('Academic Year', fee.academic_year);
  line('Program Year', fee.program_year || '-');
  doc.moveDown(0.5);
  line('Student', student?.student_name);
  line('USN', student?.usn || '(USN pending)');
  line('CSN', student?.csn);
  line('Course', course?.course_name);
  doc.moveDown(0.5);
  line('KEA Fee', fee.kea_fee);
  line('Registration Fee', fee.regn_fee);
  line('Tuition Fee', fee.tuition_fee);
  line('Total Course Fee', fee.total_course_fee);
  line('Carry Forward from Previous Year(s)', fee.carry_forward);
  line('Pending Due', fee.pending_due);
  line('Payment Status', fee.payment_status);
  doc.moveDown(2);
  doc.text('Authorised Signature: ____________________', { align: 'right' });

  doc.end();
};
