-- =====================================================================
-- Migration: make fee_structure vary by PROGRAM (BE / MCA / MTech)
-- Apply this to an EXISTING database that already has the fee_structure
-- table (from migration_fee_structure.sql). A fresh setup via schema.sql
-- + seed.sql already includes the `program` column.
-- =====================================================================
USE office_management;

-- 1) Add the program dimension. Existing rows default to 'BE'.
ALTER TABLE fee_structure
  ADD COLUMN program VARCHAR(20) NOT NULL DEFAULT 'BE' AFTER batch_year;

-- 2) Widen the uniqueness constraint so each program gets its own slabs.
ALTER TABLE fee_structure
  DROP INDEX uq_fee_structure,
  ADD CONSTRAINT uq_fee_structure UNIQUE (batch_year, program, entry_type, program_year);

-- 3) Seed the PG programs for the 2025-26 batch (BE rows already exist as
--    the pre-migration default). Adjust amounts to the actual notification.
INSERT INTO fee_structure
  (batch_year, program, entry_type, program_year, tuition_fee, regn_fee, college_fee, total_fee)
VALUES
  -- M.C.A. (PG, 2 years)
  ('2025-26', 'MCA',   'Regular', 1, 35000, 12000, 15000, 62000),
  ('2025-26', 'MCA',   'Regular', 2, 35000,  4000, 15000, 54000),
  -- M.Tech (PG, 2 years)
  ('2025-26', 'MTech', 'Regular', 1, 40000, 12000, 18000, 70000),
  ('2025-26', 'MTech', 'Regular', 2, 40000,  4000, 18000, 62000);
