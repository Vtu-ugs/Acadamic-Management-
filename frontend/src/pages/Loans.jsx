import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

// A row "has a loan" once either the provider or the amount is filled in.
const hasLoan = (r) => !!r.loan_provider_name || r.available_loan != null;

// Loan management — search a student by DSN / USN / name and allocate the loan
// details onto their admission record (loan_provider_name + available_loan).
// The loan columns live on the admission (5.3), so this page just searches
// admissions and edits those two fields; no admission is created here.
export default function Loans() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);      // the admission whose loan we're editing
  const [formError, setFormError] = useState(null);

  const searching = q.trim() !== '';
  // Default view lists only students who already have a loan. While searching,
  // show every match so a new student can be found and allocated a loan.
  const visible = searching ? rows : rows.filter(hasLoan);

  // Search as the user types (debounced). An empty query shows recent admissions.
  const runSearch = async (term) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/admissions/search${term ? `?q=${encodeURIComponent(term)}` : ''}`);
      setRows(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => runSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const openLoan = (row) => {
    setFormError(null);
    setForm({
      adm_id: row.adm_id,
      dsn: row.dsn,
      student_name: row.student?.student_name || '',
      usn: row.student?.usn || '',
      course_name: row.course?.course_name || '',
      academic_year: row.academic_year || '',
      loan_provider_name: row.loan_provider_name || '',
      available_loan: row.available_loan ?? '',
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.put(`/admissions/${form.adm_id}`, {
        loan_provider_name: form.loan_provider_name || null,
        available_loan: form.available_loan === '' ? null : Number(form.available_loan),
      });
      setForm(null);
      runSearch(q.trim());   // refresh the list so the new loan shows
    } catch (err) { setFormError(err.message); }
  };

  const clearLoan = async (row) => {
    if (!confirm(`Remove loan details for DSN ${row.dsn}?`)) return;
    try {
      await api.put(`/admissions/${row.adm_id}`, { loan_provider_name: null, available_loan: null });
      runSearch(q.trim());
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2 className="page-title">Loans</h2>
      <p className="page-sub">Students with an allocated education loan. Search by DSN / USN / name to add one.</p>

      <div className="toolbar">
        <input
          style={{ minWidth: 320 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by DSN, USN or name…"
          autoFocus
        />
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>DSN</th><th>USN</th><th>Student</th><th>Course</th><th>Year</th>
                <th>Loan Provider</th><th>Available Loan</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.adm_id}>
                  <td>{r.dsn}</td>
                  <td>{r.student?.usn || 'pending'}</td>
                  <td>{r.student?.student_name}</td>
                  <td>{r.course?.course_name}</td>
                  <td>{r.academic_year}</td>
                  <td>{r.loan_provider_name || <span className="muted">—</span>}</td>
                  <td>{r.available_loan != null ? r.available_loan : <span className="muted">—</span>}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => openLoan(r)}>
                      {hasLoan(r) ? 'Edit Loan' : 'Allocate Loan'}
                    </button>
                    {hasLoan(r) && (
                      <button className="link" onClick={() => clearLoan(r)}>Clear</button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan="8" className="muted">
                  {searching ? 'No students found.' : 'No loans allocated yet. Search for a student above to add one.'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={`Allocate Loan — DSN ${form.dsn}`} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <p className="muted" style={{ marginTop: 0 }}>
              {form.student_name} · USN {form.usn || 'pending'}
              {form.course_name ? ` · ${form.course_name}` : ''}
              {form.academic_year ? ` · ${form.academic_year}` : ''}
            </p>
            <div className="form-grid">
              <div className="field"><label>Loan Provider</label>
                <input value={form.loan_provider_name}
                  onChange={(e) => setForm({ ...form, loan_provider_name: e.target.value })}
                  placeholder="e.g. SBI, Canara Bank…" /></div>
              <div className="field"><label>Available Loan</label>
                <input type="number" step="0.01" value={form.available_loan}
                  onChange={(e) => setForm({ ...form, available_loan: e.target.value })}
                  placeholder="Sanctioned amount" /></div>
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
