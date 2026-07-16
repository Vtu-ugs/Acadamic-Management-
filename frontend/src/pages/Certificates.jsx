import { useState } from 'react';
import { api, fileUrl } from '../api';
import { usePagedApi } from '../components/useApi.js';
import Pager from '../components/Pager.jsx';
import { searchAdmissionOptions } from '../components/CrudPage.jsx';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import CustomFields from '../components/CustomFields.jsx';

const TYPES = ['Bonafide', 'TC', 'Probable Expenditure'];

// Transfer Certificate — staff-entered rows (a–g are auto-filled from the
// student record at PDF time, so they are not collected here).
const blankTc = {
  serial_no: '', tc_no: '', nationality: '',
  class_secured: '', promotion_next: '', dues_cleared: '',
  completion_year: '', reason_leaving: '', promotion_higher: '', conduct: '',
};

const blank = {
  adm_id: '', cert_type: 'Bonafide', issue_date: '', issued_by: '', remarks: '',
  custom_fields: {}, tc: { ...blankTc },
};

// 5.5 CERTIFICATE (FR-C1 to FR-C6)
export default function Certificates() {
  const {
    rows: data, total, page, pageSize, setPage, loading, error, reload,
  } = usePagedApi('/certificates');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [preview, setPreview] = useState(null); // { url, title } for the in-app PDF viewer

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { tc, ...rest } = form;
    const payload = { ...rest, adm_id: Number(form.adm_id) };
    // Only the Transfer Certificate carries the extra staff-entered fields.
    if (form.cert_type === 'TC') payload.tc_details = tc;
    try { await api.post('/certificates', payload); setForm(null); reload(); }
    catch (err) { setFormError(err.message); }
  };

  const setTc = (k, v) => setForm((f) => ({ ...f, tc: { ...f.tc, [k]: v } }));

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
                const student = c.admission?.student?.student_name || `DSN ${c.admission?.dsn}`;
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
      <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} />

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
                <SearchSelect required asyncSearch={searchAdmissionOptions} value={form.adm_id}
                  onChange={(v) => setForm({ ...form, adm_id: v })}
                  placeholder="Search by DSN, USN or name…" />
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

              <CustomFields entity="certificate" values={form.custom_fields}
                onChange={(cf) => setForm({ ...form, custom_fields: cf })} />
            </div>

            {form.cert_type === 'TC' && (
              <div className="card" style={{ marginTop: 14 }}>
                <p className="page-sub" style={{ marginTop: 0 }}>
                  Rows <b>a–g</b> are auto-filled from the student record — name, USN,
                  father, caste/religion/sex, DOB, <b>date of admission</b> (from the
                  admission record), <b>date of leaving</b> (the issue date above) and
                  <b> class &amp; discipline</b>. Fill the remaining details below:
                </p>
                <div className="form-grid">
                  <div className="field"><label>Admission Reg. Serial No.</label>
                    <input placeholder="e.g. 145" value={form.tc.serial_no}
                      onChange={(e) => setTc('serial_no', e.target.value)} /></div>
                  <div className="field"><label>T.C. No.</label>
                    <input placeholder="e.g. TC/2025-26/012" value={form.tc.tc_no}
                      onChange={(e) => setTc('tc_no', e.target.value)} /></div>
                  <div className="field"><label>Nationality</label>
                    <input placeholder="Indian" value={form.tc.nationality}
                      onChange={(e) => setTc('nationality', e.target.value)} /></div>
                  <div className="field"><label>h. Class and discipline Secured</label>
                    <input placeholder="e.g. B.E. CSE" value={form.tc.class_secured}
                      onChange={(e) => setTc('class_secured', e.target.value)} /></div>
                  <div className="field"><label>i. Promotion to next higher classes</label>
                    <input placeholder="Yes / No" value={form.tc.promotion_next}
                      onChange={(e) => setTc('promotion_next', e.target.value)} /></div>
                  <div className="field"><label>j. All dues paid &amp; books returned</label>
                    <input placeholder="Yes / No" value={form.tc.dues_cleared}
                      onChange={(e) => setTc('dues_cleared', e.target.value)} /></div>
                  <div className="field"><label>k. Completion Year of Degree</label>
                    <input placeholder="e.g. 2025 / Discontinued" value={form.tc.completion_year}
                      onChange={(e) => setTc('completion_year', e.target.value)} /></div>
                  <div className="field"><label>m. Promotion to higher class?</label>
                    <input placeholder="Yes / No" value={form.tc.promotion_higher}
                      onChange={(e) => setTc('promotion_higher', e.target.value)} /></div>
                  <div className="field"><label>n. Character and Conduct</label>
                    <input placeholder="Good" value={form.tc.conduct}
                      onChange={(e) => setTc('conduct', e.target.value)} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>l. Reasons for leaving</label>
                    <input placeholder="e.g. Health issues / Transfer" value={form.tc.reason_leaving}
                      onChange={(e) => setTc('reason_leaving', e.target.value)} /></div>
                </div>
              </div>
            )}

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
