import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../components/useApi.js';

// Chairperson approval workspace for the staff weekly diary (5.9 WEEKLY_DIARY).
// A single chairperson sees every staff member's weekly entries across all
// courses — with the course and its coordinator for context — and approves or
// rejects each one. Content is read-only here; authoring stays with the staff
// member on the Diary page.

const STATUSES = ['Pending', 'Approved', 'Rejected'];

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function DiaryApprovals() {
  const { data, loading, error, reload } = useApi('/diary');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const rows = (data || []).filter(
    (r) => !statusFilter || (r.approval_status || 'Pending') === statusFilter
  );

  const decide = async (row, approval_status) => {
    setActionError(null);
    setBusyId(row.diary_id);
    try {
      await api.patch(`/diary/${row.diary_id}/approval`, { approval_status });
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = (data || []).filter((r) => (r.approval_status || 'Pending') === 'Pending').length;

  return (
    <div>
      <h2 className="page-title">Diary Approvals</h2>
      <p className="page-sub">
        Review and approve staff weekly diaries across all courses (FR-X3)
        {pendingCount > 0 && <> — <strong>{pendingCount}</strong> awaiting your approval</>}
      </p>

      <div className="toolbar">
        <label className="filter">
          <span className="muted">Status:</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}
      {actionError && <div className="error">{actionError}</div>}

      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Course</th>
                <th>Coordinator</th>
                <th>Week Start</th>
                <th>Duties Assigned</th>
                <th>Diary Entry</th>
                <th>Status</th>
                <th>Decided On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = r.approval_status || 'Pending';
                const busy = busyId === r.diary_id;
                return (
                  <tr key={r.diary_id}>
                    <td>{r.staff?.staff_name || r.staff_id}</td>
                    <td>{r.staff?.course?.course_name || <span className="muted">—</span>}</td>
                    <td>{r.coordinator_name || <span className="muted">—</span>}</td>
                    <td>{fmtDate(r.week_start_date)}</td>
                    <td style={{ whiteSpace: 'pre-wrap', maxWidth: 260 }}>{r.duties_assigned || <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: 'pre-wrap', maxWidth: 320 }}>{r.diary_entry || <span className="muted">—</span>}</td>
                    <td><span className={`badge ${status}`}>{status}</span></td>
                    <td>{fmtDate(r.approval_date)}</td>
                    <td className="row-actions">
                      {status !== 'Approved' && (
                        <button className="link" disabled={busy} onClick={() => decide(r, 'Approved')}>Approve</button>
                      )}
                      {status !== 'Rejected' && (
                        <button className="link" disabled={busy} onClick={() => decide(r, 'Rejected')}>Reject</button>
                      )}
                      {status !== 'Pending' && (
                        <button className="link" disabled={busy} onClick={() => decide(r, 'Pending')}>Reset</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="muted">No diary entries{statusFilter ? ` with status "${statusFilter}"` : ''}.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
