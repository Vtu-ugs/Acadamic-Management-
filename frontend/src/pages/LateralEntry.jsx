import { useState } from 'react';
import { useApi } from '../components/useApi.js';

// Lateral-entry students, segregated course-wise. Lateral entry is flagged on
// the admission record (entry_type = 'Lateral'); these students join a BE/BTech
// programme directly at year 2.

export default function LateralEntry() {
  const [year, setYear] = useState('all');
  const path = year === 'all' ? '/admissions/lateral' : `/admissions/lateral?academic_year=${encodeURIComponent(year)}`;
  const { data, loading, error } = useApi(path, [year]);

  const rows = data || [];

  // Batch dropdown, newest first — derived from whatever lateral admissions exist.
  const years = [...new Set(rows.map((r) => r.academic_year).filter(Boolean))].sort().reverse();

  // Group admissions by course, keeping course name for the section heading.
  const byCourse = new Map();
  for (const r of rows) {
    const key = r.course?.course_name || `Course ${r.course_id}`;
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(r);
  }
  const courses = [...byCourse.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <h2 className="page-title">Lateral Entry Students</h2>
      <p className="page-sub">Lateral-entry admissions, segregated course-wise — {rows.length} student{rows.length === 1 ? '' : 's'}</p>

      <div className="toolbar">
        <label className="filter">
          <span className="muted">Batch:</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All batches</option>
            {/* When a batch is picked the list is server-filtered, so re-derive
                the dropdown from the full "all" result by keeping prior years. */}
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
            {year !== 'all' && !years.includes(year) && <option value={year}>{year}</option>}
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="card"><p className="muted">No lateral-entry students{year === 'all' ? '' : ` for ${year}`}.</p></div>
      ) : (
        courses.map(([courseName, list]) => (
          <div className="card" key={courseName} style={{ marginBottom: 18 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              {courseName} <span className="muted">({list.length} student{list.length === 1 ? '' : 's'})</span>
            </h3>
            <table>
              <thead>
                <tr><th>Sl. No.</th><th>Student Name</th><th>DSN</th><th>USN</th><th>Batch</th><th>Semester</th></tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.adm_id}>
                    <td>{i + 1}</td>
                    <td>{r.student?.student_name || <span className="muted">—</span>}</td>
                    <td>{r.dsn}</td>
                    <td>{r.student?.usn || <span className="muted">pending</span>}</td>
                    <td>{r.academic_year || <span className="muted">—</span>}</td>
                    <td>{r.student?.semester ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
