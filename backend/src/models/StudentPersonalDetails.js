const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.2 STUDENT_PERSONAL_DETAILS — 1:1 with STUDENT
const StudentPersonalDetails = sequelize.define('student_personal_details', {
  csn:            { type: DataTypes.INTEGER, primaryKey: true },
  father_name:    { type: DataTypes.STRING(100) },
  mother_name:    { type: DataTypes.STRING(100) },
  per_address:    { type: DataTypes.TEXT },
  temp_address:   { type: DataTypes.TEXT },
  gender:         { type: DataTypes.STRING(10) },
  religion:       { type: DataTypes.STRING(30) },
  category:       { type: DataTypes.STRING(30) },
  caste:          { type: DataTypes.STRING(30) },
  date_of_birth:  { type: DataTypes.DATEONLY },
  email_id:       { type: DataTypes.STRING(100), validate: { isEmailOrEmpty(v) { if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('Invalid email address'); } } },
  // 10-digit Indian mobile (starts 6-9); empty allowed.
  student_mobile: { type: DataTypes.STRING(15), validate: { is: { args: /^([6-9]\d{9})?$/, msg: 'Student mobile must be a valid 10-digit number' } } },
  parent_mobile:  { type: DataTypes.STRING(15), validate: { is: { args: /^([6-9]\d{9})?$/, msg: 'Parent mobile must be a valid 10-digit number' } } },
  blood_group:    { type: DataTypes.STRING(5) },
  // 12-digit Aadhaar; empty allowed.
  aadhar_no:      { type: DataTypes.STRING(20), unique: true, validate: { is: { args: /^(\d{12})?$/, msg: 'Aadhaar must be a 12-digit number' } } },
});

module.exports = StudentPersonalDetails;
