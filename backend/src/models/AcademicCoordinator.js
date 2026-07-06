const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.7 ACADEMIC_COORDINATOR
const AcademicCoordinator = sequelize.define('academic_coordinator', {
  co_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  staff_id:  { type: DataTypes.INTEGER, allowNull: false },
  year:      { type: DataTypes.INTEGER, allowNull: false }, // YEAR
});

module.exports = AcademicCoordinator;
