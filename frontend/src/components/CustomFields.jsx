import { useApi } from './useApi.js';

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
  const set = (key, value) => onChange({ ...v, [key]: value });

  return fields.map((f) => (
    <div className="field" key={f.cf_id}>
      <label>{f.label}</label>
      {f.field_type === 'checkbox' && (
        <input type="checkbox" checked={!!v[f.field_key]}
          onChange={(e) => set(f.field_key, e.target.checked)} />
      )}
      {f.field_type === 'select' && (
        <select value={v[f.field_key] ?? ''} onChange={(e) => set(f.field_key, e.target.value)}>
          <option value="">— select —</option>
          {f.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
      {f.field_type === 'number' && (
        <input type="number" value={v[f.field_key] ?? ''}
          onChange={(e) => set(f.field_key, e.target.value)} />
      )}
      {f.field_type === 'date' && (
        <input type="date" value={v[f.field_key] ?? ''}
          onChange={(e) => set(f.field_key, e.target.value)} />
      )}
      {f.field_type === 'text' && (
        <input value={v[f.field_key] ?? ''}
          onChange={(e) => set(f.field_key, e.target.value)} />
      )}
    </div>
  ));
}
