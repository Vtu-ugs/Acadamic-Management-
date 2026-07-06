import { useState } from 'react';
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
};

const fmt = (v) => (v ? new Date(v).toLocaleString() : '');

export default function ActivityLog() {
  const [action, setAction] = useState('');
  const path = action ? `/activity?action=${action}` : '/activity';
  const { data, loading, error } = useApi(path, [action]);

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
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr><th>When</th><th>User</th><th>Role</th><th>Activity</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {(data || []).map((r) => (
                <tr key={r.log_id}>
                  <td>{fmt(r.created_at)}</td>
                  <td>{r.username || <span className="muted">—</span>}</td>
                  <td>{r.role}</td>
                  <td>{ACTION_LABEL[r.action] || r.action}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
              {(data || []).length === 0 && <tr><td colSpan={5} className="muted">No activity recorded.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
