const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 5.4 FEE
const Fee = sequelize.define('fee', {
  fee_id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adm_id:           { type: DataTypes.INTEGER, allowNull: false },
  program_year:     { type: DataTypes.INTEGER },
  kea_fee:          { type: DataTypes.DECIMAL(10, 2) },
  regn_fee:         { type: DataTypes.DECIMAL(10, 2) },
  tuition_fee:      { type: DataTypes.DECIMAL(10, 2) },
  total_course_fee: { type: DataTypes.DECIMAL(10, 2) },
  pending_due:      { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  carry_forward:    { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  receipt_number:   { type: DataTypes.STRING(30), unique: true },
  payment_status:   { type: DataTypes.STRING(20) },
  academic_year:    { type: DataTypes.STRING(10) },
  receipt_date:     { type: DataTypes.DATEONLY },
});

module.exports = Fee;
