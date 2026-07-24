import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../components/useApi.js';

const ACTIONS = [
  { value: '', label: 'All activity' },
  { value: 'login', label: 'Logins' },
  { value: 'logout', label: 'Logouts' },
  { value: 'diary_create', label: 'Diary created' },
  { value: 'diary_update', label: 'Diary updated' },
  { value: 'diary_delete', label: 'Diary deleted' },
];

const ACTION_LABEL = {
  login: 'Logged in', logout: 'Logged out',
  diary_create: 'Diary created', diary_update: 'Diary updated', diary_delete: 'Diary deleted',
  activity_clear: 'Log cleared',
};

const fmt = (v) => (v ? new Date(v).toLocaleString() : '');

export default function ActivityLog() {
  const [action, setAction] = useState('');
  const path = action ? `/activity?action=${action}` : '/activity';
  const { data, loading, error, reload } = useApi(path, [action]);
  const [actionError, setActionError] = useState(null);

  // Delete a single entry.
  const removeEntry = async (r) => {
    if (!confirm('Delete this activity entry?')) return;
    setActionError(null);
    try {
      await api.del(`/activity/${r.log_id}`);
      reload();
    } catch (err) { setActionError(err.message); }
  };

  // Clear everything currently shown (respects the action filter).
  const clearLog = async () => {
    const label = ACTIONS.find((a) => a.value === action)?.label || 'All activity';
    if (!confirm(`Clear the activity log (${label})? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await api.del(path); // same path → same ?action= filter
      reload();
    } catch (err) { setActionError(err.message); }
  };

  const rows = data || [];

  return (
    <div>
      <h2 className="page-title">Activity Log</h2>
      <p className="page-sub">Who signed in/out and every diary change — newest first</p>

      <div className="toolbar">
        <label className="filter">
          <span className="muted">Show:</span>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" disabled={rows.length === 0} onClick={clearLog}>
          Clear log{action ? ' (filtered)' : ''}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {actionError && <div className="error">{actionError}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr><th>When</th><th>User</th><th>Role</th><th>Activity</th><th>Detail</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.log_id}>
                  <td>{fmt(r.created_at)}</td>
                  <td>{r.username || <span className="muted">—</span>}</td>
                  <td>{r.role}</td>
                  <td>{ACTION_LABEL[r.action] || r.action}</td>
                  <td>{r.detail}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => removeEntry(r)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="muted">No activity recorded.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
