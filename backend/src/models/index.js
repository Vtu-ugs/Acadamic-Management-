const sequelize = require('../config/database');

const Course = require('./Course');
const Staff = require('./Staff');
const Student = require('./Student');
const StudentPersonalDetails = require('./StudentPersonalDetails');
const Admission = require('./Admission');
const Fee = require('./Fee');
const FeeStructure = require('./FeeStructure');
const Certificate = require('./Certificate');
const AcademicCoordinator = require('./AcademicCoordinator');
const WeeklyDiary = require('./WeeklyDiary');
const AppUser = require('./AppUser');
const ActivityLog = require('./ActivityLog');
const CustomField = require('./CustomField');
const { attachCustomFields } = require('../utils/customFields');

// ------- Associations (mirror Section 5.10 ER summary) -------

// COURSES ──< STUDENT
Course.hasMany(Student, { foreignKey: 'course_id' });
Student.belongsTo(Course, { foreignKey: 'course_id' });

// STUDENT ── STUDENT_PERSONAL_DETAILS (1:1)
Student.hasOne(StudentPersonalDetails, { foreignKey: 'csn', onDelete: 'CASCADE' });
StudentPersonalDetails.belongsTo(Student, { foreignKey: 'csn' });

// STUDENT ──< ADMISSION   (FR-assumption: keyed off csn, not usn)
Student.hasMany(Admission, { foreignKey: 'csn', onDelete: 'CASCADE' });
Admission.belongsTo(Student, { foreignKey: 'csn' });
Course.hasMany(Admission, { foreignKey: 'course_id' });
Admission.belongsTo(Course, { foreignKey: 'course_id' });

// ADMISSION ──< FEE
Admission.hasMany(Fee, { foreignKey: 'adm_id', onDelete: 'CASCADE' });
Fee.belongsTo(Admission, { foreignKey: 'adm_id' });

// ADMISSION ──< CERTIFICATE
Admission.hasMany(Certificate, { foreignKey: 'adm_id', onDelete: 'CASCADE' });
Certificate.belongsTo(Admission, { foreignKey: 'adm_id' });

// COURSES ──< STAFF
Course.hasMany(Staff, { foreignKey: 'course_id' });
Staff.belongsTo(Course, { foreignKey: 'course_id' });

// ACADEMIC_COORDINATOR (course + staff)
Course.hasMany(AcademicCoordinator, { foreignKey: 'course_id' });
AcademicCoordinator.belongsTo(Course, { foreignKey: 'course_id' });
Staff.hasMany(AcademicCoordinator, { foreignKey: 'staff_id' });
AcademicCoordinator.belongsTo(Staff, { foreignKey: 'staff_id' });

// STAFF ──< WEEKLY_DIARY
Staff.hasMany(WeeklyDiary, { foreignKey: 'staff_id', onDelete: 'CASCADE' });
WeeklyDiary.belongsTo(Staff, { foreignKey: 'staff_id' });
WeeklyDiary.belongsTo(Staff, { as: 'approver', foreignKey: 'approved_by' });

// APP_USER ── STAFF (a staff login is tied to one staff record)
AppUser.belongsTo(Staff, { foreignKey: 'staff_id' });
Staff.hasOne(AppUser, { foreignKey: 'staff_id' });

// ------- Admin-defined custom fields -------
// Sanitising/merging lives in a beforeSave hook so every write path — the
// forms, the Excel import, a raw API call — obeys the same rules.
attachCustomFields(Student, 'student');
attachCustomFields(Admission, 'admission');
attachCustomFields(Fee, 'fee');

module.exports = {
  sequelize,
  CustomField,
  Course,
  Staff,
  Student,
  StudentPersonalDetails,
  Admission,
  Fee,
  FeeStructure,
  Certificate,
  AcademicCoordinator,
  WeeklyDiary,
  AppUser,
  ActivityLog,
};
