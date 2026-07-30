// Integration-test database harness.
//
// Uses a SEPARATE schema (default `office_management_test`) so tests never touch
// real data. The empty schema is created here; the caller then builds the
// tables from the Sequelize models via `sequelize.sync({ force: true })` — this
// covers every model (app_user, activity_log, …), not just the base schema.sql,
// and stays reproducible in CI without replaying migrations.
//
// IMPORTANT: require this module BEFORE the app/models, so DB_NAME + NODE_ENV
// are set before config/env reads them.
const mysql = require('mysql2/promise');

const TEST_DB = process.env.DB_NAME || 'office_management_test';

// SAFETY RAIL: this harness DROPs the schema it is pointed at. A DB_NAME left
// over in the shell (e.g. copied from a running deployment) would therefore
// destroy live data, so refuse anything that isn't clearly a throwaway schema.
if (!/(^|_)test(_|$)/.test(TEST_DB)) {
  throw new Error(
    `Refusing to run tests against DB_NAME="${TEST_DB}": the test harness drops this ` +
    'database. Use a name containing "test" (default: office_management_test), or unset DB_NAME.'
  );
}

process.env.DB_NAME = TEST_DB;
process.env.NODE_ENV = 'test';

const conn = () => ({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

// Create a fresh, empty test schema. Call once before the suite.
async function ensureTestDatabase() {
  const c = await mysql.createConnection(conn());
  await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await c.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
}

// Empty every base table (FK checks off so order doesn't matter). Between tests.
async function truncateAll(sequelize) {
  const [rows] = await sequelize.query(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?',
    { replacements: [TEST_DB] }
  );
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { t } of rows) {
    await sequelize.query(`TRUNCATE TABLE \`${t}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function dropTestDatabase() {
  const c = await mysql.createConnection(conn());
  await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await c.end();
}

module.exports = { TEST_DB, ensureTestDatabase, truncateAll, dropTestDatabase };
