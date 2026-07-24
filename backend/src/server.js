const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { config, assertProductionSafety } = require('./config/env');
const { sequelize } = require('./models');
const apiRoutes = require('./routes');
const { apiLimiter } = require('./middleware/security');

// Fail fast if production is misconfigured (weak/absent JWT secret, empty DB pw).
assertProductionSafety();

const app = express();
const PORT = config.PORT;

// Behind nginx/a load balancer: trust the first proxy hop so req.ip (and hence
// rate limiting) reflects the real client address, not the proxy's.
app.set('trust proxy', 1);

// Security headers. The frontend is served by nginx on its own origin, so we
// don't need helmet's CSP here (the API returns JSON/PDF, never HTML pages).
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({ origin: config.CORS_ORIGIN }));

// Request logging — concise in production, colourful in dev, silent in tests.
if (!config.isTest) {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

// JSON bodies are small; file imports use multipart (multer), not JSON, so a
// tight limit here blocks oversized-payload abuse without affecting uploads.
app.use(express.json({ limit: '1mb' }));

// Blanket API rate limit (login has its own stricter limiter).
app.use('/api', apiLimiter);

// Liveness: process is up. Readiness: the DB is reachable too.
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/ready', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not-ready' });
  }
});

app.use('/api', apiRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// Central error handler — maps common Sequelize errors to useful HTTP codes.
// Internal details (raw messages, stack) are logged server-side but never sent
// to the client in production, so we don't leak schema/internals to attackers.
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Duplicate value' });
  }
  if (err.name === 'SequelizeValidationError') {
    const detail = config.isProd ? undefined : err.errors?.map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', detail });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({
      error: 'Cannot delete: this record is still referenced by other records (e.g. admissions, students, or fees). Remove those first.',
    });
  }
  // Multer rejects oversized or wrong-type uploads with a code we can surface.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Uploaded file is too large (max 20 MB).' });
  }
  const body = { error: 'Internal server error' };
  if (!config.isProd) body.detail = err.message;
  res.status(500).json(body);
});

// Export the app so tests (supertest) can drive it without opening a port.
module.exports = app;

// Start listening only when run directly (not when imported by the test suite).
async function start() {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to MySQL');
    const server = app.listen(PORT, () => {
      console.log(`✓ API listening on http://localhost:${PORT}`);
    });

    // Graceful shutdown: stop taking new connections, then close the DB pool.
    const shutdown = (signal) => {
      console.log(`\n${signal} received — shutting down gracefully…`);
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
      // Don't hang forever if connections won't drain.
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('✗ Unable to connect to the database:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
