import { useState } from 'react';
import { api, fileUrl } from '../api';
import { useApi } from '../components/useApi.js';
import { useOptions } from '../components/CrudPage.jsx';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';

const TYPES = ['Bonafide', 'TC', 'Probable Expenditure'];
const blank = { adm_id: '', cert_type: 'Bonafide', issue_date: '', issued_by: '', remarks: '' };

// 5.5 CERTIFICATE (FR-C1 to FR-C6)
export default function Certificates() {
  const { admissionOptions } = useOptions();
  const { data, loading, error, reload } = useApi('/certificates');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [preview, setPreview] = useState(null); // { url, title } for the in-app PDF viewer

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    try { await api.post('/certificates', { ...form, adm_id: Number(form.adm_id) }); setForm(null); reload(); }
    catch (err) { setFormError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm(`Delete certificate ${id}?`)) return;
    await api.del(`/certificates/${id}`); reload();
  };

  return (
    <div>
      <h2 className="page-title">Certificates</h2>
      <p className="page-sub">Issue Bonafide / TC / Probable Expenditure — auto-filled PDFs &amp; issuance log (FR-C1 to FR-C6)</p>

      <div className="toolbar">
        <button onClick={() => setForm({ ...blank })}>+ Issue Certificate</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr><th>Sl. No</th><th>Type</th><th>Student</th><th>Issue Date</th><th>Issued By</th><th>Remarks</th><th>Document</th><th></th></tr>
            </thead>
            <tbody>
              {data?.map((c, i) => {
                const url = fileUrl(`/certificates/${c.cert_id}/document.pdf`);
                const student = c.admission?.student?.student_name || `CSN ${c.admission?.csn}`;
                return (
                <tr key={c.cert_id}>
                  <td>{i + 1}</td><td>{c.cert_type}</td>
                  <td>{student}</td>
                  <td>{c.issue_date}</td><td>{c.issued_by}</td><td>{c.remarks}</td>
                  <td>
                    <button className="link" onClick={() => setPreview({ url, title: `${c.cert_type} — ${student}` })}>Preview</button>
                    {' · '}
                    <a href={url} target="_blank" rel="noreferrer">PDF</a>
                  </td>
                  <td><button className="link" onClick={() => remove(c.cert_id)}>Delete</button></td>
                </tr>
                );
              })}
              {data?.length === 0 && <tr><td colSpan="8" className="muted">No certificates issued.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {preview && (
        <Modal title={preview.title || 'Certificate Preview'} onClose={() => setPreview(null)}>
          <iframe title="certificate-preview" src={preview.url}
            style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 6 }} />
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href={preview.url} target="_blank" rel="noreferrer">Open in new tab</a>
            <button type="button" className="secondary" onClick={() => setPreview(null)}>Close</button>
          </div>
        </Modal>
      )}

      {form && (
        <Modal title="Issue Certificate" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Student *</label>
                <SearchSelect required options={admissionOptions} value={form.adm_id}
                  onChange={(v) => setForm({ ...form, adm_id: v })}
                  placeholder="Search by CSN, USN or name…" />
              </div>
              <div className="field">
                <label>Type *</label>
                <select value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Issue Date (today if blank)</label>
                <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
              <div className="field"><label>Issued By</label>
                <input value={form.issued_by} onChange={(e) => setForm({ ...form, issued_by: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Remarks / Purpose</label>
                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
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
