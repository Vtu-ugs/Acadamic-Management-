import { useState } from 'react';
import { api, fileUrl } from '../api';
import { searchStudentOptions } from '../components/CrudPage.jsx';
import SearchSelect from '../components/SearchSelect.jsx';

const inr = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);

// What the course costs across every year. Carry-forward is an internal transfer
// between years, so it must not be added on top.
const courseTotal = (adm) => adm.years.reduce((sum, y) => sum + y.expected_fee, 0);

export default function StudentFeeLedger() {
  const [dsn, setDsn] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadLedger = async (selectedDsn, opt) => {
    setDsn(selectedDsn);
    setStudentLabel(opt?.label || '');
    if (!selectedDsn) { setLedger(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/fees/ledger/${selectedDsn}`);
      setLedger(data);
    } catch (err) {
      setError(err.message);
      setLedger(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Student Fee Ledger</h2>
      <p className="page-sub">Year-wise fee breakdown showing expected fees, carry-forward, payments, and pending dues across the full course duration.</p>

      <div className="toolbar">
        <div className="field" style={{ minWidth: 400 }}>
          <label>Select Student</label>
          <SearchSelect asyncSearch={searchStudentOptions} value={dsn} valueLabel={studentLabel}
            onChange={loadLedger}
            placeholder="Search by DSN, USN or name…" />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Loading ledger…</p>}

      {ledger && ledger.map((adm) => (
        <div key={adm.adm_id} className="card" style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              {adm.student_name} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· DSN {adm.dsn} · USN {adm.usn || 'pending'}</span>
            </h3>
            <div className="muted" style={{ marginTop: 4 }}>
              {adm.course_name} · {adm.program} · {adm.entry_type} · Batch {adm.batch_year}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Program Year</th>
                <th>Academic Year</th>
                <th>Expected Fee</th>
                <th>Carry Forward</th>
                <th>Total Due</th>
                <th>Total Paid</th>
                <th>Pending</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {adm.years.map((yr) => (
                <tr key={yr.program_year}>
                  <td><strong>Year {yr.program_year}</strong></td>
                  <td>{yr.academic_year || '—'}</td>
                  <td>{inr(yr.expected_fee)}</td>
                  <td style={{ color: yr.carry_forward > 0 ? '#e67e22' : undefined, fontWeight: yr.carry_forward > 0 ? 600 : undefined }}>
                    {inr(yr.carry_forward)}
                  </td>
                  <td><strong>{inr(yr.total_due)}</strong></td>
                  <td>{inr(yr.total_paid)}</td>
                  <td style={{ color: yr.pending > 0 ? '#e74c3c' : '#27ae60', fontWeight: 600 }}>
                    {inr(yr.pending)}
                  </td>
                  <td><span className={`badge ${yr.status}`}>{yr.status}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan="2">Grand Total</td>
                <td>{inr(courseTotal(adm))}</td>
                <td>—</td>
                {/* Each year's total_due already carries the previous year's pending
                    forward, so summing the column would count it again. Over the whole
                    course the amount owed is simply what the course costs. */}
                <td>{inr(courseTotal(adm))}</td>
                <td>{inr(adm.years.reduce((s, y) => s + y.total_paid, 0))}</td>
                {/* The last year's pending is already cumulative. */}
                <td style={{ color: '#e74c3c' }}>
                  {inr(adm.years[adm.years.length - 1]?.pending || 0)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Receipt details per year */}
          {adm.years.filter((yr) => yr.receipts.length > 0).map((yr) => (
            <details key={yr.program_year} style={{ marginTop: 8 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                Year {yr.program_year} — {yr.receipts.length} receipt(s)
              </summary>
              <table style={{ marginTop: 4, fontSize: '0.9em' }}>
                <thead>
                  <tr><th>Receipt #</th><th>Date</th><th>College Fee</th><th>Regn Fee</th><th>Tuition</th><th>Total</th><th>Pending</th><th>PDF</th></tr>
                </thead>
                <tbody>
                  {yr.receipts.map((r) => (
                    <tr key={r.fee_id}>
                      <td>{r.receipt_number}</td>
                      <td>{r.receipt_date || '—'}</td>
                      <td>{inr(r.kea_fee)}</td>
                      <td>{inr(r.regn_fee)}</td>
                      <td>{inr(r.tuition_fee)}</td>
                      <td>{inr(r.total_course_fee)}</td>
                      <td>{inr(r.pending_due)}</td>
                      <td><a href={fileUrl(`/fees/${r.fee_id}/receipt.pdf`)} target="_blank" rel="noreferrer">PDF</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      ))}

      {ledger && ledger.length === 0 && (
        <div className="card muted" style={{ padding: 16 }}>No admission found for this student.</div>
      )}
    </div>
  );
}
