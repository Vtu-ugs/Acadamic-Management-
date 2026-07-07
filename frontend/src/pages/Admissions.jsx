import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../components/useApi.js';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';

// Reservation categories used for the admitted-seat dropdown.
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'Others'];
const ENTRY_TYPES = ['Regular', 'Lateral'];

// The batch follows the CSN's year prefix: CSN 2026xxxx -> batch "2026-27".
const batchYearFromCsn = (csn) => {
  const year = Math.floor(Number(csn) / 10000);
  if (!Number.isFinite(year) || year < 2000 || year > 2999) return '';
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
};

const blank = {
  adm_id: null, csn: '', course_id: '', kea_ad_no: '', academic_year: '', admission_date: '',
  admission_mode: '', entry_type: 'Regular', actual_category: '', admitted_category: '',
  loan_provider_name: '', available_loan: '', outside_country: false, outside_state: false,
};

// 5.3 ADMISSION (FR-S5, FR-F8)
export default function Admissions() {
  const { data, loading, error, reload } = useApi('/admissions');
  const { data: courses } = useApi('/courses');
  const { data: students } = useApi('/students');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);

  const courseName = (id) => (courses || []).find((c) => c.course_id === id)?.course_name || id;

  // Student picker — searchable by CSN, USN or name.
  const studentOptions = (students || []).map((s) => ({
    value: s.csn,
    label: `CSN ${s.csn} · USN ${s.usn || 'pending'} · ${s.student_name || ''}`,
  }));

  // When a student is chosen, pull their course and actual category from the
  // student / personal-details record so admissions staff don't re-enter them.
  const pickStudent = (csn) => {
    const s = (students || []).find((x) => String(x.csn) === String(csn));
    setForm((f) => ({
      ...f,
      csn,
      course_id: f.course_id || s?.course_id || '',
      actual_category: s?.student_personal_detail?.category || f.actual_category || '',
      // Derive the batch from the CSN year prefix when not already set.
      academic_year: f.academic_year || batchYearFromCsn(csn),
    }));
  };

  const openEdit = (row) => {
    setFormError(null);
    setForm({
      adm_id: row.adm_id, csn: row.csn, course_id: row.course_id, kea_ad_no: row.kea_ad_no || '',
      academic_year: row.academic_year || '', admission_date: row.admission_date || '',
      admission_mode: row.admission_mode || '',
      entry_type: row.entry_type || 'Regular', actual_category: row.actual_category || '',
      admitted_category: row.admitted_category || '', loan_provider_name: row.loan_provider_name || '',
      available_loan: row.available_loan ?? '', outside_country: !!row.outside_country,
      outside_state: !!row.outside_state,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form,
      csn: Number(form.csn),
      course_id: Number(form.course_id),
      available_loan: form.available_loan === '' ? null : Number(form.available_loan),
      admission_date: form.admission_date || null,
    };
    delete payload.adm_id;
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
      <p className="page-sub">Admission events linking a student (csn) to a course/year (FR-S5)</p>

      <div className="toolbar">
        <button onClick={() => { setFormError(null); setForm({ ...blank }); }}>+ New Admission</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>Sl. No</th><th>CSN</th><th>Student</th><th>Course</th><th>Year</th>
                <th>Mode</th><th>Entry</th><th>Category</th><th>Loan</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r, i) => (
                <tr key={r.adm_id}>
                  <td>{i + 1}</td>
                  <td>{r.csn}</td>
                  <td>{r.student?.student_name}</td>
                  <td>{r.course?.course_name || courseName(r.course_id)}</td>
                  <td>{r.academic_year}</td>
                  <td>{r.admission_mode}</td>
                  <td>{r.entry_type}</td>
                  <td>{r.admitted_category || r.actual_category || '-'}</td>
                  <td>{r.available_loan}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => openEdit(r)}>Edit</button>
                    <button className="link" onClick={() => remove(r.adm_id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="10" className="muted">No admissions.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={form.adm_id ? `Edit Admission (${form.adm_id})` : 'New Admissions'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Student (CSN) *</label>
                <SearchSelect required options={studentOptions} value={form.csn}
                  onChange={pickStudent} placeholder="Search by CSN, USN or name…" />
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

              <div className="field"><label>Batch / Academic Year (auto from CSN)</label>
                <input value={form.academic_year} placeholder="auto-filled from CSN, e.g. 2026-27"
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
              <div className="field"><label>Loan Provider</label>
                <input value={form.loan_provider_name} onChange={(e) => setForm({ ...form, loan_provider_name: e.target.value })} /></div>

              <div className="field"><label>Available Loan</label>
                <input type="number" step="0.01" value={form.available_loan}
                  onChange={(e) => setForm({ ...form, available_loan: e.target.value })} /></div>
              <div className="field"><label>Outside Country</label>
                <input type="checkbox" checked={form.outside_country}
                  onChange={(e) => setForm({ ...form, outside_country: e.target.checked })} /></div>
              <div className="field"><label>Outside State</label>
                <input type="checkbox" checked={form.outside_state}
                  onChange={(e) => setForm({ ...form, outside_state: e.target.checked })} /></div>
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
