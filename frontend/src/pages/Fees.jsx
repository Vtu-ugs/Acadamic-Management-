import { useEffect, useState } from 'react';
import { api, fileUrl } from '../api';
import { useApi } from '../components/useApi.js';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import CustomFields from '../components/CustomFields.jsx';

const STATUSES = ['', 'Paid', 'Partial', 'Pending'];
const PROGRAM_YEARS = [1, 2, 3, 4];
const inr = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);
const blank = {
  adm_id: '', program_year: '', kea_fee: '', regn_fee: '', tuition_fee: '', total_course_fee: '',
  pending_due: '', carry_forward: '', receipt_number: '', payment_status: '', academic_year: '', receipt_date: '',
  custom_fields: {},
};

export default function Fees() {
  const [status, setStatus] = useState('');
  const { data: admissions } = useApi('/admissions');
  const { data, loading, error, reload } = useApi(`/fees${status ? `?payment_status=${status}` : ''}`, [status]);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [structure, setStructure] = useState(null); // matched fee-structure slab
  const [carryForward, setCarryForward] = useState(0); // carry-forward from previous years

  const selectedAdm = form && (admissions || []).find((a) => String(a.adm_id) === String(form.adm_id));

  // Searchable by CSN, USN or name; keeps the entry-type / batch context in view.
  const admissionOptions = (admissions || []).map((a) => ({
    value: a.adm_id,
    label: `CSN ${a.csn} · USN ${a.student?.usn || 'pending'} · ${a.student?.student_name || ''} — ${a.entry_type || 'Regular'} (${a.academic_year || 'batch ?'})`,
  }));

  // Look up the official fee slab whenever the student (entry type + batch) or
  // program year changes: Regular students draw Regular rows, Lateral draw Lateral.
  useEffect(() => {
    if (!selectedAdm || !form?.program_year) { setStructure(null); setCarryForward(0); return; }
    const batch = selectedAdm.academic_year;
    const entry = selectedAdm.entry_type || 'Regular';
    if (!batch) { setStructure(null); setCarryForward(0); return; }
    let cancelled = false;

    // Fetch fee structure slab and carry-forward in parallel
    Promise.all([
      api.get(`/fee-structures?batch_year=${encodeURIComponent(batch)}&entry_type=${encodeURIComponent(entry)}&program_year=${form.program_year}`),
      api.get(`/fees/carry-forward?adm_id=${form.adm_id}&program_year=${form.program_year}`),
    ]).then(([rows, cfData]) => {
      if (cancelled) return;
      const slab = rows?.[0] || null;
      const cf = Number(cfData?.carry_forward) || 0;
      setStructure(slab);
      setCarryForward(cf);
      // Auto-fill the billed total, academic year, and carry-forward from the matched slab.
      if (slab) {
        setForm((f) => (f ? {
          ...f,
          total_course_fee: slab.total_fee ?? f.total_course_fee,
          academic_year: f.academic_year || batch,
          carry_forward: cf || f.carry_forward,
        } : f));
      } else {
        setForm((f) => (f ? { ...f, carry_forward: cf || f.carry_forward } : f));
      }
    }).catch(() => {
      if (!cancelled) { setStructure(null); setCarryForward(0); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.adm_id, form?.program_year]);

  const applyStructureAmounts = () => {
    if (!structure) return;
    setForm((f) => ({
      ...f,
      tuition_fee: structure.tuition_fee ?? '',
      regn_fee: structure.regn_fee ?? '',
      kea_fee: structure.college_fee ?? '', // College Fees (Ref 2)
      total_course_fee: structure.total_fee ?? '',
      carry_forward: carryForward,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const payload = { ...form };
    ['adm_id', 'program_year', 'kea_fee', 'regn_fee', 'tuition_fee', 'total_course_fee', 'pending_due', 'carry_forward'].forEach((k) => {
      payload[k] = payload[k] === '' ? null : Number(payload[k]);
    });
    try { await api.post('/fees', payload); setForm(null); reload(); }
    catch (err) { setFormError(err.message); }
  };

  const openForm = () => { setStructure(null); setCarryForward(0); setForm({ ...blank }); };

  // Live financial preview. The year is billed at the official slab total (when
  // a slab exists); pending = slab total + carry-forward − amount paid so far.
  const paidNow = (Number(form?.kea_fee) || 0) + (Number(form?.regn_fee) || 0) + (Number(form?.tuition_fee) || 0);
  const billed = Number(structure?.total_fee ?? form?.total_course_fee) || 0;
  const grandDue = billed + (Number(carryForward) || 0);
  const livePending = Math.max(grandDue - paidNow, 0);
  const liveStatus = livePending <= 0 ? 'Paid' : (paidNow > 0 ? 'Partial' : 'Pending');

  return (
    <div>
      <h2 className="page-title">Fees</h2>
      <p className="page-sub">Record fees, auto-calc dues with carry-forward, print receipts (FR-F1 to FR-F4, FR-F7)</p>

      <div className="toolbar">
        <div className="field">
          <label>Filter by status (FR-F7)</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <button onClick={openForm}>+ Record Fee</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr><th>Receipt</th><th>Student</th><th>Course</th><th>Year</th><th>Total</th><th>Carry Fwd</th><th>Pending</th><th>Status</th><th>Acad. Year</th><th>Receipt</th></tr>
            </thead>
            <tbody>
              {data?.map((f) => (
                <tr key={f.fee_id}>
                  <td>{f.receipt_number}</td>
                  <td>{f.admission?.student?.student_name || `CSN ${f.admission?.csn}`}</td>
                  <td>{f.admission?.course?.course_name}</td>
                  <td>{f.program_year ? `Year ${f.program_year}` : '—'}</td>
                  <td>{inr(f.total_course_fee)}</td>
                  <td>{inr(f.carry_forward)}</td>
                  <td>{inr(f.pending_due)}</td>
                  <td><span className={`badge ${f.payment_status}`}>{f.payment_status}</span></td>
                  <td>{f.academic_year}</td>
                  <td><a href={fileUrl(`/fees/${f.fee_id}/receipt.pdf`)} target="_blank" rel="noreferrer">PDF</a></td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="10" className="muted">No fee records.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title="Record Fee" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Student *</label>
                <SearchSelect required options={admissionOptions} value={form.adm_id}
                  onChange={(v) => setForm({ ...form, adm_id: v })}
                  placeholder="Search by CSN, USN or name…" />
              </div>
              <div className="field">
                <label>Program Year *</label>
                <select required value={form.program_year} onChange={(e) => setForm({ ...form, program_year: e.target.value })}>
                  <option value="">— select —</option>
                  {PROGRAM_YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
            </div>

            {selectedAdm && form.program_year && (
              <div className="card" style={{ margin: '10px 0', padding: '10px 12px' }}>
                {structure ? (
                  <>
                    <strong>Official {structure.entry_type} slab · {structure.batch_year} · Year {structure.program_year}</strong>
                    <div className="muted" style={{ margin: '4px 0' }}>
                      Tuition {inr(structure.tuition_fee)} · Registration &amp; Other {inr(structure.regn_fee)} · College {inr(structure.college_fee)} · <strong>Total {inr(structure.total_fee)}</strong>
                    </div>
                    {carryForward > 0 && (
                      <div style={{ margin: '4px 0', color: '#e67e22', fontWeight: 600 }}>
                        ⚠ Carry-forward from previous year(s): {inr(carryForward)} · <strong>Grand Total Due: {inr(Number(structure.total_fee || 0) + carryForward)}</strong>
                      </div>
                    )}
                    <button type="button" className="secondary" onClick={applyStructureAmounts}>Use these amounts</button>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      Billed {inr(billed)}{carryForward > 0 ? ` + Carry ${inr(carryForward)}` : ''} = Due {inr(grandDue)}
                      {'  −  '}Paid {inr(paidNow)} ={' '}
                      <strong style={{ color: livePending > 0 ? '#e74c3c' : '#27ae60' }}>
                        Pending {inr(livePending)}
                      </strong>
                      <span className={`badge ${liveStatus}`} style={{ marginLeft: 8 }}>{liveStatus}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="muted">
                      No fee structure found for {selectedAdm.entry_type || 'Regular'} · {selectedAdm.academic_year || 'unknown batch'} · Year {form.program_year}. Add it under Fee Structure.
                    </span>
                    {carryForward > 0 && (
                      <div style={{ margin: '4px 0', color: '#e67e22', fontWeight: 600 }}>
                        ⚠ Carry-forward from previous year(s): {inr(carryForward)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="form-grid">
              {/* Amounts actually paid in this receipt (editable). */}
              {[
                ['kea_fee', 'College Fee (paid)'], ['regn_fee', 'Registration Fee (paid)'], ['tuition_fee', 'Tuition Fee (paid)'],
              ].map(([k, l]) => (
                <div className="field" key={k}>
                  <label>{l}</label>
                  <input type="number" step="0.01" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              {/* Billed total is locked to the official slab when one exists. */}
              <div className="field">
                <label>Total Course Fee (billed){structure ? ' · official' : ''}</label>
                <input type="number" step="0.01" value={structure ? billed : form.total_course_fee}
                  readOnly={!!structure}
                  onChange={(e) => setForm({ ...form, total_course_fee: e.target.value })} />
              </div>
              <div className="field">
                <label>Carry Forward (auto)</label>
                <input type="number" value={carryForward} readOnly tabIndex={-1} />
              </div>
              <div className="field">
                <label>Pending Due (auto)</label>
                <input type="number" value={livePending} readOnly tabIndex={-1}
                  style={{ fontWeight: 700, color: livePending > 0 ? '#e74c3c' : '#27ae60' }} />
              </div>
              <div className="field"><label>Receipt Number (auto if blank)</label>
                <input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} /></div>
              <div className="field"><label>Payment Status (auto)</label>
                <input value={liveStatus} readOnly tabIndex={-1} /></div>
              <div className="field"><label>Academic Year</label>
                <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} /></div>
              <div className="field"><label>Receipt Date</label>
                <input type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} /></div>

              <CustomFields entity="fee" values={form.custom_fields}
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
