-- Sample seed data for Office Management Software
USE office_management;

INSERT INTO courses (course_name, intake, yearly_intake) VALUES
  ('B.E. - Computer Science & Engineering', 120, 2024),
  ('B.E. - Electronics & Communication',    60,  2024),
  ('M.C.A.',                                 60,  2024);

INSERT INTO staff (course_id, staff_name, designation, email, mobile) VALUES
  (1, 'Dr. Anil Kumar',   'Professor & HOD',     'anil.kumar@inst.edu',   '9800000001'),
  (1, 'Prof. Sneha Rao',  'Associate Professor', 'sneha.rao@inst.edu',    '9800000002'),
  (3, 'Dr. Ravi Shankar', 'Professor & HOD',     'ravi.shankar@inst.edu', '9800000003');

-- dsn uses the year-wise running-number format: YYYY + 4-digit sequence.
-- Student WITH usn (allotted)
INSERT INTO student (dsn, student_name, course_id, usn, semester) VALUES
  (20260001, 'Karthik B K', 1, '1AB22CS001', 4);
-- Student WITHOUT usn (USN pending)
INSERT INTO student (dsn, student_name, course_id, usn, semester) VALUES
  (20260002, 'Meghana S', 3, NULL, 1);

INSERT INTO student_personal_details
  (dsn, father_name, mother_name, gender, religion, category, date_of_birth, email_id, student_mobile, parent_mobile, blood_group, aadhar_no)
VALUES
  (20260001, 'Gangadhara K S', 'Lakshmi', 'Male',   'Hindu', 'General', '2004-05-12', 'karthik@stu.edu', '9888800001', '9888800010', 'B+',  '111122223333'),
  (20260002, 'Suresh M',       'Geetha',  'Female', 'Hindu', 'OBC',     '2003-08-21', 'meghana@stu.edu', '9888800002', '9888800020', 'O+',  '444455556666');

INSERT INTO admission
  (dsn, course_id, kea_ad_no, academic_year, admission_mode, entry_type, actual_category, admitted_category, available_loan, outside_state)
VALUES
  (20260001, 1, 'KEA2024001', '2024-25', 'CET',        'Regular', 'General', 'General', 0,      FALSE),
  (20260002, 3, 'KEA2024050', '2024-25', 'Management', 'Lateral', 'OBC',     'OBC',     150000, TRUE);

-- Official fee-structure slabs for the 2025-26 admission batch. Fees vary by
-- program (BE / MCA / MTech). Regular students draw the 'Regular' rows; lateral
-- -entry students (BE only) draw the 'Lateral' rows (enter at program year 2).
-- BE runs 4 years; MCA & MTech are 2-year PG programs. Adjust amounts to the
-- actual VTU / college notification as needed.
INSERT INTO fee_structure
  (batch_year, program, entry_type, program_year, tuition_fee, regn_fee, college_fee, total_fee)
VALUES
  -- B.E. (UG, 4 years)
  ('2025-26', 'BE',    'Regular', 1, 23590, 10610, 10000, 44200),
  ('2025-26', 'BE',    'Regular', 2, 23590,  3510, 10000, 37100),
  ('2025-26', 'BE',    'Regular', 3, 23590,  3510, 10000, 37100),
  ('2025-26', 'BE',    'Regular', 4, 23590,  3510, 10000, 37100),
  ('2025-26', 'BE',    'Lateral', 2, 24240,  9960, 10000, 44200),
  ('2025-26', 'BE',    'Lateral', 3, 24240,  3510, 10000, 37100),
  ('2025-26', 'BE',    'Lateral', 4, 24240,  3510, 10000, 37100),
  -- M.C.A. (PG, 2 years)
  ('2025-26', 'MCA',   'Regular', 1, 35000, 12000, 15000, 62000),
  ('2025-26', 'MCA',   'Regular', 2, 35000,  4000, 15000, 54000),
  -- M.Tech (PG, 2 years)
  ('2025-26', 'MTech', 'Regular', 1, 40000, 12000, 18000, 70000),
  ('2025-26', 'MTech', 'Regular', 2, 40000,  4000, 18000, 62000),
  -- 2026-27 batch (same slabs; adjust amounts to the actual notification)
  ('2026-27', 'BE',    'Regular', 1, 23590, 10610, 10000, 44200),
  ('2026-27', 'BE',    'Regular', 2, 23590,  3510, 10000, 37100),
  ('2026-27', 'BE',    'Regular', 3, 23590,  3510, 10000, 37100),
  ('2026-27', 'BE',    'Regular', 4, 23590,  3510, 10000, 37100),
  ('2026-27', 'BE',    'Lateral', 2, 24240,  9960, 10000, 44200),
  ('2026-27', 'BE',    'Lateral', 3, 24240,  3510, 10000, 37100),
  ('2026-27', 'BE',    'Lateral', 4, 24240,  3510, 10000, 37100),
  ('2026-27', 'MCA',   'Regular', 1, 35000, 12000, 15000, 62000),
  ('2026-27', 'MCA',   'Regular', 2, 35000,  4000, 15000, 54000),
  ('2026-27', 'MTech', 'Regular', 1, 40000, 12000, 18000, 70000),
  ('2026-27', 'MTech', 'Regular', 2, 40000,  4000, 18000, 62000);

INSERT INTO fee
  (adm_id, kea_fee, regn_fee, tuition_fee, total_course_fee, pending_due, receipt_number, payment_status, academic_year, receipt_date)
VALUES
  (1, 10000, 2000, 80000, 92000, 0,     'RC-2024-0001', 'Paid',    '2024-25', '2024-09-01'),
  (2, 12000, 2000, 95000, 109000, 50000,'RC-2024-0002', 'Partial', '2024-25', '2024-09-05');

INSERT INTO certificate (adm_id, cert_type, issue_date, issued_by, remarks) VALUES
  (1, 'Bonafide', '2025-01-10', 'Dr. Anil Kumar', 'For passport application');

INSERT INTO academic_coordinator (course_id, staff_id, year) VALUES
  (1, 2, 2024);

INSERT INTO weekly_diary (staff_id, week_start_date, duties_assigned, diary_entry, approval_status) VALUES
  (2, '2025-01-06', 'Conduct CS lab batches A & B', 'Completed lab sessions, evaluated 40 records', 'Approved');
