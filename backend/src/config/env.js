// Central, validated environment configuration. Loaded once at startup so the
// rest of the app reads typed values from here instead of poking at
// process.env — and so an unsafe production configuration fails fast and loud
// rather than silently running with dev defaults.
require('dotenv').config();

// The well-known dev fallback. If this ever reaches production it means nobody
// set a real secret, so we refuse to boot (see assertProductionSafety).
const DEV_JWT_SECRET = 'dev-insecure-secret-change-me';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const config = {
  NODE_ENV,
  isProd,
  isTest,
  PORT: Number(process.env.PORT) || 4000,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',

  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_NAME: process.env.DB_NAME || 'office_management',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  // Comma-separated allow-list for CORS.
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

// Refuse to start in production with an insecure configuration. Called from
// server startup; throws (never process.exit) so tests can assert on it.
function assertProductionSafety(cfg = config) {
  if (!cfg.isProd) return;
  const problems = [];
  if (!cfg.JWT_SECRET || cfg.JWT_SECRET === DEV_JWT_SECRET) {
    problems.push('JWT_SECRET is unset or still the insecure dev default');
  } else if (cfg.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production');
  }
  if (!cfg.DB_PASSWORD) {
    problems.push('DB_PASSWORD must be set in production (empty password not allowed)');
  }
  if (problems.length) {
    throw new Error(
      `Refusing to start in production with an insecure configuration:\n  - ${problems.join('\n  - ')}\n`
      + 'Set these in the environment (see backend/.env.example / SECURITY.md).'
    );
  }
}

module.exports = { config, assertProductionSafety, DEV_JWT_SECRET };
