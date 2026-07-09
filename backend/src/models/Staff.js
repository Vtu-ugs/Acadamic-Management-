const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.8 STAFF
const Staff = sequelize.define('staff', {
  staff_id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_id:   { type: DataTypes.INTEGER, allowNull: false },
  staff_name:  { type: DataTypes.STRING(100), allowNull: false },
  designation: { type: DataTypes.STRING(60) },
  email:       { type: DataTypes.STRING(100), unique: true },
  // 10-digit Indian mobile (starts 6-9); empty allowed. Matches the rule already
  // enforced on the student/parent mobiles in StudentPersonalDetails.
  mobile:      { type: DataTypes.STRING(15), unique: true, validate: { is: { args: /^([6-9]\d{9})?$/, msg: 'Mobile must be a valid 10-digit number' } } },
});

module.exports = Staff;
