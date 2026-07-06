const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Audit trail: logins/logouts and diary changes.
const ActivityLog = sequelize.define('activity_log', {
  log_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:    { type: DataTypes.INTEGER, allowNull: true },
  username:   { type: DataTypes.STRING(50) },
  role:       { type: DataTypes.STRING(30) },
  action:     { type: DataTypes.STRING(40), allowNull: false },
  detail:     { type: DataTypes.STRING(255) },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

module.exports = ActivityLog;
