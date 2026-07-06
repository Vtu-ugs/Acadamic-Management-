import { useState } from 'react';
import { api } from '../api';
import { useApi } from './useApi.js';
import Modal from './Modal.jsx';

/**
 * Generic list + create/edit/delete page.
 * props:
 *  title, subtitle, path (API base), pk (primary key name)
 *  columns: [{ key, label, render? }]
 *  fields:  [{ key, label, type?, required?, options?: [{value,label}] }]
 *  filters: optional [{ key, label, allLabel? }] — renders a dropdown of the
 *           distinct values found in `data[key]` and filters the table by it.
 */
export default function CrudPage({ title, subtitle, path, pk, columns, fields, filters = [] }) {
  const { data, loading, error, reload } = useApi(path);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [filterValues, setFilterValues] = useState({});

  const blank = () => Object.fromEntries(fields.map((f) => [f.key, '']));

  // Distinct, sorted options per filter, derived from the loaded rows.
  const filterOptions = (key) =>
    [...new Set((data || []).map((r) => r[key]).filter((v) => v != null && v !== ''))]
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  const rows = (data || []).filter((r) =>
    filters.every((f) => !filterValues[f.key] || String(r[f.key]) === String(filterValues[f.key]))
  );

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    const payload = { ...editing };
    fields.forEach((f) => {
      if (f.type === 'number' && payload[f.key] !== '' && payload[f.key] != null) payload[f.key] = Number(payload[f.key]);
      if (f.type === 'checkbox') payload[f.key] = !!payload[f.key];
      if (payload[f.key] === '') payload[f.key] = null;
    });
    try {
      const id = editing[pk];
      if (id) await api.put(`${path}/${id}`, payload);
      else await api.post(path, payload);
      setEditing(null);
      reload();
    } catch (err) { setFormError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm(`Delete record ${id}?`)) return;
    setActionError(null);
    try {
      await api.del(`${path}/${id}`);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">{title}</h2>
      {subtitle && <p className="page-sub">{subtitle}</p>}
      <div className="toolbar">
        <button onClick={() => setEditing(blank())}>+ New</button>
        {filters.map((f) => (
          <label key={f.key} className="filter">
            <span className="muted">{f.label}:</span>
            <select value={filterValues[f.key] ?? ''}
              onChange={(e) => setFilterValues({ ...filterValues, [f.key]: e.target.value })}>
              <option value="">{f.allLabel || `All ${f.label.toLowerCase()}`}</option>
              {filterOptions(f.key).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {actionError && <div className="error">{actionError}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row[pk]}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(row, i) : row[c.key]}</td>)}
                  <td className="row-actions">
                    <button className="link" onClick={() => setEditing({ ...row })}>Edit</button>
                    <button className="link" onClick={() => remove(row[pk])}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="muted">No records.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={editing[pk] ? `Edit (${editing[pk]})` : `New ${title}`} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              {fields.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}{f.required ? ' *' : ''}</label>
                  {f.type === 'select' ? (
                    <select required={f.required} value={editing[f.key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}>
                      <option value="">— select —</option>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <input type="checkbox" checked={!!editing[f.key]}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })} />
                  ) : f.type === 'textarea' ? (
                    <textarea value={editing[f.key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  ) : (
                    <input type={f.type || 'text'} required={f.required} value={editing[f.key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            {formError && <div className="error">{formError}</div>}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Shared hook for loading select options (courses, staff, students, admissions)
export function useOptions() {
  const courses = useApi('/courses');
  const staff = useApi('/staff');
  const students = useApi('/students');
  const admissions = useApi('/admissions');
  return {
    courseOptions: (courses.data || []).map((c) => ({ value: c.course_id, label: c.course_name })),
    staffOptions: (staff.data || []).map((s) => ({ value: s.staff_id, label: s.staff_name })),
    studentOptions: (students.data || []).map((s) => ({
      value: s.csn,
      label: `${s.csn} — ${s.student_name}${s.usn ? ` (${s.usn})` : ' (USN pending)'}`,
    })),
    admissionOptions: (admissions.data || []).map((a) => ({
      value: a.adm_id,
      label: `CSN ${a.csn} · USN ${a.student?.usn || 'pending'} — ${a.student?.student_name || ''}`,
    })),
  };
}
