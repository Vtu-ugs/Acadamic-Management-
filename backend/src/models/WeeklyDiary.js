const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.9 WEEKLY_DIARY
const WeeklyDiary = sequelize.define('weekly_diary', {
  diary_id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  staff_id:        { type: DataTypes.INTEGER, allowNull: false },
  week_start_date: { type: DataTypes.DATEONLY },
  duties_assigned: { type: DataTypes.TEXT },
  diary_entry:     { type: DataTypes.TEXT },
  approval_status: { type: DataTypes.STRING(20), defaultValue: 'Pending' },
  approval_date:   { type: DataTypes.DATEONLY },
  approved_by:     { type: DataTypes.INTEGER },
});

module.exports = WeeklyDiary;
