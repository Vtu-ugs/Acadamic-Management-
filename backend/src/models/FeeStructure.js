const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { customFieldsAttribute } = require('../utils/customFields');

// Fee-structure master — official year-wise fee slabs per program & admission
// batch. Keyed by (batch_year, program, entry_type, program_year). Fees vary by
// program (BE / MCA / MTech). Regular students draw the 'Regular' rows;
// lateral-entry students draw the 'Lateral' rows.
const FeeStructure = sequelize.define('fee_structure', {
  structure_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  batch_year:   { type: DataTypes.STRING(10), allowNull: false }, // admission batch, e.g. 2025-26
  program:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'BE' }, // BE / MCA / MTech
  entry_type:   { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Regular' }, // Regular / Lateral
  program_year: { type: DataTypes.INTEGER, allowNull: false },    // year of study: 1..4
  tuition_fee:  { type: DataTypes.DECIMAL(10, 2) },               // Tuition Fees (Ref 1)
  regn_fee:     { type: DataTypes.DECIMAL(10, 2) },               // VTU Registration & other fees
  college_fee:  { type: DataTypes.DECIMAL(10, 2) },               // College Fees (Ref 2)
  total_fee:    { type: DataTypes.DECIMAL(10, 2) },               // Total payable for the year
  custom_fields: customFieldsAttribute(),                        // admin-defined extra fields
});

module.exports = FeeStructure;
