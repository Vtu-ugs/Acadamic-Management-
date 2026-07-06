# Product Requirements Document (PRD)
## Office Management Software — Student Administration & Financial Records

| | |
|---|---|
| **Document Version** | 1.0 |
| **Date** | 29 June 2026 |
| **Author** | Karthik B K |
| **Status** | Draft |

---

## 1. Purpose

This document defines the requirements for an Office Management Software solution to digitize and centralize **student administration**, **fee/financial management**, and **certificate & letter generation** for an educational institution. The system is designed around a single, course-agnostic data model — the same Entity Relationship (ER) structure is used for all programs offered by the institution, including 4‑year B.E. courses (8 semesters) and M.C.A. (typically 4 semesters), so no schema changes are required when onboarding a new course.

## 2. Background

The institution currently manages student records, fee collection, and certificate issuance manually / via disconnected spreadsheets. This leads to data duplication, delayed fee tracking, and inconsistent certificate formats. The proposed system will provide a single source of truth (`STUDENT` and related entities) accessible to administrative staff, accounts staff, and academic coordinators.

## 3. Scope

### In Scope
- Student master data management (admission to graduation)
- Course-agnostic student records (works identically for B.E., M.C.A., or any future course)
- Fee collection, receipting, and financial reporting
- Certificate and letter generation from templates
- Staff and academic coordinator record-keeping (supporting data for certificates/approvals)
- Excel/CSV bulk import and export of student data

### Out of Scope (Phase 1)
- Online/student-facing self-service portal
- Examination and result management
- Payroll for staff
- Hostel/transport management

## 4. User Roles

| Role | Description | Key Permissions |
|---|---|---|
| **Admin / Super User** | Full system access | Manage all modules, users, course setup |
| **Office Staff (Student Desk)** | Manages admissions & student records | Add/Edit/Search students, import/export |
| **Accounts Staff** | Manages financial records | Fee collection, receipts, financial reports |
| **Academic Coordinator** | Oversees a course/year | View student & fee status for assigned course |
| **Staff (Faculty)** | Maintains weekly diary | Submit/view weekly diary entries |

## 5. Data Model (Entity Reference)

The data model below is the authoritative source for all modules in this PRD. **PK** = Primary Key, **FK** = Foreign Key, **UK** = Unique Key.

### 5.1 STUDENT
Core academic record — one row per student, regardless of course (B.E. or M.C.A.).

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| csn (PK) | INT | AUTO_INCREMENT, NOT NULL | Central Student Number — generated at admission, before USN exists |
| student_name | VARCHAR(100) | NOT NULL | |
| course_id (FK) | INT | NOT NULL | → COURSES.course_id |
| usn (UK) | VARCHAR(20) | UNIQUE, **NULLABLE** | University Seat Number — allotted by the university *after* admission; NULL until issued, then updated. See USN lifecycle note below. |
| semester | INT | CHECK (semester BETWEEN 1 AND 8) | Supports up to 8 semesters (B.E.); M.C.A. uses a subset (1–4) of the same field |

> **USN lifecycle:** At admission, a student has no USN — the system generates `csn` immediately and uses it as the internal identifier for all downstream records (`ADMISSION`, `FEE`, `CERTIFICATE`, etc., all of which key off `csn`, never `usn`). Once the university allots the USN, Office Staff update that single field on the existing `STUDENT` row. From that point on, **USN becomes the primary day-to-day identifier** for search, display, and printed documents — `csn` continues to exist as the stable internal key but is not normally shown to end users. The `UNIQUE` constraint on `usn` only applies to non-null values, so multiple students can simultaneously be in the "pending USN" state.

### 5.2 STUDENT_PERSONAL_DETAILS
One-to-one extension of STUDENT holding personal/demographic data.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| csn (PK, FK) | INT | NOT NULL | → STUDENT.csn (1:1) |
| father_name | VARCHAR(100) | | |
| mother_name | VARCHAR(100) | | |
| per_address | TEXT | | Permanent address |
| temp_address | TEXT | | Temporary address |
| gender | VARCHAR(10) | | |
| category | VARCHAR(30) | | General / OBC / SC / ST |
| caste | VARCHAR(30) | | |
| date_of_birth | DATE | | |
| email_id | VARCHAR(100) | | |
| student_mobile | VARCHAR(15) | | |
| parent_mobile | VARCHAR(15) | | |
| blood_group | VARCHAR(5) | | |
| aadhar_no (UK) | VARCHAR(20) | UNIQUE | Govt. ID, must be unique |

### 5.3 ADMISSION
Records the admission event linking a student to a course/year.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| adm_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| csn (FK) | INT | NOT NULL | → STUDENT.csn |
| course_id (FK) | INT | NOT NULL | → COURSES.course_id |
| kea_ad_no | VARCHAR(30) | | KEA admission number |
| academic_year | VARCHAR | | e.g., 2024-25 |
| admission_mode | VARCHAR(20) | | CET / Management / NRI |
| actual_category | VARCHAR(30) | | |
| admitted_category | VARCHAR(30) | | |
| loan_provider_name | VARCHAR | | |
| available_loan | DECIMAL(10,2) | | |
| outside_country | BOOLEAN | NOT NULL DEFAULT FALSE | |
| outside_state | BOOLEAN | NOT NULL DEFAULT FALSE | |

### 5.4 FEE
All financial transactions tied to an admission record.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| fee_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| adm_id (FK) | INT | NOT NULL | → ADMISSION.adm_id |
| kea_fee | DECIMAL(10,2) | | |
| regn_fee | DECIMAL(10,2) | | Registration fee |
| tuition_fee | DECIMAL(10,2) | | |
| total_course_fee | DECIMAL(10,2) | | |
| pending_due | DECIMAL(10,2) | DEFAULT 0 | |
| receipt_number (UK) | VARCHAR(30) | UNIQUE | |
| payment_status | VARCHAR(20) | | Paid / Pending / Partial |
| academic_year | VARCHAR(10) | | |
| receipt_date | DATE | | |

### 5.5 CERTIFICATE
Certificates/letters issued against an admission record.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| cert_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| adm_id (FK) | INT | NOT NULL | → ADMISSION.adm_id |
| cert_type | VARCHAR(50) | | Bonafide / TC / NOC |
| issue_date | DATE | | |
| issued_by | VARCHAR(100) | | |
| remarks | TEXT | | |

### 5.6 COURSES
Master list of programs (e.g., B.E. – CSE, M.C.A.).

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| course_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| course_name | VARCHAR(100) | NOT NULL | |
| intake | INT | | |
| yearly_intake | YEAR | | |

### 5.7 ACADEMIC_COORDINATOR
Maps a staff member as coordinator for a course/year.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| co_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| course_id (FK) | INT | NOT NULL | → COURSES.course_id |
| staff_id (FK) | INT | NOT NULL | → STAFF.staff_id |
| year | YEAR | NOT NULL | |

### 5.8 STAFF
Faculty/staff master, also used for certificate sign-off and coordination.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| staff_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| course_id (FK) | INT | NOT NULL | → COURSES.course_id |
| staff_name | VARCHAR(100) | NOT NULL | |
| designation | VARCHAR(60) | | |
| email (UK) | VARCHAR(100) | UNIQUE | |
| mobile (UK) | VARCHAR(15) | UNIQUE | |

### 5.9 WEEKLY_DIARY
Faculty weekly activity log with approval workflow.

| Attribute | Data Type | Constraint | Notes |
|---|---|---|---|
| diary_id (PK) | INT | AUTO_INCREMENT, NOT NULL | |
| staff_id (FK) | INT | NOT NULL | → STAFF.staff_id |
| week_start_date | DATE | | Monday of the week |
| duties_assigned | TEXT | | |
| diary_entry | TEXT | | |
| approval_status | VARCHAR(20) | | Pending / Approved / Rejected |
| approval_date | DATE | | |
| approved_by (FK) | INT | | |

### 5.10 Entity Relationship Summary

```
COURSES ──< STUDENT >── STUDENT_PERSONAL_DETAILS (1:1)
   │              │
   │              └──< ADMISSION >──< FEE
   │                       │
   │                       └──< CERTIFICATE
   │
   ├──< ACADEMIC_COORDINATOR >── STAFF ──< WEEKLY_DIARY
```

> **Multi-course note:** `STUDENT.course_id` and `ADMISSION.course_id` reference the same `COURSES` table for every program. A B.E. student and an M.C.A. student are both represented as rows in the identical `STUDENT` / `ADMISSION` / `FEE` / `CERTIFICATE` tables — only the `COURSES` row and the effective range of `semester` differ. No new entities or schema changes are required to add M.C.A. or any future course.

---

## 6. Functional Requirements

### 6.1 Module: Student

| ID | Requirement | Entities Involved |
|---|---|---|
| FR-S1 | Add new student at admission with academic (`STUDENT`) and personal (`STUDENT_PERSONAL_DETAILS`) details; `usn` is left blank/NULL at this stage since the university has not yet allotted it. System generates `csn` as the interim identifier | STUDENT, STUDENT_PERSONAL_DETAILS |
| FR-S1a | **Update USN**: once the university allots the USN, allow Office Staff to look up the student by `csn`/name/mobile and update the `usn` field; validate uniqueness before saving | STUDENT |
| FR-S2 | Edit existing student academic and personal details | STUDENT, STUDENT_PERSONAL_DETAILS |
| FR-S3 | Quick search, prioritized as follows: **USN first** (once allotted, it is the primary identifier students/staff use day-to-day); fall back to student name, student mobile, or parent mobile; `csn` remains searchable as a secondary/internal lookup, primarily for students still awaiting USN allotment | STUDENT, STUDENT_PERSONAL_DETAILS |
| FR-S3a | Provide a filtered view/report of students with `usn IS NULL` ("USN Pending") so Office Staff can track and follow up on allotment | STUDENT |
| FR-S4 | Maintain a centralized database of all students across all courses (B.E., M.C.A., etc.) using one shared schema | STUDENT |
| FR-S5 | Record admission details (admission mode, category, academic year, loan info) at the time of intake | ADMISSION |
| FR-S6 | Bulk export of student data to Excel/CSV (filterable by course, semester, academic year) | STUDENT, STUDENT_PERSONAL_DETAILS, ADMISSION |
| FR-S7 | Bulk import of student data from Excel/CSV with validation (duplicate USN/Aadhar check, mandatory field check); `usn` column may be blank for newly-admitted rows and populated later via FR-S1a; error report for rejected rows | STUDENT, STUDENT_PERSONAL_DETAILS |
| FR-S8 | Prevent duplicate USN and Aadhar number entries at data-entry, USN-update, and import time (uniqueness check applies only to non-null `usn` values, since multiple students may legitimately have no USN yet) | STUDENT, STUDENT_PERSONAL_DETAILS |

### 6.2 Module: Financial Details Management

| ID | Requirement | Entities Involved |
|---|---|---|
| FR-F1 | Record fee components (KEA fee, registration fee, tuition fee, total course fee) against a student's admission | FEE, ADMISSION |
| FR-F2 | Generate a printable/PDF receipt with a unique receipt number on each fee collection | FEE |
| FR-F3 | Auto-calculate and display `pending_due` after each transaction; flag/alert students with outstanding dues | FEE |
| FR-F4 | View student-wise financial history (all receipts, payment status, dues) | FEE, ADMISSION, STUDENT |
| FR-F5 | Generate year-wise financial reports (collections by `academic_year`) | FEE |
| FR-F6 | Generate course-wise financial reports (collections by `COURSES.course_name`) | FEE, ADMISSION, COURSES |
| FR-F7 | Filter/report on `payment_status` (Paid / Pending / Partial) across course and year | FEE |
| FR-F8 | Track loan-related fields (`loan_provider_name`, `available_loan`) where applicable | ADMISSION |

### 6.3 Module: Certificate & Letter Formats

| ID | Requirement | Entities Involved |
|---|---|---|
| FR-C1 | Maintain a library of editable certificate/letter templates (e.g., Bonafide, Transfer Certificate, NOC) | CERTIFICATE |
| FR-C2 | Auto-fill template placeholders from `STUDENT`, `STUDENT_PERSONAL_DETAILS`, `ADMISSION`, and `COURSES` data when generating a certificate | STUDENT, STUDENT_PERSONAL_DETAILS, ADMISSION, COURSES, CERTIFICATE |
| FR-C3 | Capture `cert_type`, `issue_date`, and `issued_by` for every certificate generated, for audit/history purposes | CERTIFICATE, STAFF |
| FR-C4 | Export generated certificates as PDF and support direct printing | CERTIFICATE |
| FR-C5 | Allow authorized users to edit/create new certificate template formats without code changes | CERTIFICATE |
| FR-C6 | Maintain a remarks/notes field per issued certificate for special cases | CERTIFICATE |

### 6.4 Supporting Module: Staff & Coordination (enabling data for above modules)

| ID | Requirement | Entities Involved |
|---|---|---|
| FR-X1 | Maintain staff master (name, designation, contact, assigned course) — used as `issued_by`/`approved_by` reference in certificates and coordination | STAFF |
| FR-X2 | Assign an Academic Coordinator (staff) to a course for a given year | ACADEMIC_COORDINATOR, STAFF, COURSES |
| FR-X3 | Staff weekly diary submission and approval workflow (Pending/Approved/Rejected) | WEEKLY_DIARY, STAFF |

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Data Integrity** | Enforce all PK/FK/UK constraints as defined in Section 5; reject orphan records (e.g., FEE without valid ADMISSION) |
| **Usability** | Search results for FR-S3 should return within 2 seconds for a database of up to ~50,000 students |
| **Scalability** | Schema must support adding new `COURSES` rows (e.g., M.C.A., future programs) without structural change |
| **Auditability** | All financial transactions (FEE) and certificates (CERTIFICATE) must be immutable once issued; corrections via reversal/new entry, not direct edit |
| **Security** | Role-based access control per Section 4; Aadhar and mobile numbers treated as sensitive data |
| **Data Portability** | Excel/CSV import/export must use a documented column-mapping template to avoid data loss |
| **Availability** | System should support concurrent access by Office Staff and Accounts Staff without record locking conflicts |

## 8. Reports & Outputs

- Student-wise financial history (FR-F4)
- Year-wise fee collection report (FR-F5)
- Course-wise fee collection report (FR-F6)
- Pending dues report, filterable by course/semester/academic year (FR-F3)
- Certificate issuance log (FR-C3)
- Bulk student export (FR-S6)

## 9. Assumptions & Constraints

1. The same ER schema (Section 5) is used for **all courses**, including the 4-year B.E. program (8 semesters) and M.C.A.; only `COURSES` master data and the effective semester range differ per course.
2. **`csn` vs. `usn`:** `csn` is the permanent internal key, assigned at admission and used by every related table (`ADMISSION`, `FEE`, `CERTIFICATE`, etc.) — it never changes and is not university-issued. `usn` is allotted by the university *after* admission, is therefore NULL initially, and once populated becomes the primary identifier shown to and searched by end users (Section 5.1, FR-S1a, FR-S3).
3. `STUDENT.semester` constraint (`BETWEEN 1 AND 8`) accommodates B.E.'s 8 semesters; for M.C.A. (typically 4 semesters), the application layer will restrict valid input to 1–4 without altering the database constraint.
4. One student (`csn`) can have only one active `ADMISSION` record per enrollment; re-admissions create a new `ADMISSION` row.
5. Certificates and fee receipts are linked to `ADMISSION`, not directly to `STUDENT`, to correctly handle students with multiple admission cycles.

## 10. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js (JavaScript) |
| Database | MySQL |

The data model in Section 5 is already expressed in SQL types and relational constraints (PK/FK/UK, `CHECK`, `BOOLEAN`, `DECIMAL`, etc.), so it maps directly to MySQL tables — no schema redesign is required for this stack. A few stack-specific notes:

- **`BOOLEAN`** fields (`outside_country`, `outside_state`) map to MySQL's `TINYINT(1)`.
- **`YEAR`** type (`COURSES.yearly_intake`, `ACADEMIC_COORDINATOR.year`) is natively supported by MySQL.
- Recommend an ORM/query layer (e.g., Sequelize or Knex) on the Node.js backend to enforce the FK relationships and the nullable-unique behavior on `STUDENT.usn` (Section 5.1) consistently at the application layer — MySQL allows multiple `NULL`s in a `UNIQUE` column by default, which is the desired behavior here.
- Expose REST (or GraphQL) APIs from the Node.js backend for the React frontend to consume; suggested baseline endpoints: `/students`, `/admissions`, `/fees`, `/certificates`, `/courses`, `/staff`.
- Excel/CSV import/export (FR-S6, FR-S7) can be handled on the Node.js side with libraries such as `xlsx` or `csv-parser`.
- PDF generation for receipts and certificates (FR-F2, FR-C4) can use libraries such as `pdfkit` or `puppeteer` on the backend.

## 11. Deployment & Hosting

The application will be deployed to a server (institution-owned or cloud-hosted) rather than a serverless/managed PaaS, so the following are the baseline requirements for that setup:

| Component | Recommendation |
|---|---|
| **Process management (Node.js)** | Run the backend under a process manager (e.g., **PM2**) for auto-restart on crash and reboot, log management, and zero-downtime reloads |
| **Reverse proxy / web server** | **Nginx** (or Apache) in front of Node.js — serves the built React static files, proxies `/api/*` to the Node backend, and terminates SSL/TLS |
| **HTTPS** | SSL certificate (e.g., **Let's Encrypt** via Certbot, or institution-provided cert) — required given sensitive data (Aadhar, fee/financial records) |
| **MySQL hosting** | MySQL Server installed on the same server or a separate DB server; daily automated backups (`mysqldump` or binary log based) — this is the system of record for fees and student data |
| **Environment configuration** | Store DB credentials, ports, and secrets in environment variables (`.env`, excluded from version control) — separate `.env` for dev/staging/production |
| **Firewall / port exposure** | Only expose ports 80/443 publicly; MySQL (3306) and the Node app port should not be publicly accessible — restrict to localhost or an internal network |
| **File storage** | Generated PDFs (receipts, certificates) and imported/exported Excel/CSV files stored on server disk (with a backup policy) or an attached volume; avoid storing them in MySQL itself |
| **Domain / access** | Internal domain or subdomain (e.g., `office.<institution>.edu`) pointed at the server, accessible to staff over the institution's network or VPN if not meant to be public |
| **CI/CD (optional, Phase 2)** | Git-based deployment workflow (manual `git pull` + PM2 restart is acceptable for Phase 1; GitHub Actions or similar for later automation) |

> **Open item:** Is the target server a cloud VPS (e.g., AWS/DigitalOcean/Azure), a shared/college-managed server, or an on-premises machine within the institution's network? This affects firewall setup, SSL provisioning, and backup strategy — happy to tailor this section further once known.

## 12. Open Questions

- Should lateral-entry or re-admission scenarios be explicitly modeled (multiple `ADMISSION` rows per `csn`) in Phase 1, or deferred?
- Are digital signatures required on PDF certificates (FR-C4), or is a printed-then-signed workflow acceptable for Phase 1?
- What is the required retention period for `WEEKLY_DIARY` entries?

## 13. Future Scope

- Student/parent self-service portal for fee payment and certificate requests
- SMS/Email automated alerts for pending dues (building on FR-F3)
- Examination and academic performance tracking
- Integration with online payment gateways for FR-F2
