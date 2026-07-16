const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/feeController');

const router = express.Router();

router.get('/report/by-year', h(c.reportByYear));     // FR-F5
router.get('/report/by-course', h(c.reportByCourse)); // FR-F6
router.get('/report/pending-dues', h(c.pendingDues)); // FR-F3
router.get('/carry-forward', h(c.getCarryForward));    // carry-forward lookup
router.get('/ledger/:dsn', h(c.ledger));               // year-wise ledger
router.get('/student/:dsn', h(c.byStudent));           // FR-F4
router.get('/:id/receipt.pdf', h(c.receiptPdf));       // FR-F2

router.get('/', h(c.list));                            // FR-F7 (filter by status/year)
router.post('/', h(c.create));                         // FR-F1
router.delete('/:id', h(c.remove));                    // void a receipt + re-net the year

module.exports = router;
