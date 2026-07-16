import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A searchable single-select. Drop-in replacement for a <select> when the list
 * is long enough to want type-to-filter (e.g. picking a student).
 *
 * Two modes:
 *  - Client-side (default): pass a full `options` array; typing filters it.
 *  - Server-side: pass `asyncSearch(query) => Promise<[{value,label,...}]>`. The
 *    component debounces and fetches matches, so the caller never has to load
 *    the whole table just to fill the dropdown. Because a fetched result set may
 *    not contain the currently-selected value, pass `valueLabel` so the chosen
 *    option still renders after a new search.
 *
 * props:
 *  options?:  [{ value, label }]        (client-side mode)
 *  asyncSearch?: (query) => Promise<[]> (server-side mode)
 *  value:     currently selected value (matched against option.value)
 *  valueLabel?: label to show for `value` in server-side mode
 *  onChange(value, option)              (option is the full picked object)
 *  placeholder, required
 */
export default function SearchSelect({
  options = [], asyncSearch, value, valueLabel, onChange, placeholder = 'Search…', required,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [pickedLabel, setPickedLabel] = useState('');
  const boxRef = useRef(null);

  // Label shown for the current value: the one just picked, then any caller-
  // supplied label, then a match in the client-side options list.
  const displayLabel = pickedLabel
    || valueLabel
    || options.find((o) => String(o.value) === String(value))?.label
    || '';

  // Forget a stale picked label once the value is cleared/changed externally.
  useEffect(() => { if (!value) setPickedLabel(''); }, [value]);

  // Server-side: debounce-fetch whenever the dropdown is open and the query
  // changes (including the first open, with an empty query, to show recents).
  useEffect(() => {
    if (!asyncSearch || !open) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const rows = await asyncSearch(query);
        if (!cancelled) setResults(rows || []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [asyncSearch, open, query]);

  const clientFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const list = asyncSearch ? results : clientFiltered;

  const pick = (o) => {
    setPickedLabel(o.label);
    onChange(o.value, o);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="search-select" ref={boxRef}
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        type="text"
        value={open ? query : (displayLabel || '')}
        placeholder={displayLabel || placeholder}
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
          {list.length === 0 && <li className="muted">No matches</li>}
          {list.map((o) => (
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
