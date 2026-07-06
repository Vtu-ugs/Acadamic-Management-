const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.8 STAFF
const Staff = sequelize.define('staff', {
  staff_id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_id:   { type: DataTypes.INTEGER, allowNull: false },
  staff_name:  { type: DataTypes.STRING(100), allowNull: false },
  designation: { type: DataTypes.STRING(60) },
  email:       { type: DataTypes.STRING(100), unique: true },
  mobile:      { type: DataTypes.STRING(15), unique: true },
});

module.exports = Staff;
