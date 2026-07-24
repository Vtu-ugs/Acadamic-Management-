import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { ensureTestDatabase, truncateAll, dropTestDatabase } = require('../setup/db');
const { app, models, tokenFor, seedAdmission } = require('../setup/app');

const { sequelize, Fee } = models;
const auth = { Authorization: `Bearer ${tokenFor({ role: 'admin' })}` };

// Total money received across the receipt rows of one admission+year.
const paidOf = (f) => (Number(f.kea_fee) || 0) + (Number(f.regn_fee) || 0) + (Number(f.tuition_fee) || 0);

beforeAll(async () => {
  await ensureTestDatabase();
  await sequelize.sync({ force: true }); // build all tables from the models
});

afterAll(async () => {
  await dropTestDatabase();
  await sequelize.close();
});

beforeEach(async () => {
  await truncateAll(sequelize);
});

describe('Fee engine — POST /api/fees', () => {
  it('marks a fully-paid year as Paid with zero pending', async () => {
    const { adm } = await seedAdmission();
    const res = await request(app).post('/api/fees').set(auth).send({
      adm_id: adm.adm_id, program_year: 1, tuition_fee: 100000,
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.pending_due)).toBe(0);
    expect(res.body.payment_status).toBe('Paid');
    // Server bills at the official slab, ignoring any client-sent total.
    expect(Number(res.body.total_course_fee)).toBe(100000);
  });

  it('marks a partial payment as Partial with the correct shortfall', async () => {
    const { adm } = await seedAdmission();
    const res = await request(app).post('/api/fees').set(auth).send({
      adm_id: adm.adm_id, program_year: 1, tuition_fee: 40000,
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.pending_due)).toBe(60000);
    expect(res.body.payment_status).toBe('Partial');
  });

  it('does NOT double-count two installments in the same year', async () => {
    const { adm } = await seedAdmission();
    await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 40000 });
    await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 60000 });

    const rows = await Fee.findAll({ where: { adm_id: adm.adm_id, program_year: 1 } });
    expect(rows).toHaveLength(2);
    // Year fully paid across both receipts: net pending is zero, not counted twice.
    const totalPending = rows.reduce((s, f) => s + Number(f.pending_due), 0);
    const totalPaid = rows.reduce((s, f) => s + paidOf(f), 0);
    expect(totalPaid).toBe(100000);
    expect(totalPending).toBe(0);
    expect(rows.every((f) => f.payment_status === 'Paid')).toBe(true);
  });

  it('carries an unpaid shortfall forward into the next program year', async () => {
    const { adm } = await seedAdmission();
    // Year 1: pay only 40000 of 100000 → 60000 shortfall.
    await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 40000 });

    // Year 2: no payment yet. carry_forward must reflect the year-1 shortfall.
    const res = await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 2, tuition_fee: 0 });

    expect(res.status).toBe(201);
    // The year-1 shortfall is recorded as this year's carry_forward…
    expect(Number(res.body.carry_forward)).toBe(60000);
    // …but pending_due is stored as the PER-YEAR net (slab 120000 − paid 0), by
    // design: consolidateYearBalance keeps each row's pending free of carry so
    // SUM(pending_due) across years never double-counts a prior shortfall. The
    // carry lives in carry_forward and is re-summed by the ledger view.
    expect(Number(res.body.pending_due)).toBe(120000);
    expect(res.body.payment_status).toBe('Pending');
  });

  it('rejects a negative payment amount', async () => {
    const { adm } = await seedAdmission();
    const res = await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: -500 });
    expect(res.status).toBe(400);
  });
});

describe('Fee engine — void (DELETE /api/fees/:id)', () => {
  it('removes the receipt and re-nets the year back to fully pending', async () => {
    const { adm } = await seedAdmission();
    const created = await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 40000 });

    const del = await request(app).delete(`/api/fees/${created.body.fee_id}`).set(auth);
    expect(del.status).toBe(204);

    const rows = await Fee.findAll({ where: { adm_id: adm.adm_id, program_year: 1 } });
    expect(rows).toHaveLength(0); // year has no receipts again
  });
});

describe('Fee engine — reports reflect net balances', () => {
  it('reports collected and pending without double-counting installments', async () => {
    const { adm } = await seedAdmission();
    await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 40000 });
    await request(app).post('/api/fees').set(auth)
      .send({ adm_id: adm.adm_id, program_year: 1, tuition_fee: 60000 });

    const res = await request(app).get('/api/fees/report/by-year').set(auth);
    expect(res.status).toBe(200);
    const row = res.body.find((r) => r.academic_year === adm.academic_year);
    expect(Number(row.total_collected)).toBe(100000);
    expect(Number(row.total_pending)).toBe(0);
  });
});
