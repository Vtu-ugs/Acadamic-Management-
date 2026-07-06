// Generic CRUD controller factory for straightforward entities.
// `pk` is the primary-key column name; `include` is optional eager-load config.
module.exports = function crudFactory(Model, pk, include = []) {
  return {
    list: async (req, res) => {
      const where = {};
      // allow simple equality filters via query string on real columns
      for (const key of Object.keys(req.query)) {
        if (Model.rawAttributes[key]) where[key] = req.query[key];
      }
      const rows = await Model.findAll({ where, include });
      res.json(rows);
    },

    getOne: async (req, res) => {
      const row = await Model.findByPk(req.params.id, { include });
      if (!row) return res.status(404).json({ error: `${Model.name} not found` });
      res.json(row);
    },

    create: async (req, res) => {
      const row = await Model.create(req.body);
      res.status(201).json(row);
    },

    update: async (req, res) => {
      const row = await Model.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: `${Model.name} not found` });
      await row.update(req.body);
      res.json(row);
    },

    remove: async (req, res) => {
      const deleted = await Model.destroy({ where: { [pk]: req.params.id } });
      if (!deleted) return res.status(404).json({ error: `${Model.name} not found` });
      res.status(204).end();
    },
  };
};
