const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const {
  Certificate, Admission, Student, StudentPersonalDetails, Course, FeeStructure, Staff,
} = require('../models');
const { isPaged, parsePagination, UNPAGED_MAX } = require('../utils/paginate');

// Ordinal year of study derived from the current semester (1-2 -> 1st, …).
const yearOfStudy = (semester) => {
  const n = Math.max(1, Math.ceil((Number(semester) || 1) / 2));
  return `${ordinal(n)} Year`;
};

// 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th …
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// Strip the degree prefix ("B.E. - ", "M.C.A." …) to get the discipline/dept name.
const discipline = (courseName) => (courseName || '')
  .replace(/^\s*(B\.?E\.?|B\.?Tech\.?|M\.?C\.?A\.?|M\.?Tech\.?|M\.?E\.?)\s*[-–:]?\s*/i, '')
  .trim() || (courseName || '');

// Department code for the certificate Ref No, derived from the discipline as an
// acronym of its significant words (e.g. "Computer Science & Engineering" -> CSE,
// "Master of Computer Application" -> MCA). Falls back to "PG" when it can't.
const STOP_WORDS = new Set(['and', 'of', 'the', 'in', 'for', 'with', '&']);
const deptCode = (disciplineName) => {
  const code = String(disciplineName || '')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');
  return code || 'PG';
};

// Map a course name to a fee_structure.program bucket (BE / MCA / MTech).
const programOf = (courseName = '') => {
  const s = String(courseName).toUpperCase();
  if (s.includes('MCA') || s.includes('M.C.A')) return 'MCA';
  if (s.includes('MTECH') || s.includes('M.TECH') || s.includes('M TECH')) return 'MTech';
  return 'BE'; // B.E. / B.Tech
};

const isFemale = (gender) => /^f/i.test(String(gender || ''));
const salutation = (gender) => (isFemale(gender) ? 'Miss.' : 'Mr.');
const subjectPronoun = (gender) => (isFemale(gender) ? 'She' : 'He');

// Date as dd.mm.yyyy (matches the printed TC format). Passes non-dates through.
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
};

// Indian-grouped currency, e.g. 23590 -> "Rs.23,590.00"
const inr = (v) => `Rs.${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Amount in words, Indian numbering (crore/lakh/thousand).
const amountInWords = (num) => {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : ''));
  const three = (n) => {
    const h = Math.floor(n / 100); const r = n % 100;
    return (h ? `${ones[h]} Hundred${r ? ' ' : ''}` : '') + (r ? two(r) : '');
  };
  let words = '';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) words += `${two(crore)} Crore `;
  if (lakh) words += `${two(lakh)} Lakh `;
  if (thousand) words += `${two(thousand)} Thousand `;
  if (num) words += three(num);
  return words.trim();
};

// The Chairperson / Head of Department, drawn from the staff master.
// Prefers the HOD of the student's own course; falls back to any HOD.
const findChairperson = async (courseId) => {
  const where = {
    [Op.or]: [
      { designation: { [Op.like]: '%HOD%' } },
      { designation: { [Op.like]: '%Head%' } },
      { designation: { [Op.like]: '%Chairperson%' } },
    ],
  };
  const hod = (courseId && await Staff.findOne({ where: { ...where, course_id: courseId } }))
    || await Staff.findOne({ where });
  return hod?.staff_name || 'Prof. S. A. Angadi';
};

exports.list = async (req, res) => {
  const where = {};
  if (req.query.adm_id) where.adm_id = req.query.adm_id;
  const include = [{ model: Admission, include: [{ model: Student }, { model: Course }] }];

  // Opt-in pagination (see utils/paginate); plain array otherwise.
  if (isPaged(req.query)) {
    const { page, pageSize, limit, offset } = parsePagination(req.query);
    const { rows, count } = await Certificate.findAndCountAll({
      where, include, order: [['cert_id', 'DESC']], limit, offset, distinct: true,
    });
    return res.json({ rows, total: count, page, pageSize });
  }

  const certs = await Certificate.findAll({
    where, include, order: [['cert_id', 'DESC']], limit: UNPAGED_MAX, // safety cap
  });
  res.json(certs);
};

// FR-C3: capture cert_type, issue_date, issued_by, remarks (+ TC staff fields)
exports.create = async (req, res) => {
  const body = { ...req.body };
  if (!body.issue_date) body.issue_date = new Date().toISOString().slice(0, 10);
  // The staff-entered TC fields arrive as an object; persist them as JSON text.
  if (body.tc_details && typeof body.tc_details === 'object') {
    body.tc_details = JSON.stringify(body.tc_details);
  }
  const cert = await Certificate.create(body);
  res.status(201).json(cert);
};

exports.remove = async (req, res) => {
  const deleted = await Certificate.destroy({ where: { cert_id: req.params.id } });
  if (!deleted) return res.status(404).json({ error: 'Certificate not found' });
  res.status(204).end();
};

// FR-C2/C4: render the certificate as a printable PDF with auto-filled data
exports.generatePdf = async (req, res) => {
  const cert = await Certificate.findByPk(req.params.id, {
    include: [{
      model: Admission,
      include: [
        { model: Course },
        { model: Student, include: [{ model: StudentPersonalDetails }] },
      ],
    }],
  });
  if (!cert) return res.status(404).json({ error: 'Certificate not found' });

  const student = cert.admission?.student;
  const personal = student?.student_personal_detail || {};
  const course = cert.admission?.course;
  const dept = discipline(course?.course_name);
  const acadYear = cert.admission?.academic_year || '';
  const chairperson = await findChairperson(course?.course_id);

  const TITLES = {
    Bonafide: 'BONAFIDE CERTIFICATE',
    TC: 'TRANSFER CERTIFICATE',
    'Probable Expenditure': 'PROBABLE EXPENDITURE CERTIFICATE',
  };
  const title = TITLES[cert.cert_type] || `${(cert.cert_type || '').toUpperCase()} CERTIFICATE`;
  const purpose = cert.remarks || 'Educational Loan';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${cert.cert_type}-${cert.cert_id}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  const L = 50; const R = doc.page.width - 50; // content left/right edges

  // ---------- VTU letterhead ----------
  doc.font('Helvetica-Bold').fontSize(22).text('Visvesvaraya Technological University', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9)
    .text('(State University of Government of Karnataka Established as per the VTU Act, 1994)', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(11).text('"Jnana Sangama" Belagavi-590018, Karnataka, India', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(13).text(`Dept of ${dept}`, { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).text(chairperson, L, doc.y);
  doc.text('Chairperson', L, doc.y);
  doc.moveDown(0.3);
  doc.moveTo(L, doc.y).lineTo(R, doc.y).lineWidth(1).stroke();
  doc.moveDown(0.6);

  // ---------- Ref No + Date ----------
  const refY = doc.y;
  doc.font('Helvetica').fontSize(10)
    .text(`Ref No: VTU/BGM/${deptCode(dept)}/PG/${acadYear || new Date().getFullYear()}/`, L, refY);
  doc.font('Helvetica-Bold').fontSize(11).text(`DATE: ${cert.issue_date}`, L, refY, { width: R - L, align: 'right' });
  doc.moveDown(1.5);

  // ---------- Title ----------
  doc.font('Helvetica-Bold').fontSize(14).text(title, { align: 'center' });
  doc.moveDown(1.5);

  if (cert.cert_type === 'Probable Expenditure') {
    await renderProbableExpenditure(doc, {
      L, R, student, personal, course, dept, acadYear, cert, purpose,
    });
  } else if (cert.cert_type === 'Bonafide' || !TITLES[cert.cert_type]) {
    const rows = [
      ['Name of the Student', student?.student_name],
      ['USN', student?.usn || '(USN pending)'],
      ['Father Name', personal.father_name],
      ['Mother Name', personal.mother_name],
      ['Studying in Course', course?.course_name],
      ['Year of Study', yearOfStudy(student?.semester)],
      ['Subjects Combination/Discipline', dept],
      ['Type of Seat Allotted', cert.admission?.admitted_category || cert.admission?.actual_category],
    ];
    doc.font('Helvetica').fontSize(11).text(
      `This is to certify that the following details pertaining to the student of Department of ${dept} ` +
      `VTU Belagavi ${acadYear} is /are true. This certificate is issued on the request of the student ` +
      `for the purpose of ${purpose}.`,
      L, doc.y, { align: 'justify', lineGap: 4, width: R - L }
    );
    doc.moveDown(1.5);
    const labelX = L + 10; const colonX = 285; const valueX = 300;
    let y = doc.y;
    rows.forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(11).text(label, labelX, y, { width: colonX - labelX - 5 });
      doc.text(':', colonX, y);
      doc.font('Helvetica-Bold').fontSize(11).text(value != null && value !== '' ? String(value) : '-',
        valueX, y, { width: R - valueX });
      y += 30;
    });
    doc.y = y;
  } else {
    // TC — structured a–n row format (a–g auto-fetched, h–n staff-entered)
    renderTransferCertificate(doc, {
      L, R, student, personal, course, dept, cert,
    });
  }

  // ---------- Signature ----------
  doc.moveDown(4);
  doc.font('Helvetica-Bold').fontSize(11).text('CHAIRPERSON', L, doc.y, { width: R - L, align: 'right' });

  doc.end();
};

// Draws the Probable Expenditure body + fee table (fees fetched from fee_structure).
async function renderProbableExpenditure(doc, ctx) {
  const {
    L, R, student, personal, course, dept, acadYear, cert, purpose,
  } = ctx;

  // Fee slabs for this student's program + batch + entry type, all years.
  const program = programOf(course?.course_name);
  const entryType = cert.admission?.entry_type || 'Regular';
  let feeRows = await FeeStructure.findAll({
    where: { batch_year: acadYear, program, entry_type: entryType },
    order: [['program_year', 'ASC']],
  });
  if (!feeRows.length) {
    feeRows = await FeeStructure.findAll({
      where: { batch_year: acadYear, program },
      order: [['program_year', 'ASC']],
    });
  }

  const sal = salutation(personal.gender);
  const she = subjectPronoun(personal.gender);
  const mode = cert.admission?.admission_mode || 'KEA';
  const years = feeRows.map((r) => r.program_year);
  const firstYear = years[0] || 1;
  const laterYears = years.filter((y) => y > firstYear);
  // Join later years as "2nd Year, 3rd Year and 4th Year"
  const laterList = (() => {
    const items = laterYears.map((y) => `${ordinal(y)} Year`);
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  })();

  // ---------- Intro paragraph ----------
  doc.font('Helvetica').fontSize(11).text(
    `This is to Certify that ${sal}${student?.student_name} USN: ${student?.usn || '(USN pending)'} , has taken `
    + `admission to ${course?.course_name} during the Academic Year ${acadYear} at Department of ${dept}, `
    + `VTU PG Center, Belagavi admitted through ${mode} and ${she} has paid ${ordinal(firstYear)} Year fees at ${mode}. `
    + (laterList
      ? `Probable Expenditure for ${laterList} for the said Student payable to VTU, Belagavi is as shown below :`
      : `Probable Expenditure for the said Student payable to VTU, Belagavi is as shown below :`),
    L, doc.y, { align: 'justify', lineGap: 4, width: R - L }
  );
  doc.moveDown(1.2);

  if (!feeRows.length) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('red')
      .text(`No fee structure found for ${program} / ${acadYear}. Please add it under Fee Structure.`,
        L, doc.y, { width: R - L });
    doc.fillColor('black');
    return;
  }

  // ---------- Fee table ----------
  const tuition = feeRows.map((r) => Number(r.tuition_fee) || 0);
  const university = feeRows.map((r) => (Number(r.regn_fee) || 0) + (Number(r.college_fee) || 0));
  const totals = feeRows.map((r) => Number(r.total_fee) || (tuition + university));
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const grand = sum(totals);

  const wNo = 26; const wPart = 92;
  const nCols = years.length + 1; // year columns + Total
  const wCol = (R - (L + wNo + wPart)) / nCols;
  const x0 = L; const x1 = L + wNo; const x2 = x1 + wPart;
  const colX = (i) => x2 + i * wCol; // i in [0..nCols]

  const cell = (x, y, w, h, text, { bold, align = 'center', size = 9 } = {}) => {
    doc.rect(x, y, w, h).lineWidth(0.7).stroke();
    if (text == null || text === '') return;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    doc.text(String(text), x + 2, y + (h - size) / 2 - 1, { width: w - 4, align });
  };

  let y = doc.y;
  const hHdr1 = 18; const hHdr2 = 18; const hRow = 22;

  // Header row 1: No. | Particulars (both span 2) | merged "Probable Expenditure for (Payable to VTU, Belagavi)"
  cell(x0, y, wNo, hHdr1 + hHdr2, 'No.', { bold: true });
  cell(x1, y, wPart, hHdr1 + hHdr2, 'Particulars', { bold: true });
  cell(x2, y, wCol * nCols, hHdr1, 'Probable Expenditure for (Payable to VTU, Belagavi)', { bold: true, size: 8 });
  // Header row 2: year labels + Total
  years.forEach((yr, i) => cell(colX(i), y + hHdr1, wCol, hHdr2, `${ordinal(yr)} Year`, { bold: true, size: 8 }));
  cell(colX(years.length), y + hHdr1, wCol, hHdr2, 'Total', { bold: true, size: 8 });
  y += hHdr1 + hHdr2;

  // Data rows
  const dataRow = (no, label, vals, total, { bold } = {}) => {
    cell(x0, y, wNo, hRow, no, {});
    cell(x1, y, wPart, hRow, label, { align: 'left' });
    vals.forEach((v, i) => cell(colX(i), y, wCol, hRow, inr(v), { bold, size: 8 }));
    cell(colX(vals.length), y, wCol, hRow, inr(total), { bold, size: 8 });
    y += hRow;
  };
  dataRow('01', 'Tuition Fees', tuition, sum(tuition));
  dataRow('02', 'University Fees', university, sum(university));
  // Total row (No. + Particulars merged)
  cell(x0, y, wNo + wPart, hRow, 'Total', { bold: true });
  totals.forEach((v, i) => cell(colX(i), y, wCol, hRow, inr(v), { bold: true, size: 8 }));
  cell(colX(totals.length), y, wCol, hRow, inr(grand), { bold: true, size: 8 });
  y += hRow;

  doc.y = y + 12;

  // ---------- Amount in words + issuance basis ----------
  doc.font('Helvetica-Bold').fontSize(11)
    .text(`(Rupees: ${amountInWords(grand)} Rupees only)`, L, doc.y, { width: R - L });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(11).text(
    `This Certificate is issued based on the request letter by Student for applying ${purpose}.`,
    L, doc.y, { align: 'justify', lineGap: 4, width: R - L }
  );
}

// Renders the Transfer Certificate body — the a–n rows. Rows a–g are always
// auto-fetched from the student/admission record; rows h–n (plus T.C. No.,
// Serial No. and the admission/leaving dates) come from the staff-entered
// tc_details JSON, with a blank underline shown when a field was left empty.
function renderTransferCertificate(doc, ctx) {
  const {
    L, R, student, personal, course, dept, cert,
  } = ctx;

  let td;
  try { td = cert.tc_details ? JSON.parse(cert.tc_details) : {}; } catch { td = {}; }

  // Placeholder shown for a staff field that was left blank.
  const ph = (v) => (v != null && String(v).trim() !== '' ? String(v) : '__________');

  const sem = Number(student?.semester) || null;
  const leavingClass = `${sem ? `${ordinal(sem)} Sem ` : ''}${course?.course_name || dept}`.trim();
  const nationality = td.nationality || 'Indian';

  // Auto-filled dates: admission date from the admission record; date of
  // leaving = the date this TC is issued. Both fall back to any staff-entered
  // value, then to a blank underline.
  const dateOfAdmission = fmtDate(cert.admission?.admission_date) || fmtDate(td.date_of_admission);
  const dateOfLeaving = fmtDate(cert.issue_date) || fmtDate(td.date_of_leaving);

  // ---------- Admission Reg. Serial No. (left) + T.C. No. (right) ----------
  const topY = doc.y;
  doc.font('Helvetica').fontSize(10).text(`Admission Reg. Serial No.: ${ph(td.serial_no)}`, L, topY);
  doc.font('Helvetica').fontSize(10)
    .text(`T.C. No.: ${ph(td.tc_no)}`, L, topY, { width: R - L, align: 'right' });
  doc.moveDown(1.2);

  // [letter, label, value]  — value may be a string or an array of lines.
  const rows = [
    ['a.', 'Name of the Student (In Block Letter)', (student?.student_name || '').toUpperCase() || '-'],
    ['b.', 'University Seat Number', student?.usn || '(USN pending)'],
    ['c.', 'Name of Father', personal.father_name || '-'],
    ['d.', 'Caste / Religion / Nationality / Sex', [
      `Caste: ${personal.category || '-'}    Sub Caste: ${personal.caste || '-'}    Religion: ${personal.religion || '-'}`,
      `Nationality: ${nationality}        Sex: ${personal.gender || '-'}`,
    ]],
    ['e.', 'Date of Birth (as in Admission Reg.)', fmtDate(personal.date_of_birth) || '-'],
    ['f.', 'Date of Admission / leaving the College', [
      `1) Date of Admission: ${ph(dateOfAdmission)}`,
      `2) Date of leaving the College: ${ph(dateOfLeaving)}`,
    ]],
    ['g.', 'Class and discipline from which leaves', leavingClass || '-'],
    ['h.', 'Class and discipline Secured', ph(td.class_secured)],
    ['i.', 'Promotion to next higher classes', ph(td.promotion_next)],
    ['j.', 'All dues paid & books returned', ph(td.dues_cleared)],
    ['k.', 'Completion Year of Degree', ph(td.completion_year)],
    ['l.', 'Reasons for leaving', ph(td.reason_leaving)],
    ['m.', 'Promotion to higher class?', ph(td.promotion_higher)],
    ['n.', 'Character and Conduct', ph(td.conduct)],
  ];

  const letterX = L;
  const labelX = L + 22;
  const valueX = 310;
  const labelW = valueX - labelX - 8;
  const valueW = R - valueX;

  rows.forEach(([letter, label, value]) => {
    const y0 = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).text(letter, letterX, y0, { width: 20 });
    doc.font('Helvetica').fontSize(10).text(label, labelX, y0, { width: labelW });
    const labelH = doc.heightOfString(label, { width: labelW });

    doc.font('Helvetica-Bold').fontSize(10);
    const vLines = Array.isArray(value) ? value : [value];
    let vy = y0;
    let valueH = 0;
    vLines.forEach((ln) => {
      doc.text(String(ln), valueX, vy, { width: valueW });
      const h = doc.heightOfString(String(ln), { width: valueW });
      vy += h; valueH += h;
    });

    doc.y = y0 + Math.max(labelH, valueH) + 8;
  });

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(10).text(`Date: ${cert.issue_date}`, L, doc.y);
}
