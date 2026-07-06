const express = require('express');
const h = require('../utils/asyncHandler');
const c = require('../controllers/certificateController');

const router = express.Router();

router.get('/:id/document.pdf', h(c.generatePdf)); // FR-C2 / FR-C4
router.get('/', h(c.list));                        // FR-C3 (issuance log)
router.post('/', h(c.create));
router.delete('/:id', h(c.remove));

module.exports = router;
