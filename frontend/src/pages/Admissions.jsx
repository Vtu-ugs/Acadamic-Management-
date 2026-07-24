import { useState } from 'react';
import { api } from '../api';
import { useApi, usePagedApi } from '../components/useApi.js';
import Pager from '../components/Pager.jsx';
import { searchStudentOptions } from '../components/CrudPage.jsx';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import CustomFields from '../components/CustomFields.jsx';
import { CATEGORIES } from '../constants.js';

const ENTRY_TYPES = ['Regular', 'Lateral'];

// The batch follows the DSN's year prefix: DSN 2026xxxx -> batch "2026-27".
const batchYearFromDsn = (dsn) => {
  const year = Math.floor(Number(dsn) / 10000);
  if (!Number.isFinite(year) || year < 2000 || year > 2999) return '';
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
};

// Hostel status at a glance — "Awaiting" is the row staff need to act on.
const hostelStatus = (r) => {
  if (!r.hostel_needed) return '-';
  return r.hostel_allocated ? 'Allocated' : 'Awaiting';
};

const blank = {
  adm_id: null, dsn: '', student_label: '', course_id: '', kea_ad_no: '', academic_year: '', admission_date: '',
  admission_mode: '', entry_type: 'Regular', actual_category: '', admitted_category: '',
  loan_provider_name: '', available_loan: '', outside_country: false, outside_state: false,
  hostel_needed: false, hostel_allocated: false, custom_fields: {},
};

// 5.3 ADMISSION (FR-S5, FR-F8)
export default function Admissions() {
  const {
    rows: data, total, page, pageSize, setPage, loading, error, reload,
  } = usePagedApi('/admissions');
  const { data: courses } = useApi('/courses');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);

  const courseName = (id) => (courses || []).find((c) => c.course_id === id)?.course_name || id;

  // When a student is chosen from the server-side search, pull their course and
  // actual category from the picked record so staff don't re-enter them.
  const pickStudent = (dsn, opt) => {
    const s = opt?.data;
    setForm((f) => ({
      ...f,
      dsn,
      student_label: opt?.label || f.student_label || '',
      course_id: f.course_id || s?.course_id || '',
      actual_category: s?.student_personal_detail?.category || f.actual_category || '',
      // Derive the batch from the DSN year prefix when not already set.
      academic_year: f.academic_year || batchYearFromDsn(dsn),
    }));
  };

  const openEdit = (row) => {
    setFormError(null);
    setForm({
      adm_id: row.adm_id, dsn: row.dsn,
      student_label: row.student ? `DSN ${row.dsn} · USN ${row.student.usn || 'pending'} · ${row.student.student_name || ''}` : `DSN ${row.dsn}`,
      course_id: row.course_id, kea_ad_no: row.kea_ad_no || '',
      academic_year: row.academic_year || '', admission_date: row.admission_date || '',
      admission_mode: row.admission_mode || '',
      entry_type: row.entry_type || 'Regular', actual_category: row.actual_category || '',
      admitted_category: row.admitted_category || '', loan_provider_name: row.loan_provider_name || '',
      available_loan: row.available_loan ?? '', outside_country: !!row.outside_country,
      outside_state: !!row.outside_state, hostel_needed: !!row.hostel_needed,
      hostel_allocated: !!row.hostel_allocated, custom_fields: row.custom_fields || {},
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form,
      dsn: Number(form.dsn),
      course_id: Number(form.course_id),
      available_loan: form.available_loan === '' ? null : Number(form.available_loan),
      admission_date: form.admission_date || null,
    };
    delete payload.adm_id;
    delete payload.student_label; // UI-only field, not an Admission column
    try {
      if (form.adm_id) await api.put(`/admissions/${form.adm_id}`, payload);
      else await api.post('/admissions', payload);
      setForm(null);
      reload();
    } catch (err) { setFormError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm(`Delete admission ${id}?`)) return;
    try { await api.del(`/admissions/${id}`); reload(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2 className="page-title">Admissions</h2>
      <p className="page-sub">Admission events linking a student (dsn) to a course/year (FR-S5)</p>

      <div className="toolbar">
        <button onClick={() => { setFormError(null); setForm({ ...blank }); }}>+ New Admission</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>Sl. No</th><th>DSN</th><th>Student</th><th>Course</th><th>Year</th>
                <th>Mode</th><th>Entry</th><th>Category</th><th>Loan</th><th>Hostel</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r, i) => (
                <tr key={r.adm_id}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td>{r.dsn}</td>
                  <td>{r.student?.student_name}</td>
                  <td>{r.course?.course_name || courseName(r.course_id)}</td>
                  <td>{r.academic_year}</td>
                  <td>{r.admission_mode}</td>
                  <td>{r.entry_type}</td>
                  <td>{r.admitted_category || r.actual_category || '-'}</td>
                  <td>{r.available_loan}</td>
                  <td>{hostelStatus(r)}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => openEdit(r)}>Edit</button>
                    <button className="link" onClick={() => remove(r.adm_id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="11" className="muted">No admissions.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} />

      {form && (
        <Modal title={form.adm_id ? `Edit Admission (${form.adm_id})` : 'New Admissions'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Student (DSN) *</label>
                <SearchSelect required asyncSearch={searchStudentOptions} value={form.dsn}
                  valueLabel={form.student_label}
                  onChange={pickStudent} placeholder="Search by DSN, USN or name…" />
              </div>
              <div className="field">
                <label>Course *</label>
                <select required value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
                  <option value="">— select —</option>
                  {(courses || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
                </select>
              </div>
              <div className="field"><label>KEA Admission No</label>
                <input value={form.kea_ad_no} onChange={(e) => setForm({ ...form, kea_ad_no: e.target.value })} /></div>

              <div className="field"><label>Batch / Academic Year (auto from DSN)</label>
                <input value={form.academic_year} placeholder="auto-filled from DSN, e.g. 2026-27"
                  onChange={(e) => setForm({ ...form, academic_year: e.target.value })} /></div>
              <div className="field"><label>Date of Admission</label>
                <input type="date" value={form.admission_date}
                  onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
              <div className="field"><label>Admission Mode (CET/Management/NRI)</label>
                <input value={form.admission_mode} onChange={(e) => setForm({ ...form, admission_mode: e.target.value })} /></div>
              <div className="field"><label>Entry Type *</label>
                <select required value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                  {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>

              <div className="field"><label>Actual Category <span className="muted">(from student)</span></label>
                <input value={form.actual_category}
                  onChange={(e) => setForm({ ...form, actual_category: e.target.value })} /></div>
              <div className="field"><label>Admitted Category</label>
                <select value={form.admitted_category} onChange={(e) => setForm({ ...form, admitted_category: e.target.value })}>
                  <option value="">— select —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>

              {/* Loan details are managed on the dedicated Loans page, not here. */}
              <div className="field"><label>Outside Country</label>
                <input type="checkbox" checked={form.outside_country}
                  onChange={(e) => setForm({ ...form, outside_country: e.target.checked })} /></div>
              <div className="field"><label>Outside State</label>
                <input type="checkbox" checked={form.outside_state}
                  onChange={(e) => setForm({ ...form, outside_state: e.target.checked })} /></div>

              <div className="field"><label>Hostel Needed</label>
                <input type="checkbox" checked={form.hostel_needed}
                  onChange={(e) => setForm({
                    ...form,
                    hostel_needed: e.target.checked,
                    // A room can't stay allocated once the student says they don't need one.
                    hostel_allocated: e.target.checked && form.hostel_allocated,
                  })} /></div>
              <div className="field"><label>Hostel Allocated</label>
                <input type="checkbox" disabled={!form.hostel_needed} checked={form.hostel_allocated}
                  onChange={(e) => setForm({ ...form, hostel_allocated: e.target.checked })} /></div>

              <CustomFields entity="admission" values={form.custom_fields}
                onChange={(cf) => setForm({ ...form, custom_fields: cf })} />
            </div>
            {formError && <div className="error">{formError}</div>}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
