const express = require('express');
const h = require('../utils/asyncHandler');
const { list, create, update, remove } = require('../controllers/userController');

// Mounted behind requireAuth + requireRole('admin') in routes/index.js.
const router = express.Router();

router.get('/', h(list));
router.post('/', h(create));
router.put('/:id', h(update));
router.delete('/:id', h(remove));

module.exports = router;
