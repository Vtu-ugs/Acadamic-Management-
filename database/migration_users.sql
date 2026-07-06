-- Auth: application login accounts with role-based access.
-- Table is named `app_user` because `user` is a reserved word in MySQL.
CREATE TABLE IF NOT EXISTS app_user (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'admission_staff', 'staff') NOT NULL,
  full_name     VARCHAR(120),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login    DATETIME NULL
);
