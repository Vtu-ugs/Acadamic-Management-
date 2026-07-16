// One-time backfill: re-net every (adm_id, program_year) group so historical
// fee rows use the same non-double-counting pending_due as new receipts.
// Rows with a NULL program_year (e.g. bulk-imported fees, one per admission)
// are left untouched — they can't form an installment group.
//
// Usage:  node scripts/backfill_fee_balances.js
require('dotenv').config();
const { sequelize, Fee } = require('../src/models');
const { consolidateYearBalance, getAdmissionSlabs } = require('../src/controllers/feeController');

(async () => {
  await sequelize.authenticate();

  // Distinct (adm_id, program_year) groups that actually have a year.
  const groups = await Fee.findAll({
    attributes: ['adm_id', 'program_year'],
    where: { program_year: { [sequelize.Sequelize.Op.ne]: null } },
    group: ['adm_id', 'program_year'],
    raw: true,
  });
  console.log(`groups to reconcile: ${groups.length}`);

  // Cache slab lookups per admission (one DB hit per admission, not per group).
  const slabCache = new Map();
  let done = 0;

  for (const g of groups) {
    const admId = g.adm_id;
    const programYear = Number(g.program_year);

    if (!slabCache.has(admId)) slabCache.set(admId, await getAdmissionSlabs(admId));
    const { slabs } = slabCache.get(admId);
    const slab = slabs.find((s) => s.program_year === programYear);

    // Bill at the official slab when known; otherwise fall back to what was
    // recorded as the year's total on any receipt in the group.
    let slabTotal = Number(slab?.total_fee) || 0;
    if (!slabTotal) {
      const rows = await Fee.findAll({ where: { adm_id: admId, program_year: programYear }, raw: true });
      slabTotal = Math.max(...rows.map((r) => Number(r.total_course_fee) || 0), 0);
    }

    await sequelize.transaction((t) => consolidateYearBalance(admId, programYear, slabTotal, t));
    done += 1;
    if (done % 500 === 0) console.log(`  reconciled ${done}/${groups.length}`);
  }

  console.log(`done. reconciled ${done} group(s).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
