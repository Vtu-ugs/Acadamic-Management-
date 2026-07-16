const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Entities an admin may extend with custom fields. Each has a `custom_fields`
// JSON column; adding one here means adding that column too (see the migration)
// and an entry in ENTITY_TABLES in customFieldController.
const CUSTOM_FIELD_ENTITIES = ['student', 'admission', 'fee', 'certificate', 'staff', 'course'];
const FIELD_TYPES = ['text', 'number', 'date', 'checkbox', 'select'];

// Admin-defined extra field. The definition lives here; the values live in the
// owning row's `custom_fields` JSON, keyed by field_key.
const CustomField = sequelize.define('custom_field', {
  cf_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entity:     { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [CUSTOM_FIELD_ENTITIES] } },
  field_key:  { type: DataTypes.STRING(50), allowNull: false },
  label:      { type: DataTypes.STRING(100), allowNull: false },
  field_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'text', validate: { isIn: [FIELD_TYPES] } },
  options:    { type: DataTypes.TEXT },
  is_active:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = CustomField;
module.exports.CUSTOM_FIELD_ENTITIES = CUSTOM_FIELD_ENTITIES;
module.exports.FIELD_TYPES = FIELD_TYPES;
