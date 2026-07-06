require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim());

app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', apiRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// Central error handler — maps common Sequelize errors to useful HTTP codes
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Duplicate value', detail: err.errors?.map((e) => e.message) });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation failed', detail: err.errors?.map((e) => e.message) });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({
      error: 'Cannot delete: this record is still referenced by other records (e.g. admissions, students, or fees). Remove those first.',
    });
  }
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

async function start() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('✓ Connected to MySQL');
    app.listen(PORT, () => console.log(`✓ API listening on http://localhost:${PORT}`));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('✗ Unable to connect to the database:', err.message);
    process.exit(1);
  }
}

start();
