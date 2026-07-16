const sequelize = require('../config/database');
const CustomField = require('../models/CustomField');
const { CUSTOM_FIELD_ENTITIES, FIELD_TYPES } = require('../models/CustomField');

// Which table carries each entity's `custom_fields` column. Looked up from this
// map — never interpolated from the request — so the raw SQL below can't be
// steered at another table. Note `course` lives in the plural `courses` table.
const ENTITY_TABLES = {
  student: 'student',
  admission: 'admission',
  fee: 'fee',
  certificate: 'certificate',
  staff: 'staff',
  course: 'courses',
};

// A field_key becomes a JSON object key and a form input name, so keep it to a
// conservative snake_case shape rather than whatever the admin typed.
const KEY_RE = /^[a-z][a-z0-9_]{0,49}$/;

const slugify = (label) => label
  .trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 50);

// GET /custom-fields?entity=admission[&include_hidden=1]
// The forms call this to know what to render, so it is readable by any signed-in
// user. Hidden fields are excluded unless asked for (the admin page asks).
exports.list = async (req, res) => {
  const where = {};
  if (req.query.entity) {
    if (!CUSTOM_FIELD_ENTITIES.includes(req.query.entity)) {
      return res.status(400).json({ error: `Unknown entity "${req.query.entity}"` });
    }
    where.entity = req.query.entity;
  }
  if (req.query.include_hidden !== '1') where.is_active = true;

  const rows = await CustomField.findAll({
    where,
    order: [['entity', 'ASC'], ['sort_order', 'ASC'], ['cf_id', 'ASC']],
  });
  res.json(rows);
};

// POST /custom-fields  (admin only)
exports.create = async (req, res) => {
  const { entity, label, field_type = 'text', options, sort_order } = req.body;

  if (!CUSTOM_FIELD_ENTITIES.includes(entity)) {
    return res.status(400).json({ error: `entity must be one of: ${CUSTOM_FIELD_ENTITIES.join(', ')}` });
  }
  if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });
  if (!FIELD_TYPES.includes(field_type)) {
    return res.status(400).json({ error: `field_type must be one of: ${FIELD_TYPES.join(', ')}` });
  }
  if (field_type === 'select' && !String(options || '').trim()) {
    return res.status(400).json({ error: 'A select field needs a comma-separated list of options' });
  }

  const field_key = (req.body.field_key || slugify(label));
  if (!KEY_RE.test(field_key)) {
    return res.status(400).json({ error: 'field_key must be snake_case, starting with a letter' });
  }

  // A key that already exists — even a hidden one — still owns stored values on
  // every row, so reusing it would silently resurrect that old data under a new
  // label. Point the admin at the hidden field instead.
  const clash = await CustomField.findOne({ where: { entity, field_key } });
  if (clash) {
    return res.status(409).json({
      error: clash.is_active
        ? `"${field_key}" already exists on ${entity}.`
        : `"${field_key}" exists on ${entity} but is hidden — restore it instead of recreating it.`,
    });
  }

  const created = await CustomField.create({
    entity, field_key, label: label.trim(), field_type,
    options: field_type === 'select' ? String(options).trim() : null,
    sort_order: Number(sort_order) || 0,
  });
  res.status(201).json(created);
};

// PUT /custom-fields/:id  (admin only)
// Presentation only. entity and field_key are immutable: they address values
// already stored in every row's JSON, and renaming them would orphan that data.
exports.update = async (req, res) => {
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: 'Custom field not found' });

  const { label, options, sort_order, is_active } = req.body;
  if (label !== undefined && !String(label).trim()) {
    return res.status(400).json({ error: 'label cannot be empty' });
  }
  if (field.field_type === 'select' && options !== undefined && !String(options).trim()) {
    return res.status(400).json({ error: 'A select field needs a comma-separated list of options' });
  }

  await field.update({
    ...(label !== undefined && { label: String(label).trim() }),
    ...(options !== undefined && field.field_type === 'select' && { options: String(options).trim() }),
    ...(sort_order !== undefined && { sort_order: Number(sort_order) || 0 }),
    ...(is_active !== undefined && { is_active: !!is_active }),
  });
  res.json(field);
};

// DELETE /custom-fields/:id  (admin only)
// Hides the field rather than dropping it. The values stay in each row's JSON
// and reappear if the field is restored — "back to the original" without data
// loss. The destructive counterpart is destroy(), below.
exports.hide = async (req, res) => {
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: 'Custom field not found' });
  await field.update({ is_active: false });
  res.json(field);
};

// Each entry is stored as { label, value }, so the entry itself exists even when
// the field was left blank. `$."key"` addresses the entry; `$."key".value`
// addresses what the user actually typed.
const entryPath = (field) => `$."${field.field_key}"`;
const valuePath = (field) => `$."${field.field_key}".value`;

// How many rows currently hold a value for this field. The admin page asks
// before offering to delete, so the confirmation can name a real number
// instead of a vague warning. A row whose entry exists but is blank doesn't
// count — deleting it loses nothing.
async function countRowsWithValue(field) {
  const table = ENTITY_TABLES[field.entity];
  // A blank field is stored as JSON null, and JSON_EXTRACT hands that back as a
  // JSON null rather than a SQL NULL — so `IS NOT NULL` alone counts it as data.
  // JSON_TYPE tells the two apart.
  const [[row]] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM \`${table}\`
      WHERE JSON_EXTRACT(custom_fields, ?) IS NOT NULL
        AND JSON_TYPE(JSON_EXTRACT(custom_fields, ?)) <> 'NULL'`,
    { replacements: [valuePath(field), valuePath(field)] }
  );
  return Number(row.n) || 0;
}

// GET /custom-fields/:id/usage  (admin only)
exports.usage = async (req, res) => {
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: 'Custom field not found' });
  res.json({ cf_id: field.cf_id, rows_with_value: await countRowsWithValue(field) });
};

// DELETE /custom-fields/:id/permanent  (admin only)
// Drops the definition *and* strips its key from every row's custom_fields.
// Unlike hide(), this cannot be undone — the values are gone. Kept on a
// separate URL from hide() so a mistyped or replayed hide request can never
// destroy data.
exports.destroy = async (req, res) => {
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: 'Custom field not found' });

  const table = ENTITY_TABLES[field.entity];
  const path = entryPath(field);   // drop the whole { label, value } entry
  const removed = await countRowsWithValue(field);

  // Raw SQL on purpose: the beforeSave hook merges previous values forward, so
  // a key can never be dropped through the model. That is exactly the property
  // hide() relies on, and exactly what has to be bypassed here.
  await sequelize.transaction(async (t) => {
    await sequelize.query(
      `UPDATE \`${table}\` SET custom_fields = JSON_REMOVE(custom_fields, ?)
       WHERE JSON_EXTRACT(custom_fields, ?) IS NOT NULL`,
      { replacements: [path, path], transaction: t }
    );
    await field.destroy({ transaction: t });
  });

  res.json({ deleted: field.field_key, entity: field.entity, values_removed: removed });
};
