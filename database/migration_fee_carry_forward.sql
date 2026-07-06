-- =====================================================================
-- Migration: add program_year and carry_forward to fee table
-- Apply this to an EXISTING database to avoid dropping data.
-- (A fresh setup via schema.sql + seed.sql already includes this.)
-- =====================================================================
USE office_management;

-- 1) Track which program year (1..4) a fee record belongs to
ALTER TABLE fee
  ADD COLUMN program_year INT AFTER adm_id;

-- 2) Carry-forward of pending dues from previous academic year(s)
ALTER TABLE fee
  ADD COLUMN carry_forward DECIMAL(10,2) DEFAULT 0 AFTER pending_due;
