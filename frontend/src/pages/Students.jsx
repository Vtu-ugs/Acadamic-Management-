import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

// Dropdown choices for constrained personal-detail fields
const PERSONAL_OPTIONS = {
  gender: ['Male', 'Female', 'Other'],
  religion: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'],
  blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
};

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

const emptyForm = {
  first_name: '', last_name: '', course_id: '', usn: '', year: '',
  personal: {
    father_name: '', mother_name: '', gender: '', religion: '', category: '', caste: '',
    date_of_birth: '', email_id: '', student_mobile: '', parent_mobile: '',
    blood_group: '', aadhar_no: '', per_address: '', temp_address: '',
  },
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // form object or null
  const [usnModal, setUsnModal] = useState(null);

  const load = () => {
    const path = q.trim() ? `/students/search?q=${encodeURIComponent(q.trim())}` : '/students';
    api.get(path).then(setStudents).catch((e) => setError(e.message));
  };

  useEffect(() => { api.get('/courses').then(setCourses).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const courseName = (id) => courses.find((c) => c.course_id === id)?.course_name || id;

  const openNew = () => setEditing(JSON.parse(JSON.stringify(emptyForm)));
  const openEdit = async (csn) => {
    const s = await api.get(`/students/${csn}`);
    const parts = (s.student_name || '').trim().split(/\s+/);
    setEditing({
      csn: s.csn,
      first_name: parts.shift() || '',
      last_name: parts.join(' '),
      course_id: s.course_id,
      usn: s.usn || '', year: semesterToYear(s.semester),
      personal: s.student_personal_detail || { ...emptyForm.personal },
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        csn: editing.csn,
        student_name: `${editing.first_name || ''} ${editing.last_name || ''}`.trim(),
        course_id: Number(editing.course_id),
        usn: editing.usn,
        semester: yearToSemester(editing.year),
        personal: editing.personal,
      };
      if (editing.csn) await api.put(`/students/${editing.csn}`, payload);
      else await api.post('/students', payload);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const saveUsn = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/students/${usnModal.csn}/usn`, { usn: usnModal.usn });
      setUsnModal(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (csn) => {
    if (!confirm(`Delete student CSN ${csn}? This removes their personal/admission/fee records.`)) return;
    await api.del(`/students/${csn}`);
    load();
  };

  return (
    <div>
      <h2 className="page-title">Students</h2>
      <p className="page-sub">Centralized record across all courses (FR-S1 to FR-S8)</p>

      <div className="toolbar">
        <div className="field" style={{ flex: 1 }}>
          <label>Quick search (USN, name, mobile, CSN)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Type and press Enter…" />
        </div>
        <button onClick={load}>Search</button>
        <button className="secondary" onClick={() => { setQ(''); api.get('/students').then(setStudents); }}>Clear</button>
        <button onClick={openNew}>+ New Student</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>CSN</th><th>USN</th><th>Name</th><th>Course</th><th>Year</th><th>Mobile</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.csn}>
                <td>{s.csn}</td>
                <td>{s.usn || <span className="pill-pending">pending</span>}</td>
                <td>{s.student_name}</td>
                <td>{courseName(s.course_id)}</td>
                <td>{s.semester ? `${ordinal(semesterToYear(s.semester))} Year` : '-'}</td>
                <td>{s.student_personal_detail?.student_mobile || '-'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => openEdit(s.csn)}>Edit</button>
                  {!s.usn && <button className="link" onClick={() => setUsnModal({ csn: s.csn, usn: '' })}>Set USN</button>}
                  <button className="link" onClick={() => remove(s.csn)}>Delete</button>
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan="7" className="muted">No students found.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.csn ? `Edit Student (CSN ${editing.csn})` : 'New Student'} onClose={() => setEditing(null)}>
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
                    <select required={required} value={editing.personal[key] || ''}
                      onChange={(e) => setEditing({ ...editing, personal: { ...editing.personal, [key]: e.target.value } })}>
                      <option value="">— select —</option>
                      {PERSONAL_OPTIONS[key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={type || 'text'} required={required} {...validationProps(key)}
                      value={editing.personal[key] || ''}
                      onChange={(e) => setEditing({ ...editing, personal: { ...editing.personal, [key]: e.target.value } })} />
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
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {usnModal && (
        <Modal title={`Allot USN — CSN ${usnModal.csn}`} onClose={() => setUsnModal(null)}>
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
