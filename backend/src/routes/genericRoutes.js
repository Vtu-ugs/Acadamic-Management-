const express = require('express');
const h = require('../utils/asyncHandler');

// Builds a standard REST router (list, getOne, create, update, remove)
// from a crudFactory controller object.
module.exports = function genericRouter(ctrl) {
  const router = express.Router();
  router.get('/', h(ctrl.list));
  router.post('/', h(ctrl.create));
  router.get('/:id', h(ctrl.getOne));
  router.put('/:id', h(ctrl.update));
  router.delete('/:id', h(ctrl.remove));
  return router;
};
