const PDFDocument = require('pdfkit');
const { fn, col, literal, QueryTypes, Op } = require('sequelize');
const {
  sequelize, Fee, Admission, Student, Course, FeeStructure,
} = require('../models');
const { isPaged, parsePagination, UNPAGED_MAX } = require('../utils/paginate');
const { logActivity } = require('../utils/activityLog');

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

// Money actually received on a single receipt.
const paidOf = (f) => (Number(f.kea_fee) || 0) + (Number(f.regn_fee) || 0) + (Number(f.tuition_fee) || 0);

// ---------------------------------------------------------------------------
// Consolidate all receipts of one (adm_id, program_year) so the stored
// pending_due never double-counts across installments. A year can be paid in
// several receipts; the true remaining is `slab − everything paid this year`,
// which we park on the LATEST receipt and zero on the earlier ones. Then any
// SUM(pending_due) over fee rows equals the real outstanding.
//
// The net is per year (no carry): an unpaid prior year stays represented by its
// own year's row, so summing per-year nets never counts a shortfall twice.
// ---------------------------------------------------------------------------
async function consolidateYearBalance(admId, programYear, slabTotal, transaction) {
  if (programYear == null) return; // receipts with no year: nothing to net
  const rows = await Fee.findAll({
    where: { adm_id: admId, program_year: programYear },
    order: [['fee_id', 'ASC']],
    transaction,
  });
  if (!rows.length) return;

  const sumPaid = rows.reduce((s, f) => s + paidOf(f), 0);
  const net = Math.max((Number(slabTotal) || 0) - sumPaid, 0);
  const lastId = rows[rows.length - 1].fee_id;

  for (const f of rows) {
    const isLast = f.fee_id === lastId;
    const pending = isLast ? net : 0;
    const status = isLast
      ? (net <= 0 ? 'Paid' : (sumPaid > 0 ? 'Partial' : 'Pending'))
      : 'Paid';
    await f.update({ pending_due: pending, payment_status: status }, { transaction });
  }
}

// FR-F1/F3: record a fee. The server is the source of truth for the money:
// the year is BILLED at the official slab total, carry-forward and pending are
// always recomputed here — client-supplied totals/carry/pending are ignored so
// a receipt can never under-bill or hide a shortfall.
exports.create = async (req, res) => {
  const data = { ...req.body };

  // Persist program_year
  data.program_year = data.program_year != null ? (Number(data.program_year) || null) : null;

  // Reject negative payment amounts — the form guards min=0, but a raw API call
  // or import must not be able to store a negative that corrupts the balance.
  for (const k of ['kea_fee', 'regn_fee', 'tuition_fee']) {
    if (data[k] != null && data[k] !== '' && Number(data[k]) < 0) {
      return res.status(400).json({ error: `${k} cannot be negative` });
    }
  }

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
  // Random suffix so two receipts saved in the same millisecond don't collide on
  // the UNIQUE receipt_number (mirrors the import path).
  if (!data.receipt_number) data.receipt_number = `RC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Insert the receipt, then re-net the whole year so pending_due stays
  // non-double-counting across installments (see consolidateYearBalance).
  const fee = await sequelize.transaction(async (t) => {
    const created = await Fee.create(data, { transaction: t });
    await consolidateYearBalance(data.adm_id, data.program_year, billed, t);
    return created;
  });

  // Return the row with its consolidated pending_due / payment_status.
  const fresh = await Fee.findByPk(fee.fee_id);
  res.status(201).json(fresh);
};

// Void a receipt (FR-F correction). Removes the fee row and re-nets the rest of
// that (adm_id, program_year) so the year's balance stays correct. Deleting the
// only receipt of a year simply leaves it fully pending again. Audited.
exports.remove = async (req, res) => {
  const fee = await Fee.findByPk(req.params.id);
  if (!fee) return res.status(404).json({ error: 'Fee record not found' });

  const { adm_id: admId, program_year: programYear, receipt_number: receiptNo } = fee;

  // Bill at the official slab (same source of truth as create) so the surviving
  // receipts re-net against the right total.
  const { slabs } = await getAdmissionSlabs(admId);
  const slab = slabs.find((s) => s.program_year === programYear);
  const slabTotal = slab ? (Number(slab.total_fee) || 0) : (Number(fee.total_course_fee) || 0);

  await sequelize.transaction(async (t) => {
    await fee.destroy({ transaction: t });
    await consolidateYearBalance(admId, programYear, slabTotal, t);
  });

  await logActivity(req.user, 'fee_void', `Fee #${req.params.id} (${receiptNo || 'no receipt no.'})`);
  res.status(204).end();
};

exports.list = async (req, res) => {
  const where = {};
  if (req.query.payment_status) where.payment_status = req.query.payment_status;
  if (req.query.academic_year) where.academic_year = req.query.academic_year;

  // Optional student search — match the receipt's student by name, USN or DSN.
  const q = (req.query.q || '').trim();
  const studentInclude = { model: Student };
  const admissionInclude = { model: Admission, include: [studentInclude, { model: Course }] };
  if (q) {
    // Inner-join so the filter actually narrows the fee rows.
    studentInclude.required = true;
    admissionInclude.required = true;
    studentInclude.where = {
      [Op.or]: [
        { student_name: { [Op.like]: `%${q}%` } },
        { usn: { [Op.like]: `%${q}%` } },
        ...(Number.isInteger(Number(q)) ? [{ dsn: Number(q) }] : []),
      ],
    };
  }
  const include = [admissionInclude];

  // Opt-in pagination (see utils/paginate); plain array otherwise.
  if (isPaged(req.query)) {
    const { page, pageSize, limit, offset } = parsePagination(req.query);
    const { rows, count } = await Fee.findAndCountAll({
      where, include, order: [['fee_id', 'DESC']], limit, offset, distinct: true,
    });
    return res.json({ rows, total: count, page, pageSize });
  }

  const fees = await Fee.findAll({
    where, include, order: [['fee_id', 'DESC']], limit: UNPAGED_MAX, // safety cap
  });
  res.json(fees);
};

// FR-F4: student-wise financial history
exports.byStudent = async (req, res) => {
  const fees = await Fee.findAll({
    include: [{
      model: Admission,
      where: { dsn: req.params.dsn },
      include: [{ model: Student }, { model: Course }],
    }],
    order: [['receipt_date', 'ASC']],
  });
  res.json(fees);
};

// ---------------------------------------------------------------------------
// NEW: Year-wise fee ledger for a student (GET /fees/ledger/:dsn)
// Returns one row per program year with expected fee, carry-forward, paid, pending.
// ---------------------------------------------------------------------------
exports.ledger = async (req, res) => {
  const dsn = req.params.dsn;

  // Find admission(s) for this student
  const admissions = await Admission.findAll({
    where: { dsn },
    include: [{ model: Student }, { model: Course }],
  });

  // A student with no admission yet has an empty ledger, not a missing one —
  // the page renders its own "no admission" notice from this. A 404 here would
  // surface as an error banner instead.
  if (!admissions.length) return res.json([]);

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
      dsn: adm.dsn,
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

  const where = { pending_due: { [Op.gt]: 0 } };
  const include = [{
    model: Admission,
    where: Object.keys(admWhere).length ? admWhere : undefined,
    include: [{ model: Student }, { model: Course }],
  }];

  // Opt-in pagination (see utils/paginate); plain array otherwise.
  if (isPaged(req.query)) {
    const { page, pageSize, limit, offset } = parsePagination(req.query);
    const { rows, count } = await Fee.findAndCountAll({
      where, include, order: [['pending_due', 'DESC']], limit, offset, distinct: true,
    });
    return res.json({ rows, total: count, page, pageSize });
  }

  const fees = await Fee.findAll({
    where, include, order: [['pending_due', 'DESC']], limit: UNPAGED_MAX, // safety cap
  });
  res.json(fees);
};

// FR-F5: year-wise collection report.
// Collected is the actual money received (sum of receipt amounts); pending is the
// net outstanding (consolidateYearBalance keeps pending_due free of double
// counting); billed = collected + pending. Summing total_course_fee would
// double-count a year billed across several installment receipts.
exports.reportByYear = async (_req, res) => {
  const rows = await Fee.findAll({
    attributes: [
      'academic_year',
      [fn('SUM', literal('COALESCE(kea_fee,0) + COALESCE(regn_fee,0) + COALESCE(tuition_fee,0)')), 'total_collected'],
      [fn('SUM', col('pending_due')), 'total_pending'],
      [fn('SUM', literal('COALESCE(kea_fee,0) + COALESCE(regn_fee,0) + COALESCE(tuition_fee,0) + COALESCE(pending_due,0)')), 'total_billed'],
      [fn('COUNT', col('fee_id')), 'receipts'],
    ],
    group: ['academic_year'],
    order: [['academic_year', 'ASC']],
  });
  res.json(rows);
};

// FR-F6: course-wise collection report. Same net-based definitions as
// reportByYear so installments never double-count (collected = money received,
// pending = net outstanding, billed = collected + pending).
exports.reportByCourse = async (_req, res) => {
  const rows = await sequelize.query(
    `SELECT c.course_name AS course_name,
            SUM(COALESCE(f.kea_fee,0) + COALESCE(f.regn_fee,0) + COALESCE(f.tuition_fee,0)
                + COALESCE(f.pending_due,0))                                AS total_billed,
            SUM(f.pending_due)                                              AS total_pending,
            SUM(COALESCE(f.kea_fee,0) + COALESCE(f.regn_fee,0) + COALESCE(f.tuition_fee,0)) AS total_collected
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
  line('DSN', student?.dsn);
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

// Exported for the one-time backfill script (scripts/backfill_fee_balances.js).
exports.consolidateYearBalance = consolidateYearBalance;
exports.getAdmissionSlabs = getAdmissionSlabs;
