const express = require('express');
const multer = require('multer');
const h = require('../utils/asyncHandler');
const c = require('../controllers/studentController');
const ie = require('../controllers/importExportController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Import / export (declare before :dsn to avoid path collisions)
router.get('/export', h(ie.exportStudents));                 // FR-S6
router.post('/import', upload.single('file'), h(ie.importStudents)); // FR-S7
router.get('/search', h(c.search));                          // FR-S3
router.get('/usn-pending', h(c.usnPending));                 // FR-S3a
router.get('/branch-stats', h(c.branchStats));               // Dashboard per-branch stats

router.get('/', h(c.list));                                  // FR-S4
router.post('/', h(c.create));                               // FR-S1
router.get('/:dsn', h(c.getOne));
router.put('/:dsn', h(c.update));                            // FR-S2
router.patch('/:dsn/usn', h(c.updateUsn));                   // FR-S1a
router.delete('/:dsn', h(c.remove));

module.exports = router;
