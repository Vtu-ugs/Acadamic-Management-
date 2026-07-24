-- Baseline setup data for Office Management Software.
-- Contains NO student, staff, admission or fee records -- only the reference
-- data a fresh installation needs. Real records are entered through the app.
USE office_management;

INSERT INTO courses (course_name, intake, yearly_intake) VALUES
  ('B.E. - Computer Science & Engineering', 120, 2024),
  ('B.E. - Electronics & Communication',    60,  2024),
  ('M.C.A.',                                 60,  2024);

-- Official fee-structure slabs. Fees vary by program (BE / MCA / MTech).
-- Regular students draw the 'Regular' rows; lateral-entry students (BE only)
-- draw the 'Lateral' rows (they enter at program year 2). BE runs 4 years;
-- MCA & MTech are 2-year PG programs. Adjust amounts to the actual VTU /
-- college notification as needed.
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
