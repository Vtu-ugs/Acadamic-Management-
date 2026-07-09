// Migration: adds hostel_needed / hostel_allocated columns to the admission
// table so admissions staff can record hostel demand and allocation. Run with:
//   node run_hostel_fields_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

const COLUMNS = [
  ['hostel_needed', 'ALTER TABLE admission ADD COLUMN hostel_needed BOOLEAN NOT NULL DEFAULT FALSE AFTER outside_state'],
  ['hostel_allocated', 'ALTER TABLE admission ADD COLUMN hostel_allocated BOOLEAN NOT NULL DEFAULT FALSE AFTER hostel_needed'],
];

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const [columns] = await sequelize.query('SHOW COLUMNS FROM admission');
    const colNames = columns.map((c) => c.Field);

    for (const [name, ddl] of COLUMNS) {
      if (!colNames.includes(name)) {
        await sequelize.query(ddl);
        console.log(`✓ Added ${name} column`);
      } else {
        console.log(`• ${name} column already exists`);
      }
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();
