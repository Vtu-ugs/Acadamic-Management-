// Migration: rename the student key column `csn` to `dsn` across every table
// that carries it. The numbers themselves are unchanged — 20260001 stays
// 20260001, and the year-prefix batch logic still reads the first four digits.
//
// MySQL/MariaDB won't rename a column that a foreign key points at, so the two
// constraints are dropped first and re-created afterwards under the names used
// by schema.sql (the originals are auto-generated *_ibfk_N names).
//
// DDL is not transactional, so take a dump before running this on real data:
//   mysqldump -u root office_management > backup.sql
//
// Idempotent: re-running after a successful pass is a no-op. Run with:
//   node run_csn_to_dsn_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

// [table, "column definition to restore"] — CHANGE needs the full definition.
const TABLES = [
  ['student', 'INT NOT NULL'],
  ['student_personal_details', 'INT NOT NULL'],
  ['admission', 'INT NOT NULL'],
];

// Constraints to re-create once the rename is done.
const FOREIGN_KEYS = [
  ['student_personal_details', 'fk_spd_student'],
  ['admission', 'fk_adm_student'],
];

const hasColumn = async (table, column) => {
  const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, { replacements: [column] });
  return rows.length > 0;
};

// Find whatever the FK on <table>.<column> is actually called right now.
async function foreignKeysOn(table, column) {
  const [rows] = await sequelize.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [table, column] }
  );
  return rows.map((r) => r.CONSTRAINT_NAME);
}

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    if (await hasColumn('student', 'dsn')) {
      console.log('• student.dsn already exists — nothing to do.');
      return;
    }
    if (!await hasColumn('student', 'csn')) {
      throw new Error('neither student.csn nor student.dsn exists — refusing to guess');
    }

    // 1. Drop the foreign keys that reference student.csn.
    for (const [table] of FOREIGN_KEYS) {
      for (const name of await foreignKeysOn(table, 'csn')) {
        await sequelize.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``);
        console.log(`✓ Dropped FK ${table}.${name}`);
      }
    }

    // 2. Rename the column everywhere. Primary keys follow the column.
    for (const [table, definition] of TABLES) {
      await sequelize.query(`ALTER TABLE \`${table}\` CHANGE \`csn\` \`dsn\` ${definition}`);
      console.log(`✓ Renamed ${table}.csn -> ${table}.dsn`);
    }

    // 3. Re-create the foreign keys against the new column name.
    for (const [table, name] of FOREIGN_KEYS) {
      await sequelize.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\`
           FOREIGN KEY (\`dsn\`) REFERENCES \`student\`(\`dsn\`) ON DELETE CASCADE`
      );
      console.log(`✓ Re-created FK ${table}.${name}`);
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
