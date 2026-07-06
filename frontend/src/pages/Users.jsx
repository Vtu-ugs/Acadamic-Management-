import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../components/useApi.js';
import Modal from '../components/Modal.jsx';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'admission_staff', label: 'Admission Staff' },
  { value: 'staff', label: 'Staff' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const blankUser = () => ({ username: '', password: '', role: '', full_name: '', is_active: true });
const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.';

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : null);

export default function Users() {
  const { data, loading, error, reload } = useApi('/users');
  const [editing, setEditing] = useState(null); // user object or blank
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const isNew = editing && !editing.user_id;

  const save = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (isNew) {
        await api.post('/users', {
          username: editing.username,
          password: editing.password,
          role: editing.role,
          full_name: editing.full_name,
          is_active: editing.is_active,
        });
      } else {
        // Only send password if the admin typed a new one (reset).
        const payload = {
          role: editing.role,
          full_name: editing.full_name,
          is_active: editing.is_active,
        };
        if (editing.password) payload.password = editing.password;
        await api.put(`/users/${editing.user_id}`, payload);
      }
      setEditing(null);
      reload();
    } catch (err) { setFormError(err.message); }
  };

  const remove = async (u) => {
    if (!confirm(`Delete login account "${u.username}"?`)) return;
    setActionError(null);
    try {
      await api.del(`/users/${u.user_id}`);
      reload();
    } catch (err) { setActionError(err.message); }
  };

  return (
    <div>
      <h2 className="page-title">User Management</h2>
      <p className="page-sub">Create and manage login accounts for staff and admission staff</p>

      <div className="toolbar">
        <button onClick={() => { setFormError(null); setEditing(blankUser()); }}>+ New user</button>
      </div>
      {error && <div className="error">{error}</div>}
      {actionError && <div className="error">{actionError}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr><th>ID</th><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {(data || []).map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.username}</td>
                  <td>{u.full_name || <span className="muted">—</span>}</td>
                  <td>{ROLE_LABEL[u.role] || u.role}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'Approved' : 'Rejected'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{fmtDate(u.last_login) || <span className="muted">Never</span>}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => { setFormError(null); setEditing({ ...u, password: '' }); }}>Edit</button>
                    <button className="link" onClick={() => remove(u)}>Delete</button>
                  </td>
                </tr>
              ))}
              {(data || []).length === 0 && <tr><td colSpan={7} className="muted">No users.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={isNew ? 'New user' : `Edit user (${editing.username})`} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Username *</label>
                <input value={editing.username} disabled={!isNew} required
                  onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
              </div>
              <div className="field">
                <label>Full name</label>
                <input value={editing.full_name ?? ''}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Role *</label>
                <select required value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                  <option value="">— select —</option>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{isNew ? 'Password *' : 'Reset password (blank = unchanged)'}</label>
                <input type="password" autoComplete="new-password"
                  required={isNew} value={editing.password ?? ''}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
                {(isNew || editing.password) && <span className="muted">{PASSWORD_HINT}</span>}
              </div>
              <div className="field">
                <label>Status</label>
                <select value={editing.is_active ? '1' : '0'}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.value === '1' })}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
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
