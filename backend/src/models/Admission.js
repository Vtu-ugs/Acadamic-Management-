const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { batchYearFromCsn } = require('../utils/csn');

// 5.3 ADMISSION
const Admission = sequelize.define('admission', {
  adm_id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  csn:               { type: DataTypes.INTEGER, allowNull: false },
  course_id:         { type: DataTypes.INTEGER, allowNull: false },
  kea_ad_no:         { type: DataTypes.STRING(30) },
  academic_year:     { type: DataTypes.STRING(10) },
  admission_date:    { type: DataTypes.DATEONLY }, // date the student was admitted (auto-fills TC row f.1)
  admission_mode:    { type: DataTypes.STRING(20) },
  entry_type:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Regular' }, // Regular / Lateral
  actual_category:   { type: DataTypes.STRING(30) },
  admitted_category: { type: DataTypes.STRING(30) },
  loan_provider_name:{ type: DataTypes.STRING(100) },
  available_loan:    { type: DataTypes.DECIMAL(10, 2) },
  outside_country:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  outside_state:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  hostel_needed:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  hostel_allocated:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

// The batch (academic_year) follows the CSN's year prefix: CSN 2026xxxx belongs
// to batch 2026-27, CSN 2027xxxx to 2027-28, and so on. Auto-fill it from the
// CSN whenever it's left blank, so it never drifts from the student's CSN.
// An explicitly supplied academic_year is preserved (existing records untouched).
Admission.beforeSave((adm) => {
  if (!adm.academic_year && adm.csn) {
    const batch = batchYearFromCsn(adm.csn);
    if (batch) adm.academic_year = batch;
  }
  // A room can't be allocated to a student who hasn't asked for one.
  if (!adm.hostel_needed) adm.hostel_allocated = false;
});

module.exports = Admission;
