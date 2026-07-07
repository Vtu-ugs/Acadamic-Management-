// Migration: adds admission_date column to the admission table (used to
// auto-fill the Transfer Certificate's "Date of Admission"). Run with:
//   node run_admission_date_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const [columns] = await sequelize.query('SHOW COLUMNS FROM admission');
    const colNames = columns.map((c) => c.Field);

    if (!colNames.includes('admission_date')) {
      await sequelize.query('ALTER TABLE admission ADD COLUMN admission_date DATE AFTER academic_year');
      console.log('✓ Added admission_date column');
    } else {
      console.log('• admission_date column already exists');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();
