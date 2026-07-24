-- Chairperson role: a single chairperson oversees every course and approves the
-- weekly diaries of all staff. No per-course link — the account is a singleton,
-- enforced in the application layer (userController).

ALTER TABLE app_user
  MODIFY COLUMN role ENUM('admin', 'admission_staff', 'staff', 'chairperson') NOT NULL;
