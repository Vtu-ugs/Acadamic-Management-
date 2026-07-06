// Creates the app_user table (if missing) and upserts the three default login
// accounts with bcrypt-hashed passwords. Run with: node seed_users.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sequelize = require('./src/config/database');

// Default accounts — CHANGE these passwords after first login.
const DEFAULT_USERS = [
  { username: 'admin',     password: 'admin123',     role: 'admin',           full_name: 'System Administrator' },
  { username: 'admission', password: 'admission123', role: 'admission_staff', full_name: 'Admission Staff' },
  { username: 'staff',     password: 'staff123',     role: 'staff',           full_name: 'Faculty Staff' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    // Ensure the table exists (idempotent — mirrors database/migration_users.sql)
    const ddl = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'migration_users.sql'),
      'utf8'
    );
    await sequelize.query(ddl);
    console.log('✓ app_user table ready');

    // Add columns to tables created before they existed (idempotent).
    const [cols] = await sequelize.query('SHOW COLUMNS FROM app_user');
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('last_login')) {
      await sequelize.query('ALTER TABLE app_user ADD COLUMN last_login DATETIME NULL');
      console.log('✓ added last_login column');
    }
    if (!colNames.includes('staff_id')) {
      await sequelize.query('ALTER TABLE app_user ADD COLUMN staff_id INT NULL');
      console.log('✓ added staff_id column');
    }

    // Activity log table (login/logout + diary changes).
    await sequelize.query(`CREATE TABLE IF NOT EXISTS activity_log (
      log_id     INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NULL,
      username   VARCHAR(50),
      role       VARCHAR(30),
      action     VARCHAR(40) NOT NULL,
      detail     VARCHAR(255),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✓ activity_log table ready');

    for (const u of DEFAULT_USERS) {
      const hash = bcrypt.hashSync(u.password, 10);
      // Upsert by unique username: update the hash/role if the row already exists.
      await sequelize.query(
        `INSERT INTO app_user (username, password_hash, role, full_name, is_active)
         VALUES (:username, :hash, :role, :full_name, 1)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           full_name = VALUES(full_name),
           is_active = 1`,
        { replacements: { username: u.username, hash, role: u.role, full_name: u.full_name } }
      );
      console.log(`✓ user "${u.username}" (${u.role})`);
    }

    console.log('\nDefault credentials (⚠ change these after first login):');
    DEFAULT_USERS.forEach((u) => console.log(`   ${u.username} / ${u.password}  →  ${u.role}`));
    console.log('\nSeed complete!');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seed();
