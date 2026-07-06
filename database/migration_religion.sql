-- =====================================================================
-- Migration: add religion to student_personal_details
-- Apply this to an EXISTING database to avoid dropping data.
-- (A fresh setup via schema.sql + seed.sql already includes this.)
-- =====================================================================
USE office_management;

ALTER TABLE student_personal_details
  ADD COLUMN religion VARCHAR(30) AFTER gender;
