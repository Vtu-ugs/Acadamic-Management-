import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../components/useApi.js';
import Modal from '../components/Modal.jsx';

// Sections an admin may extend. Must match CUSTOM_FIELD_ENTITIES on the server.
const ENTITIES = [
  { value: 'admission', label: 'Admissions' },
  { value: 'student', label: 'Students' },
  { value: 'fee', label: 'Fees' },
  { value: 'certificate', label: 'Certificates' },
  { value: 'staff', label: 'Staff' },
  { value: 'course', label: 'Courses' },
];
const FIELD_TYPES = ['text', 'number', 'date', 'checkbox', 'select'];
const ENTITY_LABEL = Object.fromEntries(ENTITIES.map((e) => [e.value, e.label]));

const blank = { entity: 'admission', label: '', field_type: 'text', options: '', sort_order: 0 };

// Admin-only: define the extra fields that appear on the Admissions, Students
// and Fees forms. Retiring a field hides it everywhere but keeps its stored
// values, so restoring it brings the data back.
export default function CustomFieldsAdmin() {
  // include_hidden=1 so the admin can see and restore retired fields.
  const { data, loading, error, reload } = useApi('/custom-fields?include_hidden=1');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (form.cf_id) {
        // entity/field_key are immutable — they address data already stored.
        await api.put(`/custom-fields/${form.cf_id}`, {
          label: form.label, options: form.options, sort_order: form.sort_order,
        });
      } else {
        await api.post('/custom-fields', form);
      }
      setForm(null);
      reload();
    } catch (err) { setFormError(err.message); }
  };

  const hide = async (f) => {
    if (!confirm(
      `Hide "${f.label}" from the ${ENTITY_LABEL[f.entity]} form?\n\n`
      + 'Values already saved are kept, and reappear if you restore the field.'
    )) return;
    try { await api.del(`/custom-fields/${f.cf_id}`); reload(); }
    catch (err) { alert(err.message); }
  };

  const restore = async (f) => {
    try { await api.put(`/custom-fields/${f.cf_id}`, { is_active: true }); reload(); }
    catch (err) { alert(err.message); }
  };

  // Irreversible: drops the field and erases its values. Ask the server how many
  // records actually hold a value first, so the warning states a real number
  // rather than a vague "this cannot be undone".
  const destroy = async (f) => {
    try {
      const { rows_with_value: n } = await api.get(`/custom-fields/${f.cf_id}/usage`);
      const warning = n > 0
        ? `${n} record${n === 1 ? '' : 's'} currently hold a value for "${f.label}". `
          + 'Deleting the field erases those values permanently.'
        : `No records hold a value for "${f.label}".`;
      if (!confirm(
        `Delete "${f.label}" from the ${ENTITY_LABEL[f.entity]} form?\n\n${warning}\n\n`
        + 'This cannot be undone. To remove the field but keep its data, use Hide instead.'
      )) return;
      await api.del(`/custom-fields/${f.cf_id}/permanent`);
      reload();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2 className="page-title">Custom Fields</h2>
      <p className="page-sub">
        Add your own fields to the Admissions, Students, Fees, Certificates, Staff and Courses
        forms without a schema change. Hiding a field removes it from the forms but keeps
        everything already saved in it; deleting also erases the saved values.
      </p>

      <div className="toolbar">
        <button onClick={() => { setFormError(null); setForm({ ...blank }); }}>+ New Field</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>Sl. No</th><th>Section</th><th>Label</th><th>Key</th>
                <th>Type</th><th>Order</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((f, i) => (
                <tr key={f.cf_id}>
                  <td>{i + 1}</td>
                  <td>{ENTITY_LABEL[f.entity] || f.entity}</td>
                  <td>{f.label}</td>
                  <td className="muted">{f.field_key}</td>
                  <td>{f.field_type}{f.field_type === 'select' && f.options ? ` (${f.options})` : ''}</td>
                  <td>{f.sort_order}</td>
                  <td>{f.is_active ? 'Active' : 'Hidden'}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => {
                      setFormError(null);
                      setForm({
                        cf_id: f.cf_id, entity: f.entity, label: f.label,
                        field_type: f.field_type, options: f.options || '',
                        sort_order: f.sort_order,
                      });
                    }}>Edit</button>
                    {f.is_active
                      ? <button className="link" onClick={() => hide(f)}>Hide</button>
                      : <button className="link" onClick={() => restore(f)}>Restore</button>}
                    <button className="link danger" onClick={() => destroy(f)}>Delete</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="8" className="muted">No custom fields yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={form.cf_id ? `Edit Field (${form.label})` : 'New Custom Field'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Section *</label>
                <select required disabled={!!form.cf_id} value={form.entity}
                  onChange={(e) => setForm({ ...form, entity: e.target.value })}>
                  {ENTITIES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Label *</label>
                <input required value={form.label} placeholder="e.g. Bus Route"
                  onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="field">
                <label>Type *</label>
                <select required disabled={!!form.cf_id} value={form.field_type}
                  onChange={(e) => setForm({ ...form, field_type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.field_type === 'select' && (
                <div className="field">
                  <label>Options (comma-separated) *</label>
                  <input required value={form.options} placeholder="Route 1, Route 2, Route 3"
                    onChange={(e) => setForm({ ...form, options: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label>Sort Order</label>
                <input type="number" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            {form.cf_id && (
              <p className="muted" style={{ marginTop: 10 }}>
                Section and type can't be changed — existing rows already store values under this field.
              </p>
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
