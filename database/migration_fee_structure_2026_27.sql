-- =====================================================================
-- Migration: 2026-27 batch fee structure (default values)
-- Students admitted in 2026-27 (DSN 2026xxxx) follow these slabs for the
-- whole course. These are default figures (~5% revision over 2025-26) and
-- can be edited any time under the Fee Structure page.
-- =====================================================================
USE office_management;

INSERT INTO fee_structure
  (batch_year, program, entry_type, program_year, tuition_fee, regn_fee, college_fee, total_fee)
VALUES
  -- B.E. (4 years)
  ('2026-27', 'BE',    'Regular', 1, 24770, 11140, 10000, 45910),
  ('2026-27', 'BE',    'Regular', 2, 24770,  3690, 10000, 38460),
  ('2026-27', 'BE',    'Regular', 3, 24770,  3690, 10000, 38460),
  ('2026-27', 'BE',    'Regular', 4, 24770,  3690, 10000, 38460),
  ('2026-27', 'BE',    'Lateral', 2, 25450, 10460, 10000, 45910),
  ('2026-27', 'BE',    'Lateral', 3, 25450,  3690, 10000, 39140),
  ('2026-27', 'BE',    'Lateral', 4, 25450,  3690, 10000, 39140),
  -- M.C.A. (2 years)
  ('2026-27', 'MCA',   'Regular', 1, 36750, 12600, 15000, 64350),
  ('2026-27', 'MCA',   'Regular', 2, 36750,  4200, 15000, 55950),
  -- M.Tech (2 years)
  ('2026-27', 'MTech', 'Regular', 1, 42000, 12600, 18000, 72600),
  ('2026-27', 'MTech', 'Regular', 2, 42000,  4200, 18000, 64200)
ON DUPLICATE KEY UPDATE
  tuition_fee = VALUES(tuition_fee),
  regn_fee    = VALUES(regn_fee),
  college_fee = VALUES(college_fee),
  total_fee   = VALUES(total_fee);
