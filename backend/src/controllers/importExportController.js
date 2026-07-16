const XLSX = require('xlsx');
const {
  sequelize, Student, StudentPersonalDetails, Course, Admission, Fee,
} = require('../models');
const { generateDsn, withDsnRetry } = require('../utils/dsn');

// Documented column mapping (NFR Data Portability). Header -> target model
// 's' = student (academic), 'p' = student_personal_details
const COLUMNS = {
  student_name:   's',  course_id: 's', usn: 's', semester: 's',
  father_name:    'p',  mother_name: 'p', per_address: 'p', temp_address: 'p',
  gender:         'p',  religion: 'p', category: 'p', caste: 'p', date_of_birth: 'p',
  email_id:       'p',  student_mobile: 'p', parent_mobile: 'p',
  blood_group:    'p',  aadhar_no: 'p',
};

// Admission columns are prefixed `adm_` in the sheet to stay unambiguous.
const ADMISSION_FIELDS = [
  'kea_ad_no', 'academic_year', 'admission_mode', 'entry_type', 'actual_category',
  'admitted_category', 'loan_provider_name', 'available_loan',
  'outside_country', 'outside_state', 'hostel_needed', 'hostel_allocated',
];
const ADMISSION_BOOL_FIELDS = [
  'outside_country', 'outside_state', 'hostel_needed', 'hostel_allocated',
];
// Fee columns are prefixed `fee_`.
const FEE_FIELDS = [
  'kea_fee', 'regn_fee', 'tuition_fee', 'total_course_fee', 'pending_due',
  'receipt_number', 'payment_status', 'academic_year', 'receipt_date',
];

const toBool = (v) => v === true || v === 1 || v === '1'
  || String(v).trim().toLowerCase() === 'true' || String(v).trim().toLowerCase() === 'yes';

const toDigits = (v, maxDigits) => String(v ?? '').replace(/\D/g, '').slice(0, maxDigits);

// A 10-digit Indian mobile. Spreadsheets hold "+91 98765 43210" and
// "098765 43210"; keeping the first 10 digits of the former yields 9198765432,
// a wrong number that still passes the [6-9]\d{9} check. Drop the prefix.
const toMobile = (v) => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};

// Personal columns that hold digits only, and how each is normalised. A cell may
// arrive as a number or a formatted string, so clean it before the model's
// validators see it — exactly as the Students form does on every keystroke.
const DIGIT_ONLY_PERSONAL = {
  student_mobile: toMobile,
  parent_mobile: toMobile,
  aadhar_no: (v) => toDigits(v, 12),
};

// FR-S6: export filtered students to Excel, one row per student with the
// student's first admission and that admission's first fee record flattened in.
exports.exportStudents = async (req, res) => {
  const where = {};
  if (req.query.course_id) where.course_id = req.query.course_id;
  if (req.query.semester) where.semester = req.query.semester;

  const students = await Student.findAll({
    where,
    include: [
      { model: StudentPersonalDetails },
      { model: Course },
      { model: Admission, include: [{ model: Fee }] },
    ],
    order: [['dsn', 'ASC']],
  });

  const rows = students.map((s) => {
    const p = s.student_personal_detail || {};
    const adm = (s.admissions && s.admissions[0]) || {};
    const fee = (adm.fees && adm.fees[0]) || {};
    return {
      dsn: s.dsn,
      student_name: s.student_name,
      course_id: s.course_id,
      course_name: s.course?.course_name,
      usn: s.usn || '',
      semester: s.semester,
      father_name: p.father_name, mother_name: p.mother_name,
      per_address: p.per_address, temp_address: p.temp_address,
      gender: p.gender, religion: p.religion, category: p.category, caste: p.caste,
      date_of_birth: p.date_of_birth, email_id: p.email_id,
      student_mobile: p.student_mobile, parent_mobile: p.parent_mobile,
      blood_group: p.blood_group, aadhar_no: p.aadhar_no,
      // ----- admission -----
      adm_kea_ad_no: adm.kea_ad_no ?? '',
      adm_academic_year: adm.academic_year ?? '',
      adm_admission_mode: adm.admission_mode ?? '',
      adm_entry_type: adm.adm_id ? (adm.entry_type ?? 'Regular') : '',
      adm_actual_category: adm.actual_category ?? '',
      adm_admitted_category: adm.admitted_category ?? '',
      adm_loan_provider_name: adm.loan_provider_name ?? '',
      adm_available_loan: adm.available_loan ?? '',
      adm_outside_country: adm.adm_id ? (adm.outside_country ? 'Yes' : 'No') : '',
      adm_outside_state: adm.adm_id ? (adm.outside_state ? 'Yes' : 'No') : '',
      adm_hostel_needed: adm.adm_id ? (adm.hostel_needed ? 'Yes' : 'No') : '',
      adm_hostel_allocated: adm.adm_id ? (adm.hostel_allocated ? 'Yes' : 'No') : '',
      // ----- fee -----
      fee_kea_fee: fee.kea_fee ?? '',
      fee_regn_fee: fee.regn_fee ?? '',
      fee_tuition_fee: fee.tuition_fee ?? '',
      fee_total_course_fee: fee.total_course_fee ?? '',
      fee_pending_due: fee.pending_due ?? '',
      fee_receipt_number: fee.receipt_number ?? '',
      fee_payment_status: fee.payment_status ?? '',
      fee_academic_year: fee.academic_year ?? '',
      fee_receipt_date: fee.receipt_date ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="students_export.xlsx"');
  res.send(buf);
};

// Collect the admission fields (adm_*) present on a row; return null if none.
function pickAdmission(row) {
  const data = {};
  let has = false;
  for (const f of ADMISSION_FIELDS) {
    const v = row[`adm_${f}`];
    if (v == null || v === '') continue;
    has = true;
    if (ADMISSION_BOOL_FIELDS.includes(f)) data[f] = toBool(v);
    else if (f === 'available_loan') data[f] = Number(v);
    else data[f] = v;
  }
  return has ? data : null;
}

// Collect the fee fields (fee_*) present on a row; return null if none.
function pickFee(row) {
  const data = {};
  let has = false;
  for (const f of FEE_FIELDS) {
    const v = row[`fee_${f}`];
    if (v == null || v === '') continue;
    has = true;
    data[f] = ['payment_status', 'receipt_number', 'academic_year', 'receipt_date'].includes(f)
      ? v : Number(v);
  }
  return has ? data : null;
}

// Mirror feeController.create: derive pending_due / payment_status / receipt_number.
function finalizeFee(fee) {
  const total = Number(fee.total_course_fee) || 0;
  const paid = (Number(fee.kea_fee) || 0) + (Number(fee.regn_fee) || 0) + (Number(fee.tuition_fee) || 0);
  if (fee.pending_due == null || Number.isNaN(fee.pending_due)) fee.pending_due = Math.max(total - paid, 0);
  if (!fee.payment_status) {
    fee.payment_status = fee.pending_due <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');
  }
  if (!fee.receipt_number) fee.receipt_number = `RC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return fee;
}

// FR-S7/S8: import students (+ optional admission & fee) from CSV/Excel with
// validation + a per-row error report.
exports.importStudents = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const inserted = [];
  const errors = [];

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const rowNo = i + 2; // +1 header, +1 to be 1-based
    try {
      // mandatory field check
      if (!row.student_name || !row.course_id) {
        throw new Error('student_name and course_id are required');
      }
      const usn = row.usn ? String(row.usn).trim() : null;

      // duplicate USN / Aadhar check (USN check only when non-null — FR-S8)
      if (usn) {
        const dupUsn = await Student.findOne({ where: { usn } });
        if (dupUsn) throw new Error(`Duplicate USN ${usn}`);
      }
      if (row.aadhar_no) {
        // Compare the normalised digits — "1234 5678 9012" and "123456789012"
        // are the same Aadhaar, and only the latter is ever stored.
        const aadhaar = DIGIT_ONLY_PERSONAL.aadhar_no(row.aadhar_no);
        const dupAadhar = await StudentPersonalDetails.findOne({ where: { aadhar_no: aadhaar } });
        if (dupAadhar) throw new Error(`Duplicate Aadhar ${row.aadhar_no}`);
      }

      const academic = {}; const personal = {};
      for (const [key, target] of Object.entries(COLUMNS)) {
        if (row[key] == null) continue;
        const normalise = DIGIT_ONLY_PERSONAL[key];
        (target === 's' ? academic : personal)[key] = normalise ? normalise(row[key]) : row[key];
      }
      academic.usn = usn; // normalized (NULL when blank)
      // year-wise dsn: honour a dsn_year column if present, else current year
      const year = row.dsn_year ? Number(row.dsn_year) : new Date().getFullYear();

      const admissionData = pickAdmission(row);
      const feeData = pickFee(row);
      // a fee needs an admission to hang off of (FEE ── ADMISSION)
      if (feeData && !admissionData) {
        throw new Error('Fee columns present but no admission data — add adm_* columns for this row');
      }

      await withDsnRetry(() => sequelize.transaction(async (t) => {
        const dsn = await generateDsn(t, year);
        const student = await Student.create({ ...academic, dsn }, { transaction: t });
        await StudentPersonalDetails.create(
          { ...personal, dsn: student.dsn }, { transaction: t }
        );

        if (admissionData) {
          const admission = await Admission.create(
            { ...admissionData, dsn: student.dsn, course_id: student.course_id },
            { transaction: t }
          );
          if (feeData) {
            await Fee.create(
              { ...finalizeFee(feeData), adm_id: admission.adm_id },
              { transaction: t }
            );
          }
        }
        inserted.push(student.dsn);
      }));
    } catch (err) {
      errors.push({ row: rowNo, reason: err.message, data: row });
    }
  }

  res.json({
    summary: { total: records.length, inserted: inserted.length, rejected: errors.length },
    insertedDsns: inserted,
    errors,
  });
};
