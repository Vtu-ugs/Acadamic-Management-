-- Link a login account to a staff record (so a staff user owns their diary),
-- and add an activity log for logins/logouts and diary changes.

-- app_user.staff_id → staff.staff_id (nullable; set for staff-role logins).
ALTER TABLE app_user ADD COLUMN staff_id INT NULL;

CREATE TABLE IF NOT EXISTS activity_log (
  log_id     INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  username   VARCHAR(50),
  role       VARCHAR(30),
  action     VARCHAR(40) NOT NULL,   -- login | logout | diary_create | diary_update | diary_delete
  detail     VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
