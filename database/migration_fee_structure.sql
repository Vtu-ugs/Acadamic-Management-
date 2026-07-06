-- =====================================================================
-- Migration: add fee-structure master + admission.entry_type
-- Apply this to an EXISTING database to avoid dropping data.
-- (A fresh setup via schema.sql + seed.sql already includes all of this.)
-- =====================================================================
USE office_management;

-- 1) Regular vs Lateral entry flag on each admission
ALTER TABLE admission
  ADD COLUMN entry_type VARCHAR(20) NOT NULL DEFAULT 'Regular' AFTER admission_mode;

-- 2) Official year-wise fee slabs per admission batch
CREATE TABLE IF NOT EXISTS fee_structure (
  structure_id INT AUTO_INCREMENT PRIMARY KEY,
  batch_year   VARCHAR(10) NOT NULL,
  entry_type   VARCHAR(20) NOT NULL DEFAULT 'Regular',
  program_year INT NOT NULL,
  tuition_fee  DECIMAL(10,2),
  regn_fee     DECIMAL(10,2),
  college_fee  DECIMAL(10,2),
  total_fee    DECIMAL(10,2),
  CONSTRAINT uq_fee_structure UNIQUE (batch_year, entry_type, program_year)
) ENGINE=InnoDB;

-- 3) Seed the 2025-26 batch slabs (VTU PG Centres notification)
INSERT INTO fee_structure
  (batch_year, entry_type, program_year, tuition_fee, regn_fee, college_fee, total_fee)
VALUES
  ('2025-26', 'Regular', 1, 23590, 10610, 10000, 44200),
  ('2025-26', 'Regular', 2, 23590,  3510, 10000, 37100),
  ('2025-26', 'Regular', 3, 23590,  3510, 10000, 37100),
  ('2025-26', 'Regular', 4, 23590,  3510, 10000, 37100),
  ('2025-26', 'Lateral', 2, 24240,  9960, 10000, 44200),
  ('2025-26', 'Lateral', 3, 24240,  3510, 10000, 37100),
  ('2025-26', 'Lateral', 4, 24240,  3510, 10000, 37100);
