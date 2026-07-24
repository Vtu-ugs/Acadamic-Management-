import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApi } from '../components/useApi.js';
import Modal from '../components/Modal.jsx';
import CustomFields from '../components/CustomFields.jsx';

const PROGRAMS = [
  { value: 'BE', label: 'B.E.' },
  { value: 'MCA', label: 'M.C.A.' },
  { value: 'MTech', label: 'M.Tech' },
];
const PROGRAM_ORDER = ['BE', 'MCA', 'MTech'];
const ENTRY_TYPES = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Lateral', label: 'Lateral' },
];
const PROGRAM_YEARS = [1, 2, 3, 4].map((y) => ({ value: y, label: `Year ${y}` }));
const inr = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);

const blankForm = (batch = '') => ({
  structure_id: null, batch_year: batch, program: 'BE', entry_type: 'Regular',
  program_year: '', tuition_fee: '', regn_fee: '', college_fee: '', total_fee: '',
  custom_fields: {},
});

// Fee-structure master, shown as a batch → programs drill-down.
// Pick a batch year on the left; its BE / MCA / MTech slabs show on the right.
export default function FeeStructures() {
  const { data, loading, error, reload } = useApi('/fee-structures');
  const [batch, setBatch] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);

  const rows = data || [];

  // Distinct batch years, newest first.
  const batches = useMemo(() => (
    [...new Set(rows.map((r) => r.batch_year).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true }))
  ), [rows]);

  // Default the selection to the first batch once data loads (or if it vanished).
  useEffect(() => {
    if (batches.length && !batches.includes(batch)) setBatch(batches[0]);
  }, [batches, batch]);

  const rowsForBatch = rows.filter((r) => r.batch_year === batch);
  const programsInBatch = PROGRAM_ORDER.filter((p) => rowsForBatch.some((r) => r.program === p));

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const payload = { ...form };
    ['tuition_fee', 'regn_fee', 'college_fee', 'total_fee', 'program_year'].forEach((k) => {
      payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k]);
    });
    // Convenience: total = tuition + registration + college when left blank.
    if (payload.total_fee == null) {
      payload.total_fee = (payload.tuition_fee || 0) + (payload.regn_fee || 0) + (payload.college_fee || 0);
    }
    try {
      if (form.structure_id) await api.put(`/fee-structures/${form.structure_id}`, payload);
      else await api.post('/fee-structures', payload);
      setForm(null);
      reload();
    } catch (err) { setFormError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm(`Delete fee-structure row ${id}?`)) return;
    try { await api.del(`/fee-structures/${id}`); reload(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2 className="page-title">Fee Structure</h2>
      <p className="page-sub">
        Pick a batch year on the left to see its official fee slabs for every program (B.E. / M.C.A. / M.Tech).
      </p>

      <div className="toolbar">
        <button onClick={() => { setFormError(null); setForm(blankForm(batch)); }}>+ New</button>
      </div>
      {error && <div className="error">{error}</div>}

      {loading ? <p className="muted">Loading…</p> : (
        <div className="fs-layout">
          {/* ---- Left: batch years ---- */}
          <div className="fs-batches card">
            <div className="fs-batches-title">Fee Structure</div>
            {batches.length === 0 && <div className="muted" style={{ padding: 10 }}>No batches yet.</div>}
            {batches.map((b) => (
              <button key={b} type="button"
                className={`fs-batch ${b === batch ? 'active' : ''}`}
                onClick={() => setBatch(b)}>
                {b}
              </button>
            ))}
          </div>

          {/* ---- Right: programs for the selected batch ---- */}
          <div className="fs-detail">
            {!batch ? (
              <div className="card muted" style={{ padding: 16 }}>Select a batch year.</div>
            ) : programsInBatch.length === 0 ? (
              <div className="card muted" style={{ padding: 16 }}>No fee rows for {batch}.</div>
            ) : programsInBatch.map((prog) => {
              const progRows = rowsForBatch
                .filter((r) => r.program === prog)
                .sort((a, b) => (a.entry_type || '').localeCompare(b.entry_type) || a.program_year - b.program_year);
              const label = PROGRAMS.find((p) => p.value === prog)?.label || prog;
              return (
                <div className="card fs-prog" key={prog}>
                  <div className="fs-prog-title">{label} <span className="muted">· {batch}</span></div>
                  <table>
                    <thead>
                      <tr>
                        <th>Entry Type</th><th>Program Year</th><th>Tuition</th>
                        <th>Registration &amp; Other</th><th>College</th><th>Total</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progRows.map((r) => (
                        <tr key={r.structure_id}>
                          <td>{r.entry_type}</td>
                          <td>Year {r.program_year}</td>
                          <td>{inr(r.tuition_fee)}</td>
                          <td>{inr(r.regn_fee)}</td>
                          <td>{inr(r.college_fee)}</td>
                          <td>{inr(r.total_fee)}</td>
                          <td className="row-actions">
                            <button className="link" onClick={() => { setFormError(null); setForm({ ...r }); }}>Edit</button>
                            <button className="link" onClick={() => remove(r.structure_id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {form && (
        <Modal title={form.structure_id ? `Edit Fee Slab (${form.structure_id})` : 'New Fee Slab'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field"><label>Batch Year (e.g. 2026-27) *</label>
                <input required value={form.batch_year}
                  onChange={(e) => setForm({ ...form, batch_year: e.target.value })} /></div>
              <div className="field"><label>Program *</label>
                <select required value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                  {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select></div>
              <div className="field"><label>Entry Type *</label>
                <select required value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                  {ENTRY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div className="field"><label>Program Year *</label>
                <select required value={form.program_year} onChange={(e) => setForm({ ...form, program_year: e.target.value })}>
                  <option value="">— select —</option>
                  {PROGRAM_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
                </select></div>
              {[
                ['tuition_fee', 'Tuition Fee'], ['regn_fee', 'Registration & Other Fee'],
                ['college_fee', 'College Fee'], ['total_fee', 'Total Fee (auto if blank)'],
              ].map(([k, l]) => (
                <div className="field" key={k}><label>{l}</label>
                  <input type="number" step="0.01" value={form[k] ?? ''}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
              ))}
              <CustomFields entity="fee_structure" values={form.custom_fields}
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
