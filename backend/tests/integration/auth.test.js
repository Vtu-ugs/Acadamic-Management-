import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { ensureTestDatabase, dropTestDatabase } = require('../setup/db');
const { app, models, tokenFor } = require('../setup/app');

const { sequelize, AppUser } = models;

beforeAll(async () => {
  await ensureTestDatabase();
  await sequelize.sync({ force: true });
  await AppUser.create({
    username: 'admin',
    password_hash: bcrypt.hashSync('secret123', 10),
    role: 'admin',
    full_name: 'Admin',
    is_active: true,
  });
});

afterAll(async () => {
  await dropTestDatabase();
  await sequelize.close();
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects a wrong password with 401 and no token', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpw' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('400s when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('RBAC (requireRole)', () => {
  it('blocks a non-admin from the admin-only users API with 403', async () => {
    const staffToken = tokenFor({ role: 'staff', username: 'faculty' });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('Login rate limiting', () => {
  // Kept last: failed attempts accumulate per-process, so a 429 must appear
  // within a bounded burst of bad logins (limiter max = 10 failures / window).
  it('eventually returns 429 under a burst of failed logins', async () => {
    let saw429 = false;
    for (let i = 0; i < 15; i += 1) {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'admin', password: 'nope' });
      if (res.status === 429) { saw429 = true; break; }
    }
    expect(saw429).toBe(true);
  });
});
