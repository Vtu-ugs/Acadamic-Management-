const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { customFieldsAttribute } = require('../utils/customFields');

// 5.6 COURSES
const Course = sequelize.define('courses', {
  course_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_name:   { type: DataTypes.STRING(100), allowNull: false },
  intake:        { type: DataTypes.INTEGER },
  yearly_intake: { type: DataTypes.INTEGER }, // YEAR
  custom_fields: customFieldsAttribute(),
});

module.exports = Course;
