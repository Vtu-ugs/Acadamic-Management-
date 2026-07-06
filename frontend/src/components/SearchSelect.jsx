import { useMemo, useRef, useState } from 'react';

/**
 * A searchable single-select. Drop-in replacement for a <select> when the list
 * is long enough to want type-to-filter (e.g. picking a student).
 * props:
 *  options: [{ value, label }]
 *  value:   currently selected value (matched against option.value)
 *  onChange(value)
 *  placeholder, required
 */
export default function SearchSelect({ options, value, onChange, placeholder = 'Search…', required }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (o) => {
    onChange(o.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="search-select" ref={boxRef}
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        type="text"
        value={open ? query : (selected?.label || '')}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {/* keeps native "required" validation working off the chosen value */}
      {required && (
        <input tabIndex={-1} aria-hidden required value={value || ''} onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, padding: 0, border: 0 }} />
      )}
      {open && (
        <ul className="search-select-list">
          {filtered.length === 0 && <li className="muted">No matches</li>}
          {filtered.map((o) => (
            <li key={o.value}>
              <button type="button" className="search-select-option"
                onClick={() => pick(o)}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
