import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/students'),
      api.get('/students/usn-pending'),
      api.get('/courses'),
      api.get('/fees/report/pending-dues'),
      api.get('/certificates'),
    ])
      .then(([students, pending, courses, dues, certs]) => {
        const totalDue = dues.reduce((s, f) => s + Number(f.pending_due || 0), 0);
        setStats({
          students: students.length,
          pending: pending.length,
          courses: courses.length,
          duesCount: dues.length,
          totalDue,
          certs: certs.length,
        });
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
    </div>
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
