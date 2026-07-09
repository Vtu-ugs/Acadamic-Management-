import { useState } from 'react';
import { api, fileUrl } from '../api';

// FR-S6 (export) and FR-S7/S8 (import with validation + error report)
export default function ImportExport() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try { setResult(await api.upload('/students/import', file)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="page-title">Import / Export</h2>
      <p className="page-sub">Bulk student data via Excel/CSV (FR-S6, FR-S7)</p>

      <div className="card">
        <h4>Export Students</h4>
        <p className="muted">
          Downloads all students as an .xlsx workbook — personal details plus each
          student's admission (adm_*) and fee (fee_*) record.
        </p>
        <a href={fileUrl('/students/export')}><button>Download Excel</button></a>
      </div>

      <div className="card">
        <h4>Import Students</h4>
        <p className="muted">
          Upload a .xlsx/.csv. <b>Student:</b> student_name*, course_id*, usn (blank if pending),
          semester, father_name, mother_name, gender, religion, category, caste, date_of_birth, email_id,
          student_mobile, parent_mobile, blood_group, aadhar_no.
          <br /><b>Admission (optional, adm_*):</b> adm_kea_ad_no, adm_academic_year,
          adm_admission_mode, adm_entry_type (Regular/Lateral), adm_actual_category, adm_admitted_category, adm_loan_provider_name,
          adm_available_loan, adm_outside_country (Yes/No), adm_outside_state (Yes/No),
          adm_hostel_needed (Yes/No), adm_hostel_allocated (Yes/No).
          <br /><b>Fee (optional, fee_*, needs admission columns):</b> fee_kea_fee, fee_regn_fee,
          fee_tuition_fee, fee_total_course_fee, fee_pending_due (auto if blank),
          fee_receipt_number (auto if blank), fee_payment_status (auto if blank),
          fee_academic_year, fee_receipt_date.
          <br />Duplicate USN/Aadhar rows are rejected. The export file is a valid import template.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files[0])} />
        <div style={{ marginTop: 10 }}>
          <button onClick={doImport} disabled={!file || busy}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
        {error && <div className="error">{error}</div>}
        {result && (
          <div style={{ marginTop: 12 }}>
            <div className="success">
              Inserted {result.summary.inserted} / {result.summary.total}. Rejected {result.summary.rejected}.
            </div>
            {result.errors.length > 0 && (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Row</th><th>Reason</th></tr></thead>
                <tbody>
                  {result.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.reason}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
