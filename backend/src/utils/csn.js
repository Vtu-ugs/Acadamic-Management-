const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

const SEQ_WIDTH = 10000; // 4-digit sequence per year -> 20260001, 20260002, ...

/**
 * Generate the next year-wise CSN, e.g. 20260001.
 *   csn = year * 10000 + nextSequence
 * The sequence restarts at 0001 for each new year. If a year ever exceeds
 * 9999 students the number simply grows wider (e.g. 202610000) while still
 * sorting correctly within that year.
 *
 * Must be called inside a transaction; the caller should retry on a duplicate
 * primary-key error (handled by withCsnRetry) to stay safe under concurrency.
 *
 * @param {import('sequelize').Transaction} transaction
 * @param {number} [year] defaults to the current calendar year
 * @returns {Promise<number>}
 */
async function generateCsn(transaction, year = new Date().getFullYear()) {
  const lo = year * SEQ_WIDTH + 1;
  const hi = year * SEQ_WIDTH + (SEQ_WIDTH - 1);

  const [row] = await sequelize.query(
    'SELECT MAX(csn) AS maxCsn FROM student WHERE csn BETWEEN :lo AND :hi',
    { replacements: { lo, hi }, type: QueryTypes.SELECT, transaction }
  );

  return row.maxCsn ? Number(row.maxCsn) + 1 : lo;
}

/**
 * Run `fn` (which creates a student) and retry on duplicate-PK collisions that
 * can occur when two admissions are saved at the same instant.
 * @param {(attempt:number)=>Promise<any>} fn
 */
async function withCsnRetry(fn, maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      const dup = err.name === 'SequelizeUniqueConstraintError'
        || err.original?.code === 'ER_DUP_ENTRY';
      if (!dup || attempt === maxAttempts) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Derive the admission batch / academic year from a CSN's year prefix.
 * The CSN is `year * 10000 + sequence`, so `20260001` -> year 2026 -> "2026-27".
 * @param {number|string} csn
 * @returns {string|null} e.g. "2026-27", or null if the CSN has no sane year
 */
function batchYearFromCsn(csn) {
  const year = Math.floor(Number(csn) / SEQ_WIDTH);
  if (!Number.isFinite(year) || year < 2000 || year > 2999) return null;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

module.exports = { generateCsn, withCsnRetry, batchYearFromCsn };
