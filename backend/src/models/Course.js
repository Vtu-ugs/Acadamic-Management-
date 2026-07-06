const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.6 COURSES
const Course = sequelize.define('courses', {
  course_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_name:   { type: DataTypes.STRING(100), allowNull: false },
  intake:        { type: DataTypes.INTEGER },
  yearly_intake: { type: DataTypes.INTEGER }, // YEAR
});

module.exports = Course;
