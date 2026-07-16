-- =====================================================================
-- Migration: indexes for scale (dashboard aggregation + pending-dues report)
-- Apply this to an EXISTING database. A fresh schema.sql already includes them.
--
-- MySQL has no "CREATE INDEX IF NOT EXISTS", so a small guarded procedure adds
-- each index only when it is missing, making this migration safe to re-run.
-- =====================================================================
USE office_management;

DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER //
CREATE PROCEDURE add_index_if_missing(
  IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, ')');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- Batch scoping on admissions (dashboard, reports filter by academic_year).
CALL add_index_if_missing('admission', 'idx_admission_academic_year', '`academic_year`');
-- Pending-dues scans (dashboard totals + pending-dues report filter pending_due > 0).
CALL add_index_if_missing('fee', 'idx_fee_pending_due', '`pending_due`');

DROP PROCEDURE IF EXISTS add_index_if_missing;
