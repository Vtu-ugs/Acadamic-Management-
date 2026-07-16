import { useEffect, useState } from 'react';
import { api } from '../api';
import Pager from '../components/Pager.jsx';
import Modal from '../components/Modal.jsx';
import CustomFields from '../components/CustomFields.jsx';
import { digitsOnly, normalizeMobile } from '../utils/digits.js';
import { CATEGORIES } from '../constants.js';

// Dropdown choices for constrained personal-detail fields
const PERSONAL_OPTIONS = {
  gender: ['Male', 'Female', 'Other'],
  religion: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'],
  category: CATEGORIES,
  blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
};

// Dropdowns whose catch-all choice opens a text box to name the real value. The
// typed value is stored in the column as-is ("Nomadic Tribe", not "Others"), so
// a value that isn't one of the listed options — from an Excel import, say —
// reopens as this catch-all with the text box already filled, rather than
// rendering blank and being wiped on the next save.
const OTHER_SPECIFY = { category: 'Others', religion: 'Other' };

const needsSpecify = (key, value) => Boolean(
  OTHER_SPECIFY[key] && value && !PERSONAL_OPTIONS[key].includes(value)
);

const deriveSpecifyMode = (personal = {}) => Object.fromEntries(
  Object.keys(OTHER_SPECIFY).map((key) => [key, needsSpecify(key, personal[key])])
);

// Year of study — stored in the `semester` column as the representative semester
// (year × 2 − 1), so certificates/reports that derive year from semester stay correct.
const yearToSemester = (y) => (y ? Number(y) * 2 - 1 : null);
const semesterToYear = (s) => (s ? Math.ceil(Number(s) / 2) : '');

// Program duration: MCA / MTech are 2-year PG programs; BE runs 4 years.
const programOf = (courseName = '') => {
  const s = String(courseName).toUpperCase();
  if (s.includes('MCA') || s.includes('M.C.A')) return 'MCA';
  if (s.includes('MTECH') || s.includes('M.TECH') || s.includes('M TECH')) return 'MTech';
  return 'BE';
};
const maxYearFor = (courseName) => (programOf(courseName) === 'BE' ? 4 : 2);
const yearOptions = (maxYear) => Array.from({ length: maxYear }, (_, i) => i + 1)
  .map((y) => ({ value: y, label: `${ordinal(y)} Year` }));

// Personal-detail fields: [key, label, type, required]
const PERSONAL_FIELDS = [
  ['father_name', 'Father Name', 'text', true],
  ['mother_name', 'Mother Name', 'text', true],
  ['gender', 'Gender', 'text', true],
  ['religion', 'Religion', 'text', true],
  ['category', 'Category', 'text', true],
  ['caste', 'Caste', 'text', false],
  ['date_of_birth', 'Date of Birth', 'date', true],
  ['email_id', 'Email', 'email', true],
  ['student_mobile', 'Student Mobile', 'tel', true],
  ['parent_mobile', 'Parent Mobile', 'tel', true],
  ['blood_group', 'Blood Group', 'text', false],
  ['aadhar_no', 'Aadhar No', 'text', true],
];

// `pattern` alone only complains on submit, so these fields are also filtered as
// the user types: special characters never land in the value at all.
const SANITIZERS = {
  student_mobile: normalizeMobile,
  parent_mobile: normalizeMobile,
  aadhar_no: (raw) => digitsOnly(raw, 12),
};

const sanitize = (key, raw) => (SANITIZERS[key] ? SANITIZERS[key](raw) : raw);

// Extra HTML5 validation attributes for phone & Aadhaar fields.
const validationProps = (key) => {
  if (key === 'student_mobile' || key === 'parent_mobile') {
    return { inputMode: 'numeric', pattern: '[6-9][0-9]{9}', maxLength: 10, title: 'Enter a valid 10-digit mobile number (starts with 6-9)' };
  }
  if (key === 'aadhar_no') {
    return { inputMode: 'numeric', pattern: '[0-9]{12}', maxLength: 12, title: 'Enter a valid 12-digit Aadhaar number' };
  }
  return {};
};

// Admission-year choices for the DSN prefix: this calendar year plus the two
// prior and one ahead, newest first. The DSN's year prefix is what scopes a
// student to a dashboard batch, so a Jan–Jun late/lateral admission for the
// running batch can pick the correct year instead of the calendar default.
const CURRENT_YEAR = new Date().getFullYear();
const ADMISSION_YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const emptyForm = {
  first_name: '', last_name: '', course_id: '', usn: '', year: '',
  dsn_year: CURRENT_YEAR,
  custom_fields: {},
  personal: {
    father_name: '', mother_name: '', gender: '', religion: '', category: '', caste: '',
    date_of_birth: '', email_id: '', student_mobile: '', parent_mobile: '',
    blood_group: '', aadhar_no: '', per_address: '', temp_address: '',
  },
};

export default function Students() {
  const PAGE_SIZE = 50;
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [q, setQ] = useState('');
  const [submittedQ, setSubmittedQ] = useState(''); // the query actually applied
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // form object or null
  // Which OTHER_SPECIFY dropdowns are currently showing their text box. Kept
  // outside `editing` because it is UI state, not part of the saved record.
  const [specifyMode, setSpecifyMode] = useState({});
  const [usnModal, setUsnModal] = useState(null);

  // With a search term we hit /students/search (capped list, no paging); without
  // one we hit the paginated /students so the full roster never loads at once.
  const load = () => {
    setError(null);
    if (submittedQ) {
      api.get(`/students/search?q=${encodeURIComponent(submittedQ)}`)
        .then((d) => { setStudents(d); setTotal(d.length); })
        .catch((e) => setError(e.message));
    } else {
      api.get(`/students?page=${page}&pageSize=${PAGE_SIZE}`)
        .then((d) => { setStudents(d.rows || []); setTotal(d.total || 0); })
        .catch((e) => setError(e.message));
    }
  };

  const doSearch = () => { setSubmittedQ(q.trim()); setPage(1); };
  const clearSearch = () => { setQ(''); setSubmittedQ(''); setPage(1); };

  useEffect(() => { api.get('/courses').then(setCourses).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [submittedQ, page]);

  const courseName = (id) => courses.find((c) => c.course_id === id)?.course_name || id;

  const openNew = () => {
    setSpecifyMode({});
    setEditing(JSON.parse(JSON.stringify(emptyForm)));
  };
  const openEdit = async (dsn) => {
    const s = await api.get(`/students/${dsn}`);
    const parts = (s.student_name || '').trim().split(/\s+/);
    const personal = s.student_personal_detail || { ...emptyForm.personal };
    setSpecifyMode(deriveSpecifyMode(personal));
    setEditing({
      dsn: s.dsn,
      first_name: parts.shift() || '',
      last_name: parts.join(' '),
      course_id: s.course_id,
      usn: s.usn || '', year: semesterToYear(s.semester),
      custom_fields: s.custom_fields || {},
      personal,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        dsn: editing.dsn,
        student_name: `${editing.first_name || ''} ${editing.last_name || ''}`.trim(),
        course_id: Number(editing.course_id),
        usn: editing.usn,
        semester: yearToSemester(editing.year),
        custom_fields: editing.custom_fields,
        personal: editing.personal,
      };
      if (editing.dsn) {
        await api.put(`/students/${editing.dsn}`, payload);
      } else {
        // dsn_year only matters at creation — it sets the immutable DSN prefix.
        await api.post('/students', { ...payload, dsn_year: Number(editing.dsn_year) || CURRENT_YEAR });
      }
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const saveUsn = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/students/${usnModal.dsn}/usn`, { usn: usnModal.usn });
      setUsnModal(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (dsn) => {
    if (!confirm(`Delete student DSN ${dsn}? This removes their personal/admission/fee records.`)) return;
    await api.del(`/students/${dsn}`);
    load();
  };

  return (
    <div>
      <h2 className="page-title">Students</h2>
      <p className="page-sub">Centralized record across all courses (FR-S1 to FR-S8)</p>

      <div className="toolbar">
        <div className="field" style={{ flex: 1 }}>
          <label>Quick search (USN, name, mobile, DSN)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="Type and press Enter…" />
        </div>
        <button onClick={doSearch}>Search</button>
        <button className="secondary" onClick={clearSearch}>Clear</button>
        <button onClick={openNew}>+ New Student</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>DSN</th><th>USN</th><th>Name</th><th>Course</th><th>Year</th><th>Mobile</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.dsn}>
                <td>{s.dsn}</td>
                <td>{s.usn || <span className="pill-pending">pending</span>}</td>
                <td>{s.student_name}</td>
                <td>{courseName(s.course_id)}</td>
                <td>{s.semester ? `${ordinal(semesterToYear(s.semester))} Year` : '-'}</td>
                <td>{s.student_personal_detail?.student_mobile || '-'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => openEdit(s.dsn)}>Edit</button>
                  {!s.usn && <button className="link" onClick={() => setUsnModal({ dsn: s.dsn, usn: '' })}>Set USN</button>}
                  <button className="link" onClick={() => remove(s.dsn)}>Delete</button>
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan="7" className="muted">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {!submittedQ && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}

      {editing && (
        <Modal title={editing.dsn ? `Edit Student (DSN ${editing.dsn})` : 'New Student'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <h4>Academic</h4>
            <div className="form-grid">
              <Field label="First Name *">
                <input required value={editing.first_name}
                  onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
              </Field>
              <Field label="Last Name *">
                <input required value={editing.last_name}
                  onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
              </Field>
              <Field label="Course *">
                <select required value={editing.course_id}
                  onChange={(e) => {
                    const course_id = e.target.value;
                    const max = maxYearFor(courseName(Number(course_id)));
                    // Clear a now-out-of-range year (e.g. Year 3/4 when switching to MCA/MTech).
                    const year = editing.year && Number(editing.year) > max ? '' : editing.year;
                    setEditing({ ...editing, course_id, year });
                  }}>
                  <option value="">— select —</option>
                  {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
                </select>
              </Field>
              <Field label="USN (blank if not yet allotted)">
                <input value={editing.usn} onChange={(e) => setEditing({ ...editing, usn: e.target.value })} />
              </Field>
              {/* DSN prefix is fixed once created, so only offer the year for new students. */}
              {!editing.dsn && (
                <Field label="Admission Year *">
                  <select required value={editing.dsn_year}
                    onChange={(e) => setEditing({ ...editing, dsn_year: e.target.value })}>
                    {ADMISSION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Year *">
                <select required value={editing.year}
                  onChange={(e) => setEditing({ ...editing, year: e.target.value })}>
                  <option value="">— select —</option>
                  {yearOptions(maxYearFor(courseName(Number(editing.course_id)))).map((y) => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <h4>Personal Details</h4>
            <div className="form-grid">
              {PERSONAL_FIELDS.map(([key, label, type, required]) => (
                <Field key={key} label={`${label}${required ? ' *' : ''}`}>
                  {PERSONAL_OPTIONS[key] ? (
                    <>
                      <select required={required}
                        // In specify mode the column holds the typed value, which is
                        // not an option — pin the dropdown to its catch-all choice.
                        value={specifyMode[key] ? OTHER_SPECIFY[key] : (editing.personal[key] || '')}
                        onChange={(e) => {
                          const picked = e.target.value;
                          const isCatchAll = picked === OTHER_SPECIFY[key];
                          setSpecifyMode({ ...specifyMode, [key]: isCatchAll });
                          setEditing({
                            ...editing,
                            // Clear the value so the text box starts empty and `required`
                            // forces the user to actually name the category.
                            personal: { ...editing.personal, [key]: isCatchAll ? '' : picked },
                          });
                        }}>
                        <option value="">— select —</option>
                        {PERSONAL_OPTIONS[key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {specifyMode[key] && (
                        <input required placeholder={`Specify ${label.toLowerCase()}`}
                          style={{ marginTop: 6 }} value={editing.personal[key] || ''}
                          onChange={(e) => setEditing({
                            ...editing,
                            personal: { ...editing.personal, [key]: e.target.value },
                          })} />
                      )}
                    </>
                  ) : (
                    <input type={type || 'text'} required={required} {...validationProps(key)}
                      value={editing.personal[key] || ''}
                      onChange={(e) => setEditing({
                        ...editing,
                        personal: { ...editing.personal, [key]: sanitize(key, e.target.value) },
                      })} />
                  )}
                </Field>
              ))}
            </div>
            <div className="form-grid">
              {[
                ['per_address', 'Permanent Address'],
                ['temp_address', 'Temporary Address'],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <textarea rows="2" value={editing.personal[key] || ''}
                    onChange={(e) => setEditing({ ...editing, personal: { ...editing.personal, [key]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <div className="form-grid">
              <CustomFields entity="student" values={editing.custom_fields}
                onChange={(cf) => setEditing({ ...editing, custom_fields: cf })} />
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {usnModal && (
        <Modal title={`Allot USN — DSN ${usnModal.dsn}`} onClose={() => setUsnModal(null)}>
          <form onSubmit={saveUsn}>
            <Field label="University Seat Number (USN)">
              <input required value={usnModal.usn} autoFocus
                onChange={(e) => setUsnModal({ ...usnModal, usn: e.target.value })} />
            </Field>
            <p className="muted">Uniqueness is validated; only non-null USNs must be unique.</p>
            <button type="submit">Save USN</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

// 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th …
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
