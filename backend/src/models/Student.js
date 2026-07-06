const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.1 STUDENT — usn is nullable & unique-when-present
// csn is application-generated (year-wise running number, e.g. 20260001),
// NOT a DB auto-increment — see utils/csn.js
const Student = sequelize.define('student', {
  csn:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
  student_name: { type: DataTypes.STRING(100), allowNull: false },
  course_id:    { type: DataTypes.INTEGER, allowNull: false },
  usn:          { type: DataTypes.STRING(20), unique: true, allowNull: true },
  semester:     {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 8 },
  },
});

module.exports = Student;
