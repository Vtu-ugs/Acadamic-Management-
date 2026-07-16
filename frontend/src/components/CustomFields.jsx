import { useApi } from './useApi.js';

// Each stored entry is { label, value } so the JSON is readable in the database.
// Older rows may hold a bare value; read through this either way.
const readValue = (entry) => (
  entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.value : entry
);

// Renders the admin-defined extra fields for one entity, as ordinary .field
// blocks so they sit in the surrounding .form-grid alongside the built-in ones.
//
// `values` is the row's custom_fields object (may be null on a new record) and
// `onChange` receives the whole updated object.
export default function CustomFields({ entity, values, onChange }) {
  const { data: fields, error } = useApi(`/custom-fields?entity=${entity}`, [entity]);

  if (error) return <div className="error">Could not load custom fields: {error}</div>;
  if (!fields || fields.length === 0) return null;

  const v = values || {};
  const get = (field) => readValue(v[field.field_key]);
  // The server rewrites the label from the definition on save; sending it keeps
  // the payload self-describing and matches what comes back from the API.
  const set = (field, value) => onChange({
    ...v,
    [field.field_key]: { label: field.label, value },
  });

  return fields.map((f) => (
    <div className="field" key={f.cf_id}>
      <label>{f.label}</label>
      {f.field_type === 'checkbox' && (
        <input type="checkbox" checked={!!get(f)}
          onChange={(e) => set(f, e.target.checked)} />
      )}
      {f.field_type === 'select' && (
        <select value={get(f) ?? ''} onChange={(e) => set(f, e.target.value)}>
          <option value="">— select —</option>
          {f.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
      {f.field_type === 'number' && (
        <input type="number" value={get(f) ?? ''}
          onChange={(e) => set(f, e.target.value)} />
      )}
      {f.field_type === 'date' && (
        <input type="date" value={get(f) ?? ''}
          onChange={(e) => set(f, e.target.value)} />
      )}
      {f.field_type === 'text' && (
        <input value={get(f) ?? ''}
          onChange={(e) => set(f, e.target.value)} />
      )}
    </div>
  ));
}
