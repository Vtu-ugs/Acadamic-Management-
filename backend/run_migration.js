// Quick migration script: adds program_year and carry_forward columns to fee table.
// Run with: node run_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    // Check if columns already exist
    const [columns] = await sequelize.query('SHOW COLUMNS FROM fee');
    const colNames = columns.map((c) => c.Field);

    if (!colNames.includes('program_year')) {
      await sequelize.query('ALTER TABLE fee ADD COLUMN program_year INT AFTER adm_id');
      console.log('✓ Added program_year column');
    } else {
      console.log('• program_year column already exists');
    }

    if (!colNames.includes('carry_forward')) {
      await sequelize.query('ALTER TABLE fee ADD COLUMN carry_forward DECIMAL(10,2) DEFAULT 0 AFTER pending_due');
      console.log('✓ Added carry_forward column');
    } else {
      console.log('• carry_forward column already exists');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();
