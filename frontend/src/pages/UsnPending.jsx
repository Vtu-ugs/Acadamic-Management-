import { useState } from 'react';
import { api } from '../api';
import { usePagedApi } from '../components/useApi.js';
import Pager from '../components/Pager.jsx';

// FR-S3a: track and follow up on USN allotment
export default function UsnPending() {
  const {
    rows: data, total, page, pageSize, setPage, loading, error, reload,
  } = usePagedApi('/students/usn-pending');
  const [busy, setBusy] = useState(null);

  const setUsn = async (dsn) => {
    const usn = prompt(`Enter allotted USN for DSN ${dsn}:`);
    if (!usn) return;
    setBusy(dsn);
    try { await api.patch(`/students/${dsn}/usn`, { usn }); reload(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <h2 className="page-title">USN Pending</h2>
      <p className="page-sub">Students awaiting University Seat Number allotment (FR-S3a)</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        {loading ? <p className="muted">Loading…</p> : (
          <table>
            <thead><tr><th>DSN</th><th>Name</th><th>Course</th><th>Sem</th><th>Action</th></tr></thead>
            <tbody>
              {data?.map((s) => (
                <tr key={s.dsn}>
                  <td>{s.dsn}</td><td>{s.student_name}</td>
                  <td>{s.course?.course_name}</td><td>{s.semester}</td>
                  <td><button className="link" disabled={busy === s.dsn} onClick={() => setUsn(s.dsn)}>Allot USN</button></td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="5" className="muted">No pending USNs 🎉</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} />
    </div>
  );
}
