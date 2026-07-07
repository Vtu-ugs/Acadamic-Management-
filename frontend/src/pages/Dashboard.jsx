import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/students'),
      api.get('/students/usn-pending'),
      api.get('/courses'),
      api.get('/fees/report/pending-dues'),
      api.get('/certificates'),
      api.get('/students/branch-stats'),
    ])
      .then(([students, pending, courses, dues, certs, branchStats]) => {
        const totalDue = dues.reduce((s, f) => s + Number(f.pending_due || 0), 0);
        setStats({
          students: students.length,
          pending: pending.length,
          courses: courses.length,
          duesCount: dues.length,
          totalDue,
          certs: certs.length,
        });
        setBranches(branchStats);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>
      <p className="page-sub">Student Administration &amp; Financial Records — overview</p>
      {error && <div className="error">Backend not reachable: {error}</div>}
      {stats && (
        <div className="stat-grid">
          <Stat num={stats.students} lbl="Total Students" />
          <Stat num={stats.pending} lbl="USN Pending" />
          <Stat num={stats.courses} lbl="Courses" />
          <Stat num={stats.duesCount} lbl="Students with Dues" />
          <Stat num={`₹${stats.totalDue.toLocaleString('en-IN')}`} lbl="Total Pending Dues" />
          <Stat num={stats.certs} lbl="Certificates Issued" />
        </div>
      )}

      {branches && branches.length > 0 && (
        <>
          <h3 className="section-title">Branch-wise Statistics</h3>
          <p className="page-sub">Click a branch to see its caste-wise details.</p>
          <div className="branch-grid">
            {branches.map((b) => (
              <button
                type="button"
                className="branch-card"
                key={b.course_id}
                onClick={() => setSelected(b)}
              >
                <div className="branch-name">{b.course_name}</div>
                <div className="branch-figures">
                  <div className="fig">
                    <div className="fig-num">{b.total_students}</div>
                    <div className="fig-lbl">Total Students</div>
                  </div>
                  <div className="fig">
                    <div className="fig-num">
                      ₹{Number(b.total_pending || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="fig-lbl">Pending Dues</div>
                  </div>
                  <div className="fig">
                    <div className="fig-num">{b.dues_count}</div>
                    <div className="fig-lbl">With Dues</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <BranchDetail branch={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BranchDetail({ branch, onClose }) {
  // Caste/category breakdown, biggest group first.
  const cats = Object.entries(branch.categories || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Modal title={`${branch.course_name} — Details`} onClose={onClose}>
      <div className="branch-figures" style={{ marginBottom: 18, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="fig">
          <div className="fig-num">{branch.intake ?? '-'}</div>
          <div className="fig-lbl">Total Intake</div>
        </div>
        <div className="fig">
          <div className="fig-num">{branch.total_students}</div>
          <div className="fig-lbl">Total Students</div>
        </div>
        <div className="fig">
          <div className="fig-num">
            ₹{Number(branch.total_pending || 0).toLocaleString('en-IN')}
          </div>
          <div className="fig-lbl">Pending Dues</div>
        </div>
        <div className="fig">
          <div className="fig-num">{branch.dues_count}</div>
          <div className="fig-lbl">Students with Dues</div>
        </div>
      </div>

      <div className="caste-title">Caste-wise (Category)</div>
      {cats.length === 0 ? (
        <div className="caste-empty">No students yet</div>
      ) : (
        <table>
          <thead>
            <tr><th>Category</th><th>Students</th></tr>
          </thead>
          <tbody>
            {cats.map(([cat, count]) => (
              <tr key={cat}><td>{cat}</td><td>{count}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 18, textAlign: 'right' }}>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Stat({ num, lbl }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}
