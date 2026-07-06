const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Auth: application login accounts (table `app_user`; `user` is reserved in MySQL)
const AppUser = sequelize.define('app_user', {
  user_id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username:      { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role:          { type: DataTypes.ENUM('admin', 'admission_staff', 'staff'), allowNull: false },
  full_name:     { type: DataTypes.STRING(120) },
  is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  last_login:    { type: DataTypes.DATE, allowNull: true },
  staff_id:      { type: DataTypes.INTEGER, allowNull: true }, // links a staff login to its staff record
});

module.exports = AppUser;
