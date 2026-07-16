-- =====================================================================
-- Office Management Software — MySQL Schema
-- Source of truth: PRD Section 5 (Data Model)
-- Course-agnostic: same schema for B.E. (8 sem) and M.C.A. (1-4 sem)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS office_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE office_management;

-- Drop in FK-safe order (children first)
DROP TABLE IF EXISTS weekly_diary;
DROP TABLE IF EXISTS academic_coordinator;
DROP TABLE IF EXISTS certificate;
DROP TABLE IF EXISTS fee;
DROP TABLE IF EXISTS fee_structure;
DROP TABLE IF EXISTS admission;
DROP TABLE IF EXISTS student_personal_details;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS courses;

-- ---------------------------------------------------------------------
-- 5.6 COURSES — master list of programs
-- ---------------------------------------------------------------------
CREATE TABLE courses (
  course_id     INT AUTO_INCREMENT PRIMARY KEY,
  course_name   VARCHAR(100) NOT NULL,
  intake        INT,
  yearly_intake YEAR,
  custom_fields JSON                           -- admin-defined extra fields (see custom_field)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.8 STAFF — faculty/staff master
-- ---------------------------------------------------------------------
CREATE TABLE staff (
  staff_id    INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  staff_name  VARCHAR(100) NOT NULL,
  designation VARCHAR(60),
  email       VARCHAR(100) UNIQUE,
  mobile      VARCHAR(15)  UNIQUE,
  custom_fields JSON,                         -- admin-defined extra fields (see custom_field)
  CONSTRAINT fk_staff_course FOREIGN KEY (course_id)
    REFERENCES courses(course_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.1 STUDENT — core academic record (one row per student)
-- usn is NULLABLE; UNIQUE applies only to non-null values (MySQL default)
-- ---------------------------------------------------------------------
-- dsn is NOT auto-increment: the application generates it as a year-wise
-- running number, e.g. 20260001 = year 2026 + 4-digit sequence 0001.
CREATE TABLE student (
  dsn          INT PRIMARY KEY,
  student_name VARCHAR(100) NOT NULL,
  course_id    INT NOT NULL,
  usn          VARCHAR(20) UNIQUE,             -- NULL until university allots it
  semester     INT CHECK (semester BETWEEN 1 AND 8),
  custom_fields JSON,                          -- admin-defined extra fields (see custom_field)
  CONSTRAINT fk_student_course FOREIGN KEY (course_id)
    REFERENCES courses(course_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.2 STUDENT_PERSONAL_DETAILS — 1:1 extension of STUDENT
-- ---------------------------------------------------------------------
CREATE TABLE student_personal_details (
  dsn            INT PRIMARY KEY,
  father_name    VARCHAR(100),
  mother_name    VARCHAR(100),
  per_address    TEXT,
  temp_address   TEXT,
  gender         VARCHAR(10),
  religion       VARCHAR(30),
  category       VARCHAR(30),
  caste          VARCHAR(30),
  date_of_birth  DATE,
  email_id       VARCHAR(100),
  student_mobile VARCHAR(15),
  parent_mobile  VARCHAR(15),
  blood_group    VARCHAR(5),
  aadhar_no      VARCHAR(20) UNIQUE,
  CONSTRAINT fk_spd_student FOREIGN KEY (dsn)
    REFERENCES student(dsn) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.3 ADMISSION — admission event linking student to course/year
-- ---------------------------------------------------------------------
CREATE TABLE admission (
  adm_id            INT AUTO_INCREMENT PRIMARY KEY,
  dsn               INT NOT NULL,
  course_id         INT NOT NULL,
  kea_ad_no         VARCHAR(30),
  academic_year     VARCHAR(10),
  admission_date    DATE,                      -- date of admission (auto-fills TC row f.1)
  admission_mode    VARCHAR(20),               -- CET / Management / NRI
  entry_type        VARCHAR(20) NOT NULL DEFAULT 'Regular', -- Regular / Lateral
  actual_category   VARCHAR(30),
  admitted_category VARCHAR(30),
  loan_provider_name VARCHAR(100),
  available_loan    DECIMAL(10,2),
  outside_country   BOOLEAN NOT NULL DEFAULT FALSE,
  outside_state     BOOLEAN NOT NULL DEFAULT FALSE,
  hostel_needed     BOOLEAN NOT NULL DEFAULT FALSE,
  hostel_allocated  BOOLEAN NOT NULL DEFAULT FALSE, -- only meaningful when hostel_needed
  custom_fields     JSON,                      -- admin-defined extra fields (see custom_field)
  CONSTRAINT fk_adm_student FOREIGN KEY (dsn)
    REFERENCES student(dsn) ON DELETE CASCADE,
  CONSTRAINT fk_adm_course FOREIGN KEY (course_id)
    REFERENCES courses(course_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.4 FEE — financial transactions tied to an admission
-- ---------------------------------------------------------------------
CREATE TABLE fee (
  fee_id           INT AUTO_INCREMENT PRIMARY KEY,
  adm_id           INT NOT NULL,
  program_year     INT,                         -- year of study: 1..4
  kea_fee          DECIMAL(10,2),
  regn_fee         DECIMAL(10,2),
  tuition_fee      DECIMAL(10,2),
  total_course_fee DECIMAL(10,2),
  pending_due      DECIMAL(10,2) DEFAULT 0,
  carry_forward    DECIMAL(10,2) DEFAULT 0,     -- pending dues from previous year(s)
  receipt_number   VARCHAR(30) UNIQUE,
  payment_status   VARCHAR(20),                -- Paid / Pending / Partial
  academic_year    VARCHAR(10),
  receipt_date     DATE,
  custom_fields    JSON,                        -- admin-defined extra fields (see custom_field)
  CONSTRAINT fk_fee_admission FOREIGN KEY (adm_id)
    REFERENCES admission(adm_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CUSTOM_FIELD — admin-defined extra fields for student / admission / fee.
-- Values live in the owning row's `custom_fields` JSON column, keyed by
-- field_key, so adding or retiring a field never runs DDL.
-- Retiring a field sets is_active = FALSE: it vanishes from the forms and
-- exports but its stored values survive and return if it is restored.
-- ---------------------------------------------------------------------
CREATE TABLE custom_field (
  cf_id      INT AUTO_INCREMENT PRIMARY KEY,
  entity     VARCHAR(20)  NOT NULL,            -- student / admission / fee
  field_key  VARCHAR(50)  NOT NULL,            -- snake_case key inside custom_fields
  label      VARCHAR(100) NOT NULL,            -- what admissions staff see
  field_type VARCHAR(20)  NOT NULL DEFAULT 'text', -- text/number/date/checkbox/select
  options    TEXT,                             -- comma-separated choices, select only
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_custom_field UNIQUE (entity, field_key)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- FEE_STRUCTURE — official year-wise fee slabs per program & admission batch.
-- Fees vary by program (BE / MCA / MTech). Regular vs Lateral entry students
-- draw different rows. Program_year is the year of study (1..4);
-- lateral-entry students start at program_year 2.
-- Source: VTU PG Centres fee-structure notification (batch-wise).
-- ---------------------------------------------------------------------
CREATE TABLE fee_structure (
  structure_id INT AUTO_INCREMENT PRIMARY KEY,
  batch_year   VARCHAR(10) NOT NULL,              -- admission batch, e.g. 2025-26
  program      VARCHAR(20) NOT NULL DEFAULT 'BE', -- BE / MCA / MTech
  entry_type   VARCHAR(20) NOT NULL DEFAULT 'Regular', -- Regular / Lateral
  program_year INT NOT NULL,                      -- year of study: 1..4
  tuition_fee  DECIMAL(10,2),                     -- Tuition Fees (Ref 1)
  regn_fee     DECIMAL(10,2),                     -- VTU Registration & other fees
  college_fee  DECIMAL(10,2),                     -- College Fees (Ref 2)
  total_fee    DECIMAL(10,2),                     -- Total payable for the year
  CONSTRAINT uq_fee_structure UNIQUE (batch_year, program, entry_type, program_year)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.5 CERTIFICATE — certificates/letters issued against an admission
-- ---------------------------------------------------------------------
CREATE TABLE certificate (
  cert_id    INT AUTO_INCREMENT PRIMARY KEY,
  adm_id     INT NOT NULL,
  cert_type  VARCHAR(50),                      -- Bonafide / TC / NOC
  issue_date DATE,
  issued_by  VARCHAR(100),
  remarks    TEXT,
  tc_details TEXT,                          -- JSON of staff-entered TC fields (rows h–n, T.C. No., dates)
  custom_fields JSON,                       -- admin-defined extra fields (see custom_field)
  CONSTRAINT fk_cert_admission FOREIGN KEY (adm_id)
    REFERENCES admission(adm_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.7 ACADEMIC_COORDINATOR — staff as coordinator for a course/year
-- ---------------------------------------------------------------------
CREATE TABLE academic_coordinator (
  co_id     INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  staff_id  INT NOT NULL,
  year      YEAR NOT NULL,
  CONSTRAINT fk_coord_course FOREIGN KEY (course_id)
    REFERENCES courses(course_id),
  CONSTRAINT fk_coord_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5.9 WEEKLY_DIARY — faculty weekly log with approval workflow
-- ---------------------------------------------------------------------
CREATE TABLE weekly_diary (
  diary_id        INT AUTO_INCREMENT PRIMARY KEY,
  staff_id        INT NOT NULL,
  week_start_date DATE,
  duties_assigned TEXT,
  diary_entry     TEXT,
  approval_status VARCHAR(20) DEFAULT 'Pending', -- Pending / Approved / Rejected
  approval_date   DATE,
  approved_by     INT,
  CONSTRAINT fk_diary_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_diary_approver FOREIGN KEY (approved_by)
    REFERENCES staff(staff_id)
) ENGINE=InnoDB;

-- Helpful indexes for FR-S3 quick search (USN first, then name/mobile)
CREATE INDEX idx_student_name ON student(student_name);
CREATE INDEX idx_spd_student_mobile ON student_personal_details(student_mobile);
CREATE INDEX idx_spd_parent_mobile ON student_personal_details(parent_mobile);
CREATE INDEX idx_fee_status ON fee(payment_status);
CREATE INDEX idx_fee_year ON fee(academic_year);
-- Scale: dashboard batch scoping + pending-dues report scans
CREATE INDEX idx_admission_academic_year ON admission(academic_year);
CREATE INDEX idx_fee_pending_due ON fee(pending_due);
