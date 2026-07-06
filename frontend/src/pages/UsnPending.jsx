import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../components/useApi.js';

// FR-S3a: track and follow up on USN allotment
export default function UsnPending() {
  const { data, loading, error, reload } = useApi('/students/usn-pending');
  const [busy, setBusy] = useState(null);

  const setUsn = async (csn) => {
    const usn = prompt(`Enter allotted USN for CSN ${csn}:`);
    if (!usn) return;
    setBusy(csn);
    try { await api.patch(`/students/${csn}/usn`, { usn }); reload(); }
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
            <thead><tr><th>CSN</th><th>Name</th><th>Course</th><th>Sem</th><th>Action</th></tr></thead>
            <tbody>
              {data?.map((s) => (
                <tr key={s.csn}>
                  <td>{s.csn}</td><td>{s.student_name}</td>
                  <td>{s.course?.course_name}</td><td>{s.semester}</td>
                  <td><button className="link" disabled={busy === s.csn} onClick={() => setUsn(s.csn)}>Allot USN</button></td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan="5" className="muted">No pending USNs 🎉</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
