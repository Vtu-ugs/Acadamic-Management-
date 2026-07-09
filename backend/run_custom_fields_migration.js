// Migration: adds admin-defined custom fields. Creates the custom_field
// definition table and a `custom_fields` JSON column on each entity that can
// carry extra fields. Run with:
//   node run_custom_fields_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');

const ENTITY_TABLES = ['student', 'admission', 'fee'];

const CREATE_DEFINITION_TABLE = `
  CREATE TABLE IF NOT EXISTS custom_field (
    cf_id      INT AUTO_INCREMENT PRIMARY KEY,
    entity     VARCHAR(20)  NOT NULL,
    field_key  VARCHAR(50)  NOT NULL,
    label      VARCHAR(100) NOT NULL,
    field_type VARCHAR(20)  NOT NULL DEFAULT 'text',
    options    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_custom_field UNIQUE (entity, field_key)
  ) ENGINE=InnoDB`;

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    await sequelize.query(CREATE_DEFINITION_TABLE);
    console.log('✓ custom_field table ready');

    for (const table of ENTITY_TABLES) {
      const [columns] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\``);
      if (columns.some((c) => c.Field === 'custom_fields')) {
        console.log(`• ${table}.custom_fields already exists`);
        continue;
      }
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN custom_fields JSON`);
      console.log(`✓ Added ${table}.custom_fields`);
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
