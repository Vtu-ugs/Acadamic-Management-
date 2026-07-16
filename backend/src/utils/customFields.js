const { DataTypes } = require('sequelize');
const CustomField = require('../models/CustomField');

// MariaDB implements JSON as an alias for LONGTEXT, so the driver returns these
// columns as strings while real MySQL returns parsed objects. Normalise both.
function asObject(value) {
  if (value == null) return {};
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// The `custom_fields` attribute definition, shared by every entity that carries
// custom fields, with the MariaDB string handled in the getter.
const customFieldsAttribute = () => ({
  type: DataTypes.JSON,
  get() {
    const raw = this.getDataValue('custom_fields');
    return raw == null ? null : asObject(raw);
  },
});

// Coerce a submitted value to the shape its field type promises, so a checkbox
// never lands in the JSON as the string "false" (which is truthy on the way out).
function coerce(value, fieldType) {
  if (value === '' || value === null || value === undefined) return null;
  if (fieldType === 'checkbox') {
    return value === true || value === 1 || value === '1'
      || String(value).trim().toLowerCase() === 'true'
      || String(value).trim().toLowerCase() === 'yes';
  }
  if (fieldType === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value);
}

// Each entry is stored as { label, value } so the JSON reads on its own —
// browsing the table shows "Bus Route": "Route 2", not a bare slug. The key is
// still the immutable field_key: renaming a label must not orphan its values.
//
// Callers may submit either shape. `{ bus_route: "Route 2" }` and
// `{ bus_route: { label: …, value: "Route 2" } }` both mean the same thing, and
// the label written is always the current one from the definition, never
// whatever a client happened to send.
const unwrapValue = (entry) => (
  entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry
    ? entry.value
    : entry
);
const unwrapLabel = (entry, fallback) => (
  entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.label === 'string'
    ? entry.label
    : fallback
);

// Registers a beforeSave hook that sanitises the model's `custom_fields` JSON.
//
// Three rules, enforced here rather than in the controllers, so an import or a
// direct API call obeys them exactly as the form does:
//
//   1. Only keys matching a defined field for this entity are stored. Anything
//      else is dropped, so the JSON column can't accumulate junk keys.
//   2. Values already on the row are preserved unless the incoming payload
//      names them. That is what makes retiring a field non-destructive: a
//      hidden field is absent from every form submission, and its value has to
//      survive those saves to still be there when an admin restores it.
//   3. Every entry is rewritten as { label, value }, with the label refreshed
//      from the definition — so renaming a field updates the stored labels the
//      next time each row is saved, and a stale label can never contradict it.
function attachCustomFields(Model, entity) {
  Model.addHook('beforeSave', async (instance) => {
    if (!instance.changed('custom_fields')) return;

    const incoming = instance.custom_fields;
    // previous() returns the stored value untouched, bypassing the getter.
    const previous = asObject(instance.previous('custom_fields'));

    if (incoming === null) {
      // An explicit null would wipe values belonging to hidden fields too.
      instance.custom_fields = previous;
      return;
    }
    if (typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new Error('custom_fields must be an object');
    }

    const defs = await CustomField.findAll({ where: { entity } });
    const byKey = new Map(defs.map((d) => [d.field_key, d]));

    // Rule 2: carry every stored entry forward, refreshing its label (rule 3).
    const merged = {};
    for (const [key, entry] of Object.entries(previous)) {
      merged[key] = {
        label: byKey.get(key)?.label ?? unwrapLabel(entry, key),
        value: unwrapValue(entry),
      };
    }

    for (const [key, entry] of Object.entries(incoming)) {
      const def = byKey.get(key);
      if (!def) continue;             // rule 1: unknown key, drop it
      merged[key] = { label: def.label, value: coerce(unwrapValue(entry), def.field_type) };
    }
    instance.custom_fields = merged;
  });
}

module.exports = {
  attachCustomFields, coerce, asObject, customFieldsAttribute, unwrapValue, unwrapLabel,
};
