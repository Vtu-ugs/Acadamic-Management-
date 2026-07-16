const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { customFieldsAttribute } = require('../utils/customFields');

// 5.5 CERTIFICATE
const Certificate = sequelize.define('certificate', {
  cert_id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adm_id:     { type: DataTypes.INTEGER, allowNull: false },
  cert_type:  { type: DataTypes.STRING(50) },
  issue_date: { type: DataTypes.DATEONLY },
  issued_by:  { type: DataTypes.STRING(100) },
  remarks:    { type: DataTypes.TEXT },
  // Staff-entered fields for the Transfer Certificate (rows h–n plus T.C. No.,
  // Serial No. and the admission/leaving dates). Stored as a JSON string;
  // rows a–g are always auto-fetched from the student record at render time.
  tc_details: { type: DataTypes.TEXT },
  custom_fields: customFieldsAttribute(),
});

module.exports = Certificate;
