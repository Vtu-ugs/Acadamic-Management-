// Migration: adds tc_details column to the certificate table (stores the
// staff-entered Transfer Certificate fields as JSON). Run with:
//   node run_tc_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const [columns] = await sequelize.query('SHOW COLUMNS FROM certificate');
    const colNames = columns.map((c) => c.Field);

    if (!colNames.includes('tc_details')) {
      await sequelize.query('ALTER TABLE certificate ADD COLUMN tc_details TEXT AFTER remarks');
      console.log('✓ Added tc_details column');
    } else {
      console.log('• tc_details column already exists');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();
