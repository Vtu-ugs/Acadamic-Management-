const express = require('express');
const multer = require('multer');
const h = require('../utils/asyncHandler');
const c = require('../controllers/studentController');
const ie = require('../controllers/importExportController');

const router = express.Router();

// Bounded upload: cap the size and accept only spreadsheet/CSV types so an
// oversized or unexpected file can't exhaust memory or reach the parser.
const ALLOWED_IMPORT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls
  'text/csv',
  'application/csv',
  'application/octet-stream', // some browsers send this for .xlsx/.csv
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20 MB, matches nginx client_max_body_size
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMPORT_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Unsupported file type — upload an .xlsx, .xls or .csv file.'));
  },
});

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
