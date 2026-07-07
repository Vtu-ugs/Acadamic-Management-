import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState('all');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const didDefault = useRef(false);

  useEffect(() => {
    setError(null);
    api.get(`/dashboard/stats?academic_year=${encodeURIComponent(year)}`)
      .then((d) => {
        setData(d);
        // On first load, default to the latest batch when one exists.
        if (!didDefault.current && year === 'all' && d.academic_years?.length) {
          didDefault.current = true;
          setYear(d.academic_years[0]);
        }
      })
      .catch((e) => setError(e.message));
  }, [year]);

  const totals = data?.totals;
  const branches = data?.branches || [];
  const years = data?.academic_years || [];
  const scopeLabel = year === 'all' ? 'All batches' : `${year} admission batch`;

  return (
    <div>
      <div className="dash-head">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub">Student Administration &amp; Financial Records — {scopeLabel}</p>
        </div>
        <div className="dash-year">
          <label>Academic Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All batches</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="error">Backend not reachable: {error}</div>}

      {totals && (
        <div className="stat-grid">
          <Stat num={totals.students} lbl="Total Students" />
          <Stat num={totals.usnPending} lbl="USN Pending" />
          <Stat num={totals.courses} lbl="Courses" />
          <Stat num={totals.duesCount} lbl="Students with Dues" />
          <Stat num={`₹${Number(totals.totalDue).toLocaleString('en-IN')}`} lbl="Total Pending Dues" />
          <Stat num={totals.certs} lbl="Certificates Issued" />
        </div>
      )}

      {data && (
        <>
          <h3 className="section-title">Branch-wise Statistics <span className="muted">({scopeLabel})</span></h3>
          <p className="page-sub">Click a branch to see its caste-wise details.</p>
          {branches.length === 0 ? (
            <p className="muted">No branches to show.</p>
          ) : (
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
          )}
        </>
      )}

      {selected && (
        <BranchDetail branch={selected} scopeLabel={scopeLabel} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BranchDetail({ branch, scopeLabel, onClose }) {
  // Caste/category breakdown, biggest group first.
  const cats = Object.entries(branch.categories || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Modal title={`${branch.course_name} — ${scopeLabel}`} onClose={onClose}>
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
