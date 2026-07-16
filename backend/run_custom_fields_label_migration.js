// Data migration: rewrite custom_fields entries from the flat shape
//   { "bus_route": "Route 2" }
// to the self-describing shape
//   { "bus_route": { "label": "Bus Route", "value": "Route 2" } }
// so the JSON reads on its own when browsing the database. The key stays the
// immutable field_key, so renaming a label never orphans its values.
//
// Idempotent: entries already in the new shape are left alone. Run with:
//   node run_custom_fields_label_migration.js
require('dotenv').config();
const sequelize = require('./src/config/database');
const CustomField = require('./src/models/CustomField');
const { asObject } = require('./src/utils/customFields');

// entity -> [table, primary key]
const ENTITIES = {
  student: ['student', 'dsn'],
  admission: ['admission', 'adm_id'],
  fee: ['fee', 'fee_id'],
  certificate: ['certificate', 'cert_id'],
  staff: ['staff', 'staff_id'],
  course: ['courses', 'course_id'],
};

const isWrapped = (entry) => entry && typeof entry === 'object'
  && !Array.isArray(entry) && 'value' in entry;

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    let changed = 0;
    for (const [entity, [table, pk]] of Object.entries(ENTITIES)) {
      const defs = await CustomField.findAll({ where: { entity } });
      const labelFor = new Map(defs.map((d) => [d.field_key, d.label]));

      const [rows] = await sequelize.query(
        `SELECT \`${pk}\` AS id, custom_fields FROM \`${table}\`
         WHERE custom_fields IS NOT NULL`
      );

      for (const row of rows) {
        const current = asObject(row.custom_fields);
        const entries = Object.entries(current);
        if (entries.length === 0 || entries.every(([, e]) => isWrapped(e))) continue;

        const rewritten = Object.fromEntries(entries.map(([key, entry]) => [
          key,
          isWrapped(entry)
            ? entry
            // A key with no definition left keeps its own name as the label.
            : { label: labelFor.get(key) ?? key, value: entry },
        ]));

        await sequelize.query(
          `UPDATE \`${table}\` SET custom_fields = ? WHERE \`${pk}\` = ?`,
          { replacements: [JSON.stringify(rewritten), row.id] }
        );
        changed += 1;
        console.log(`  ✓ ${table}#${row.id}`);
      }
    }

    console.log(changed === 0
      ? 'Nothing to migrate — every row is already in the { label, value } shape.'
      : `Migration complete! Rewrote ${changed} row(s).`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
