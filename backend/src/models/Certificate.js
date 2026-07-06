const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.5 CERTIFICATE
const Certificate = sequelize.define('certificate', {
  cert_id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adm_id:     { type: DataTypes.INTEGER, allowNull: false },
  cert_type:  { type: DataTypes.STRING(50) },
  issue_date: { type: DataTypes.DATEONLY },
  issued_by:  { type: DataTypes.STRING(100) },
  remarks:    { type: DataTypes.TEXT },
});

module.exports = Certificate;
