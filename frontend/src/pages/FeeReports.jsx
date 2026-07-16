import { useApi, usePagedApi } from '../components/useApi.js';
import Pager from '../components/Pager.jsx';

// FR-F3, FR-F5, FR-F6 — financial reports
export default function FeeReports() {
  const byYear = useApi('/fees/report/by-year');
  const byCourse = useApi('/fees/report/by-course');
  // The dues list can be long, so it is server-paged; the two collection
  // summaries above are already aggregated to a handful of rows.
  const dues = usePagedApi('/fees/report/pending-dues');

  const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

  return (
    <div>
      <h2 className="page-title">Fee Reports</h2>
      <p className="page-sub">Year-wise &amp; course-wise collections, pending dues (FR-F3/F5/F6)</p>

      <div className="card">
        <h4>Year-wise Collection (FR-F5)</h4>
        <table>
          <thead><tr><th>Year</th><th>Billed</th><th>Collected</th><th>Pending</th><th>Receipts</th></tr></thead>
          <tbody>
            {byYear.data?.map((r, i) => (
              <tr key={i}>
                <td>{r.academic_year}</td><td>{money(r.total_billed)}</td>
                <td>{money(r.total_collected)}</td><td>{money(r.total_pending)}</td><td>{r.receipts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h4>Course-wise Collection (FR-F6)</h4>
        <table>
          <thead><tr><th>Course</th><th>Billed</th><th>Collected</th><th>Pending</th></tr></thead>
          <tbody>
            {byCourse.data?.map((r, i) => (
              <tr key={i}>
                <td>{r.course_name}</td><td>{money(r.total_billed)}</td>
                <td>{money(r.total_collected)}</td><td>{money(r.total_pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h4>Pending Dues (FR-F3)</h4>
        <table>
          <thead><tr><th>Receipt</th><th>Student</th><th>Course</th><th>Pending Due</th></tr></thead>
          <tbody>
            {dues.rows?.map((f) => (
              <tr key={f.fee_id}>
                <td>{f.receipt_number}</td>
                <td>{f.admission?.student?.student_name}</td>
                <td>{f.admission?.course?.course_name}</td>
                <td>{money(f.pending_due)}</td>
              </tr>
            ))}
            {dues.rows?.length === 0 && <tr><td colSpan="4" className="muted">No outstanding dues.</td></tr>}
          </tbody>
        </table>
        <Pager page={dues.page} pageSize={dues.pageSize} total={dues.total} onPage={dues.setPage} />
      </div>
    </div>
  );
}
